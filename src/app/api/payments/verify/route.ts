import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { setAuthCookies } from '@/app/api/auth/_shared';
import { jsonError } from '@/app/api/_utils';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  COMPATIBILITY_ERROR_CODES,
  computeSubscriptionEndDate,
  detectCurrencyFromRequest,
  isCurrency,
  isPlanId,
  resolvePlanMeta,
} from '@/lib/payments/razorpay';
import { requireAuthenticatedUser } from '@/app/api/account/_auth';

const verifySchema = z.object({
  plan: z.string().min(1),
  currency: z.string().optional(),
  paymentRecordId: z.string().uuid().optional(),
  razorpay_order_id: z.string().min(6),
  razorpay_payment_id: z.string().min(6),
  razorpay_signature: z.string().min(10),
});

function secureCompare(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  if (aBuffer.length !== bBuffer.length) return false;
  return timingSafeEqual(aBuffer, bBuffer);
}

async function loadPaymentRow(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  paymentRecordId: string | undefined,
  orderId: string,
  userId: string,
) {
  if (paymentRecordId) {
    const attempts = [
      () =>
        supabase
          .from('payments')
          .select('*')
          .eq('id', paymentRecordId)
          .eq('user_id', userId)
          .maybeSingle(),
      () =>
        supabase
          .from('payments')
          .select('*')
          .eq('id', paymentRecordId)
          .maybeSingle(),
    ];

    for (const run of attempts) {
      const { data, error } = await run();
      if (!error) return data as Record<string, unknown> | null;
      if (!COMPATIBILITY_ERROR_CODES.has(error.code ?? '')) break;
    }
  }

  const orderAttempts = [
    () =>
      supabase
        .from('payments')
        .select('*')
        .eq('razorpay_order_id', orderId)
        .eq('user_id', userId)
        .maybeSingle(),
    () =>
      supabase
        .from('payments')
        .select('*')
        .eq('provider_order_id', orderId)
        .eq('user_id', userId)
        .maybeSingle(),
    () =>
      supabase
        .from('payments')
        .select('*')
        .eq('receipt', orderId)
        .eq('user_id', userId)
        .maybeSingle(),
  ];

  for (const run of orderAttempts) {
    const { data, error } = await run();
    if (!error && data) return data as Record<string, unknown>;
    if (!error) continue;
    if (!COMPATIBILITY_ERROR_CODES.has(error.code ?? '')) break;
  }

  return null;
}

async function updatePaymentStatus(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  rowId: string | null,
  orderId: string,
  payload: {
    status: string;
    razorpayPaymentId?: string;
    razorpaySignature?: string;
    failureReason?: string;
  },
) {
  const now = new Date().toISOString();
  const basePayloads: Array<Record<string, unknown>> = [
    {
      status: payload.status,
      razorpay_payment_id: payload.razorpayPaymentId ?? null,
      provider_payment_id: payload.razorpayPaymentId ?? null,
      razorpay_signature: payload.razorpaySignature ?? null,
      provider_signature: payload.razorpaySignature ?? null,
      failure_reason: payload.failureReason ?? null,
      paid_at: payload.status === 'paid' ? now : null,
      updated_at: now,
    },
    {
      status: payload.status,
      razorpay_payment_id: payload.razorpayPaymentId ?? null,
      razorpay_signature: payload.razorpaySignature ?? null,
      failure_reason: payload.failureReason ?? null,
      updated_at: now,
    },
    {
      status: payload.status,
      updated_at: now,
    },
    {
      status: payload.status,
    },
  ];

  const updateTargets: Array<(queryPayload: Record<string, unknown>) => Promise<{ code?: string | null } | null>> =
    [];

  if (rowId) {
    updateTargets.push(async (queryPayload) => {
      const { error } = await supabase.from('payments').update(queryPayload).eq('id', rowId);
      return error ? { code: error.code ?? null } : null;
    });
  }

  updateTargets.push(
    async (queryPayload) => {
      const { error } = await supabase
        .from('payments')
        .update(queryPayload)
        .eq('razorpay_order_id', orderId);
      return error ? { code: error.code ?? null } : null;
    },
    async (queryPayload) => {
      const { error } = await supabase
        .from('payments')
        .update(queryPayload)
        .eq('provider_order_id', orderId);
      return error ? { code: error.code ?? null } : null;
    },
  );

  for (const payloadCandidate of basePayloads) {
    for (const runTarget of updateTargets) {
      const error = await runTarget(payloadCandidate);
      if (!error) return;
      if (!COMPATIBILITY_ERROR_CODES.has(error.code ?? '')) return;
    }
  }
}

