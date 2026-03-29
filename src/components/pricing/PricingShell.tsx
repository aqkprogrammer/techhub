'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';

import CurrencyToggle from './CurrencyToggle';
import FeatureRow from './FeatureRow';
import PricingCard from './PricingCard';
import RecommendedBadge from './RecommendedBadge';
import { featureComparison, pricingPlans, type Currency, type PlanId } from './plan-config';

const COUNTDOWN_SECONDS = 60 * 60 * 24;
let razorpayScriptPromise: Promise<boolean> | null = null;

type RazorpaySuccessResponse = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

type CreateOrderApiResponse = {
  key: string;
  orderId: string;
  amount: number;
  currency: Currency;
  plan: PlanId;
  paymentRecordId: string | null;
  error?: string;
};

type VerifyPaymentApiResponse = {
  success?: boolean;
  error?: string;
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, handler: (response: unknown) => void) => void;
    };
  }
}

type PricingShellProps = {
  defaultCurrency: Currency;
  userPlan: PlanId | null;
  isIndiaVisitor: boolean;
  showFirstTimeOffer: boolean;
  compact?: boolean;
  onPaymentSuccess?: () => void;
};

export default function PricingShell({
  defaultCurrency,
  userPlan,
  isIndiaVisitor,
  showFirstTimeOffer,
  compact = false,
  onPaymentSuccess,
}: PricingShellProps) {
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>(defaultCurrency);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState<string | null>(null);
  const [processingPlanId, setProcessingPlanId] = useState<PlanId | null>(null);

  useEffect(() => {
    setSelectedCurrency(defaultCurrency);
  }, [defaultCurrency]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedCountdown = useMemo(() => {
    const hours = Math.floor(countdown / 3600);
    const minutes = Math.floor((countdown % 3600) / 60);
    const seconds = countdown % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }, [countdown]);

  const loadRazorpayScript = async () => {
    if (typeof window === 'undefined') return false;
    if (window.Razorpay) return true;
    if (!razorpayScriptPromise) {
      razorpayScriptPromise = new Promise((resolve) => {
        const existing = document.getElementById('razorpay-checkout-script') as HTMLScriptElement | null;
        if (existing) {
          existing.addEventListener('load', () => resolve(true));
          existing.addEventListener('error', () => resolve(false));
          return;
        }
        const script = document.createElement('script');
        script.id = 'razorpay-checkout-script';
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.async = true;
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
      });
    }
    return razorpayScriptPromise;
  };

  const redirectToLogin = () => {
    if (typeof window === 'undefined') return;
    const next = `${window.location.pathname}${window.location.search}`;
    window.location.assign(`/login?next=${encodeURIComponent(next)}`);
  };

  const verifyPayment = async (
    response: RazorpaySuccessResponse,
    params: { plan: PlanId; currency: Currency; paymentRecordId: string | null },
  ) => {
    const verifyResponse = await fetch('/api/payments/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        ...response,
        plan: params.plan,
        currency: params.currency,
        paymentRecordId: params.paymentRecordId,
      }),
    });

    const verifyPayload = (await verifyResponse.json().catch(() => ({}))) as VerifyPaymentApiResponse;
    if (!verifyResponse.ok) {
      throw new Error(verifyPayload.error ?? 'Payment verification failed.');
    }
  };

  const handleCheckout = async (planId: PlanId) => {
    setCheckoutError(null);
    setPaymentSuccess(null);
    setProcessingPlanId(planId);
    try {
      const response = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify({ plan: planId, currency: selectedCurrency }),
      });

      if (response.status === 401) {
        redirectToLogin();
        return;
      }

      const payload = (await response.json().catch(() => ({}))) as CreateOrderApiResponse;
      if (!response.ok) {
        throw new Error(payload.error ?? 'Unable to create payment order.');
      }

      const scriptReady = await loadRazorpayScript();
      if (!scriptReady || !window.Razorpay) {
        throw new Error('Unable to load Razorpay checkout.');
      }

      const selectedPlan = pricingPlans.find((plan) => plan.id === planId);
      const rzp = new window.Razorpay({
        key: payload.key,
        order_id: payload.orderId,
        amount: payload.amount,
        currency: payload.currency,
        name: 'TechHub',
        description: `Premium Interview Answers - ${selectedPlan?.title ?? planId}`,
        handler: async (rzpResponse: unknown) => {
          const checkoutResponse = rzpResponse as RazorpaySuccessResponse;
          try {
            await verifyPayment(checkoutResponse, {
              plan: payload.plan,
              currency: payload.currency,
              paymentRecordId: payload.paymentRecordId,
            });
            setPaymentSuccess('Payment successful. Your premium access is active.');
            if (typeof onPaymentSuccess === 'function') {
              onPaymentSuccess();
            }
          } catch (error) {
            setCheckoutError(
              error instanceof Error ? error.message : 'Failed to verify payment.',
            );
          } finally {
            setProcessingPlanId(null);
          }
        },
        modal: {
          ondismiss: () => {
            setProcessingPlanId(null);
          },
        },
        theme: {
          color: '#111827',
        },
      });

      rzp.on('payment.failed', () => {
        setCheckoutError('Payment failed. Please try again.');
        setProcessingPlanId(null);
      });

      rzp.open();
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : 'Unable to start checkout.');
      setProcessingPlanId(null);
    }
  };

  return (
    <div className={compact ? 'space-y-6' : 'space-y-10'}>
      <div className="mx-auto max-w-3xl space-y-4 text-center">
        {!compact ? (
          <>
            <p className="text-sm uppercase tracking-[0.4em] text-slate-400">Multi-market pricing</p>
            <h1 className="text-4xl font-bold text-slate-900">One platform, global plans</h1>
            <p className="text-base text-slate-600">
              Select the plan that matches your timeline. Currency is auto-detected by region and can be switched manually anytime.
            </p>
          </>
        ) : null}

        <div className="flex flex-wrap items-center justify-center gap-3">
          <CurrencyToggle value={selectedCurrency} onChange={setSelectedCurrency} />
          {isIndiaVisitor && showFirstTimeOffer ? (
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
              ₹399 First Time Offer · Ends in {formattedCountdown}
            </span>
          ) : null}
        </div>

        {!compact ? (
          userPlan ? (
            <p className="text-sm text-slate-500">
              Current plan: <span className="font-semibold text-slate-900">{userPlan}</span>
            </p>
          ) : (
            <p className="text-sm text-slate-500">No active subscription detected.</p>
          )
        ) : null}
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {pricingPlans.map((plan) => (
          <PricingCard
            key={plan.id}
            plan={plan}
            selectedCurrency={selectedCurrency}
            onSelectPlan={handleCheckout}
            loadingPlanId={processingPlanId}
            firstTimeDiscountText={showFirstTimeOffer && plan.id === 'basic' ? '₹399 First Time Offer' : null}
          />
        ))}
      </div>

      {!compact ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Feature comparison</p>
              <h2 className="text-2xl font-bold text-slate-900">What&apos;s included?</h2>
            </div>
            <div className="flex items-center gap-3">
              <RecommendedBadge />
              <span className="hidden text-xs text-slate-500 md:block">Lifetime includes PDF export and unlimited access.</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 text-sm text-slate-600 md:grid-cols-4">
            <div className="font-semibold text-slate-800">Feature</div>
            <div className="font-semibold text-slate-800">Basic</div>
            <div className="font-semibold text-slate-800">Standard</div>
            <div className="font-semibold text-slate-800">Lifetime</div>
          </div>

          <div className="space-y-3">
            {featureComparison.map((row) => (
              <div
                key={row.label}
                className="grid grid-cols-1 gap-2 rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-3 text-sm text-slate-700 md:grid-cols-4"
              >
                <div className="font-medium text-slate-900">{row.label}</div>
                <FeatureRow label="Basic" included={row.basic} />
                <FeatureRow label="Standard" included={row.standard} />
                <FeatureRow label="Lifetime" included={row.lifetime} />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {checkoutError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {checkoutError}
        </div>
      ) : null}

      {paymentSuccess ? (
        <div className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          <CheckCircle2 className="h-4 w-4" />
          {paymentSuccess}
        </div>
      ) : null}

    </div>
  );
}
