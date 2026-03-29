import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { setAuthCookies } from '@/app/api/auth/_shared';
import { jsonError } from '@/app/api/_utils';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  COMPATIBILITY_ERROR_CODES,
  createRazorpayOrder,
  detectCurrencyFromRequest,
  getRazorpayPublicKey,
  isPlanId,
  resolvePlanMeta,
} from '@/lib/payments/razorpay';
import { requireAuthenticatedUser } from '@/app/api/account/_auth';

const bodySchema = z.object({
  plan: z.string().min(1),
  currency: z.string().optional(),
});

async function insertPaymentRecord(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  params: {
    userId: string;
    plan: string;
    currency: string;
    amount: number;
    receipt: string;
    razorpayOrderId: string;
  },
) {
  const now = new Date().toISOString();
  const metadata = {
    provider: 'razorpay',
    receipt: params.receipt,
    created_via: 'create-order',
  };

  const payloadCandidates: Array<Record<string, unknown>> = [
    {
      user_id: params.userId,
      plan: params.plan,
      plan_type: params.plan,
      currency: params.currency,
      amount: params.amount,
      status: 'created',
      provider: 'razorpay',
      receipt: params.receipt,
      razorpay_order_id: params.razorpayOrderId,
      provider_order_id: params.razorpayOrderId,
      metadata,
      created_at: now,
      updated_at: now,
    },
    {
      user_id: params.userId,
      plan: params.plan,
      currency: params.currency,
      amount: params.amount,
      status: 'created',
      razorpay_order_id: params.razorpayOrderId,
      receipt: params.receipt,
      created_at: now,
    },
    {
      user_id: params.userId,
      plan: params.plan,
      currency: params.currency,
      amount: params.amount,
      status: 'created',
      created_at: now,
    },
    {
      user_id: params.userId,
      amount: params.amount,
      status: 'created',
      created_at: now,
    },
  ];

  let lastError: { code?: string | null; message?: string | null } | null = null;
  for (const payload of payloadCandidates) {
    const { data, error } = await supabase
      .from('payments')
      .insert(payload)
      .select('*')
      .maybeSingle();

    if (!error) {
      return data as Record<string, unknown> | null;
    }

    lastError = { code: error.code, message: error.message };
    if (!COMPATIBILITY_ERROR_CODES.has(error.code ?? '')) {
      break;
    }
  }

  throw new Error(lastError?.message || 'Failed to persist payment record.');
}

export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) {
    return auth.response;
  }

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError('Invalid payment request payload.');
  }

  const planValue = parsed.data.plan.trim().toLowerCase();
  if (!isPlanId(planValue)) {
    return jsonError('Invalid plan selection.');
  }

  const currency = detectCurrencyFromRequest(request, parsed.data.currency ?? null);
  const planMeta = resolvePlanMeta(planValue, currency);
  if (!planMeta) {
    return jsonError('Invalid plan selection.');
  }

  const razorpayKey = getRazorpayPublicKey();
  if (!razorpayKey) {
    return jsonError('Razorpay public key is not configured.', 500);
  }

  const receipt = `th_${auth.user.id.slice(0, 8)}_${Date.now()}_${randomUUID().slice(0, 8)}`;

  try {
    const order = await createRazorpayOrder({
      amount: planMeta.amount,
      currency: planMeta.currency,
      receipt,
      notes: {
        user_id: auth.user.id,
        plan: planMeta.id,
        currency: planMeta.currency,
      },
    });

    const supabase = createSupabaseServerClient();
    const paymentRecord = await insertPaymentRecord(supabase, {
      userId: auth.user.id,
      plan: planMeta.id,
      currency: planMeta.currency,
      amount: planMeta.amount,
      receipt,
      razorpayOrderId: order.id,
    });

    const response = NextResponse.json({
      key: razorpayKey,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      receipt,
      plan: planMeta.id,
      paymentRecordId:
        paymentRecord && typeof paymentRecord.id === 'string' ? paymentRecord.id : null,
    });

    if (auth.session) {
      setAuthCookies(response, auth.session);
    }

    return response;
  } catch (error) {
    console.error('Razorpay create order error:', error);
    return jsonError(
      error instanceof Error ? error.message : 'Unable to create payment order.',
      500,
    );
  }
}

