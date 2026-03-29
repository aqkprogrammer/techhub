import { NextResponse } from 'next/server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { pricingPlans, type Currency, type PlanId } from '@/components/pricing/plan-config';

const stripeSecret = process.env.STRIPE_SECRET_KEY;
const checkoutBase = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
const allowedCurrencies: Currency[] = ['INR', 'USD'];

type StripeCheckoutResponse = {
  id?: string;
  url?: string | null;
  error?: {
    message?: string;
  };
};

function isPlanId(value: string): value is PlanId {
  return value === 'basic' || value === 'standard' || value === 'lifetime';
}

function isCurrency(value: string): value is Currency {
  return allowedCurrencies.includes(value as Currency);
}

async function createStripeCheckoutSession(params: {
  planId: PlanId;
  planTitle: string;
  currency: Currency;
  amount: number;
  userId: string;
}): Promise<{ url: string | null; sessionId: string | null }> {
  const form = new URLSearchParams();
  form.set('mode', 'payment');
  form.set('payment_method_types[0]', 'card');
  form.set('line_items[0][price_data][currency]', params.currency.toLowerCase());
  form.set('line_items[0][price_data][unit_amount]', String(Math.round(params.amount * 100)));
  form.set('line_items[0][price_data][product_data][name]', `techhub.cafe ${params.planTitle}`);
  form.set('line_items[0][quantity]', '1');
  form.set('metadata[user_id]', params.userId);
  form.set('metadata[plan_id]', params.planId);
  form.set('metadata[currency]', params.currency);
  form.set('success_url', `${checkoutBase}/account?checkout=success`);
  form.set('cancel_url', `${checkoutBase}/pricing`);

  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeSecret}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  });

  const payload = (await response.json().catch(() => ({}))) as StripeCheckoutResponse;
  if (!response.ok) {
    throw new Error(payload.error?.message || 'Unable to create Stripe checkout session.');
  }

  return {
    url: payload.url ?? null,
    sessionId: payload.id ?? null,
  };
}

export async function POST(request: Request) {
  if (!stripeSecret) {
    return NextResponse.json({ error: 'Stripe is not configured.' }, { status: 500 });
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as {
    plan?: string;
    currency?: string;
  } | null;

  const planValue = payload?.plan ?? '';
  const currencyValue = payload?.currency ?? '';

  if (!isPlanId(planValue)) {
    return NextResponse.json({ error: 'Invalid plan selection.' }, { status: 400 });
  }

  if (!isCurrency(currencyValue)) {
    return NextResponse.json({ error: 'Currency must be INR or USD.' }, { status: 400 });
  }

  const selectedPlan = pricingPlans.find((plan) => plan.id === planValue);
  if (!selectedPlan) {
    return NextResponse.json({ error: 'Invalid plan.' }, { status: 400 });
  }

  const amount = selectedPlan.price[currencyValue];

  try {
    const { url, sessionId } = await createStripeCheckoutSession({
      planId: selectedPlan.id,
      planTitle: selectedPlan.title,
      currency: currencyValue,
      amount,
      userId: user.id,
    });

    const expiresAt = selectedPlan.expirationDays
      ? new Date(Date.now() + selectedPlan.expirationDays * 24 * 60 * 60 * 1000).toISOString()
      : null;

    const insertCandidates: Record<string, unknown>[] = [
      {
        user_id: user.id,
        plan: selectedPlan.id,
        currency: currencyValue,
        amount,
        expires_at: expiresAt,
        is_lifetime: selectedPlan.id === 'lifetime',
        created_at: new Date().toISOString(),
        stripe_subscription_id: sessionId,
        stripe_customer_id: null,
        status: 'pending_checkout',
      },
      {
        user_id: user.id,
        plan: selectedPlan.id,
        currency: currencyValue,
        amount,
        expires_at: expiresAt,
        is_lifetime: selectedPlan.id === 'lifetime',
        created_at: new Date().toISOString(),
      },
    ];

    let insertError: { code?: string; message?: string } | null = null;
    let inserted = false;
    for (const payload of insertCandidates) {
      const { error } = await supabase.from('subscriptions').insert(payload);
      if (!error) {
        inserted = true;
        break;
      }

      insertError = { code: error.code, message: error.message };
      if (error.code !== '42703') {
        break;
      }
    }

    if (!inserted && insertError) {
      console.error('Failed to persist subscription record', insertError);
    }

    return NextResponse.json({ url });
  } catch (error) {
    console.error('Stripe checkout error', error);
    return NextResponse.json({ error: 'Failed to create checkout session.' }, { status: 500 });
  }
}