async function insertSubscriptionRow(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  params: {
    userId: string;
    plan: string;
    currency: string;
    amount: number;
    currentPeriodEnd: string | null;
    isLifetime: boolean;
    orderId: string;
    paymentId: string;
  },
) {
  const now = new Date().toISOString();
  const payloadCandidates: Array<Record<string, unknown>> = [
    {
      user_id: params.userId,
      plan: params.plan,
      currency: params.currency,
      amount: params.amount,
      status: 'active',
      current_period_end: params.currentPeriodEnd,
      expires_at: params.currentPeriodEnd,
      is_lifetime: params.isLifetime,
      stripe_subscription_id: params.orderId,
      stripe_customer_id: params.paymentId,
      created_at: now,
      updated_at: now,
    },
    {
      user_id: params.userId,
      plan: params.plan,
      currency: params.currency,
      amount: params.amount,
      status: 'active',
      current_period_end: params.currentPeriodEnd,
      is_lifetime: params.isLifetime,
      created_at: now,
      updated_at: now,
    },
    {
      user_id: params.userId,
      plan: params.plan,
      currency: params.currency,
      amount: params.amount,
      expires_at: params.currentPeriodEnd,
      is_lifetime: params.isLifetime,
      created_at: now,
    },
    {
      user_id: params.userId,
      plan: params.plan,
      currency: params.currency,
      amount: params.amount,
      created_at: now,
    },
  ];

  await supabase
    .from('subscriptions')
    .update({ status: 'inactive', updated_at: now })
    .eq('user_id', params.userId)
    .eq('status', 'active');

  let lastError: { code?: string | null; message?: string | null } | null = null;
  for (const payload of payloadCandidates) {
    const { error } = await supabase.from('subscriptions').insert(payload);
    if (!error) return;

    lastError = { code: error.code, message: error.message };
    if (!COMPATIBILITY_ERROR_CODES.has(error.code ?? '')) {
      break;
    }
  }

  throw new Error(lastError?.message || 'Failed to activate subscription.');
}

export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) {
    return auth.response;
  }

  const body = await request.json().catch(() => null);
  const parsed = verifySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError('Invalid payment verification payload.');
  }

  const planRaw = parsed.data.plan.trim().toLowerCase();
  if (!isPlanId(planRaw)) {
    return jsonError('Invalid plan.');
  }

  const currencyDetected = detectCurrencyFromRequest(request, parsed.data.currency ?? null);
  const currencyRaw = parsed.data.currency?.trim().toUpperCase();
  const currency = currencyRaw && isCurrency(currencyRaw) ? currencyRaw : currencyDetected;
  const planMeta = resolvePlanMeta(planRaw, currency);
  if (!planMeta) {
    return jsonError('Invalid plan configuration.');
  }

  const razorpaySecret = process.env.RAZORPAY_SECRET ?? '';
  if (!razorpaySecret) {
    return jsonError('Razorpay secret is not configured.', 500);
  }

  const expectedSignature = createHmac('sha256', razorpaySecret)
    .update(`${parsed.data.razorpay_order_id}|${parsed.data.razorpay_payment_id}`)
    .digest('hex');

  const supabase = createSupabaseServerClient();

  if (!secureCompare(expectedSignature, parsed.data.razorpay_signature)) {
    await updatePaymentStatus(
      supabase,
      parsed.data.paymentRecordId ?? null,
      parsed.data.razorpay_order_id,
      {
        status: 'failed',
        failureReason: 'signature_mismatch',
      },
    );
    return jsonError('Invalid payment signature.', 400);
  }

  const paymentRow = await loadPaymentRow(
    supabase,
    parsed.data.paymentRecordId,
    parsed.data.razorpay_order_id,
    auth.user.id,
  );

  const rowPlan =
    (typeof paymentRow?.plan === 'string' && paymentRow.plan.toLowerCase()) ||
    (typeof paymentRow?.plan_type === 'string' && paymentRow.plan_type.toLowerCase()) ||
    planRaw;
  if (!isPlanId(rowPlan)) {
    return jsonError('Unable to validate plan from payment record.', 400);
  }

  const rowCurrencyRaw =
    (typeof paymentRow?.currency === 'string' && paymentRow.currency.toUpperCase()) || currency;
  const rowCurrency = isCurrency(rowCurrencyRaw) ? rowCurrencyRaw : currency;
  const verifiedPlan = resolvePlanMeta(rowPlan, rowCurrency);
  if (!verifiedPlan) {
    return jsonError('Unable to validate pricing details.', 400);
  }

  const rowAmountRaw = paymentRow?.amount;
  const rowAmount =
    typeof rowAmountRaw === 'number'
      ? rowAmountRaw
      : typeof rowAmountRaw === 'string'
        ? Number(rowAmountRaw)
        : null;
  if (
    rowAmount !== null &&
    Number.isFinite(rowAmount) &&
    Number(rowAmount.toFixed(2)) !== Number(verifiedPlan.amount.toFixed(2))
  ) {
    return jsonError('Payment amount mismatch.', 400);
  }

  try {
    await updatePaymentStatus(
      supabase,
      paymentRow && typeof paymentRow.id === 'string' ? paymentRow.id : null,
      parsed.data.razorpay_order_id,
      {
        status: 'paid',
        razorpayPaymentId: parsed.data.razorpay_payment_id,
        razorpaySignature: parsed.data.razorpay_signature,
      },
    );

    await insertSubscriptionRow(supabase, {
      userId: auth.user.id,
      plan: verifiedPlan.id,
      currency: verifiedPlan.currency,
      amount: verifiedPlan.amount,
      currentPeriodEnd: computeSubscriptionEndDate(verifiedPlan),
      isLifetime: verifiedPlan.isLifetime,
      orderId: parsed.data.razorpay_order_id,
      paymentId: parsed.data.razorpay_payment_id,
    });

    const response = NextResponse.json({
      success: true,
      subscription: {
        plan: verifiedPlan.id,
        status: 'active',
      },
    });
    if (auth.session) {
      setAuthCookies(response, auth.session);
    }
    return response;
  } catch (error) {
    console.error('Razorpay verify failed:', error);
    return jsonError(
      error instanceof Error ? error.message : 'Failed to verify payment.',
      500,
    );
  }
}

