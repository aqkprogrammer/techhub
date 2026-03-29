import type { Metadata } from 'next';
import { headers } from 'next/headers';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import PricingShell from '@/components/pricing/PricingShell';
import { type PlanId } from '@/components/pricing/plan-config';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Unlock full access to all technical interview questions and answers. Choose a plan that fits your prep timeline — from monthly to lifetime access.',
  keywords: ['techhub pricing', 'interview prep subscription', 'unlock interview answers'],
  openGraph: {
    title: 'Pricing | techhub.cafe',
    description: 'Unlock full access to all technical interview questions and answers. Choose a plan that fits your prep timeline.',
    url: 'https://techhub.cafe/pricing',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pricing | techhub.cafe',
    description: 'Unlock full access to all technical interview questions and answers. Choose a plan that fits your prep timeline.',
  },
  alternates: { canonical: 'https://techhub.cafe/pricing' },
};
const VALID_PLANS: PlanId[] = ['basic', 'standard', 'lifetime'];

async function resolveUserPlan(
  supabase: ReturnType<typeof createSupabaseServerClient>,
): Promise<{ plan: PlanId | null; hasActive: boolean }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { plan: null, hasActive: false };
  const { data, error } = await supabase
    .from('subscriptions')
    .select('plan,status')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return { plan: null, hasActive: false };
  const status = typeof data?.status === 'string' ? data.status.trim().toLowerCase() : 'inactive';
  if (status !== 'active') return { plan: null, hasActive: false };
  const planValue = typeof data?.plan === 'string' && VALID_PLANS.includes(data.plan as PlanId) ? (data.plan as PlanId) : null;
  return { plan: planValue, hasActive: Boolean(planValue) };
}

export default async function PricingPage() {
  const supabase = createSupabaseServerClient();
  const { plan, hasActive } = await resolveUserPlan(supabase);
  const headerStore = await headers();
  const country = (
    headerStore.get('x-vercel-ip-country') ??
    headerStore.get('cf-ipcountry') ??
    'us'
  ).toLowerCase();
  const defaultCurrency = country === 'in' ? 'INR' : 'USD';
  const isIndiaVisitor = country === 'in';
  const showFirstTimeOffer = isIndiaVisitor && !hasActive;

  return (
    <div className="bg-slate-50">
      <main className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-12 md:px-6">
        <PricingShell
          defaultCurrency={defaultCurrency}
          userPlan={plan}
          isIndiaVisitor={isIndiaVisitor}
          showFirstTimeOffer={showFirstTimeOffer}
        />
      </main>
    </div>
  );
}
