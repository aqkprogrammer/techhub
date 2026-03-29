import type { Currency, PlanId } from '@/components/pricing/plan-config';
import { pricingPlans } from '@/components/pricing/plan-config';

export type PlanMeta = {
  id: PlanId;
  title: string;
  duration: string;
  amount: number;
  currency: Currency;
  expirationDays: number | null;
  isLifetime: boolean;
};

export type RazorpayOrderResponse = {
  id: string;
  entity: 'order';
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string;
  status: string;
  attempts: number;
  created_at: number;
};

export const COMPATIBILITY_ERROR_CODES = new Set(['42703', '42804', '22P02', 'PGRST204']);

export function isPlanId(value: string): value is PlanId {
  return value === 'basic' || value === 'standard' || value === 'lifetime';
}

export function isCurrency(value: string): value is Currency {
  return value === 'INR' || value === 'USD';
}

export function detectCurrencyFromRequest(request: Request, selected?: string | null): Currency {
  if (selected && isCurrency(selected)) {
    return selected;
  }

  const country =
    request.headers.get('x-vercel-ip-country') ??
    request.headers.get('cf-ipcountry') ??
    request.headers.get('x-country-code') ??
    '';

  return country.trim().toLowerCase() === 'in' ? 'INR' : 'USD';
}

export function resolvePlanMeta(planId: PlanId, currency: Currency): PlanMeta | null {
  const selectedPlan = pricingPlans.find((plan) => plan.id === planId);
  if (!selectedPlan) return null;

  return {
    id: selectedPlan.id,
    title: selectedPlan.title,
    duration: selectedPlan.duration,
    amount: selectedPlan.price[currency],
    currency,
    expirationDays: selectedPlan.expirationDays,
    isLifetime: selectedPlan.id === 'lifetime',
  };
}

function getRazorpayCredentials() {
  const keyId = process.env.RAZORPAY_KEY_ID ?? '';
  const keySecret = process.env.RAZORPAY_SECRET ?? '';

  if (!keyId || !keySecret) {
    throw new Error('Razorpay is not configured.');
  }

  return { keyId, keySecret };
}

export function getRazorpayPublicKey() {
  return (
    process.env.NEXT_PUBLIC_RAZORPAY_KEY ??
    process.env.RAZORPAY_KEY_ID ??
    ''
  );
}

export async function createRazorpayOrder(params: {
  amount: number;
  currency: Currency;
  receipt: string;
  notes: Record<string, string>;
}) {
  const { keyId, keySecret } = getRazorpayCredentials();
  const authorization = Buffer.from(`${keyId}:${keySecret}`).toString('base64');

  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${authorization}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: Math.round(params.amount * 100),
      currency: params.currency,
      receipt: params.receipt,
      notes: params.notes,
    }),
  });

  const payload = (await response.json().catch(() => null)) as
    | RazorpayOrderResponse
    | { error?: { description?: string } }
    | null;

  if (!response.ok || !payload || !('id' in payload)) {
    const message =
      payload && 'error' in payload
        ? payload.error?.description || 'Unable to create Razorpay order.'
        : 'Unable to create Razorpay order.';
    throw new Error(message);
  }

  return payload;
}

export function computeSubscriptionEndDate(plan: PlanMeta) {
  const now = new Date();
  if (plan.isLifetime) {
    const lifetime = new Date(now);
    lifetime.setFullYear(lifetime.getFullYear() + 100);
    return lifetime.toISOString();
  }

  if (typeof plan.expirationDays === 'number' && plan.expirationDays > 0) {
    const endsAt = new Date(now.getTime() + plan.expirationDays * 24 * 60 * 60 * 1000);
    return endsAt.toISOString();
  }

  return null;
}

