export type Currency = 'INR' | 'USD';
export type PlanId = 'basic' | 'standard' | 'lifetime';

export type PricingPlan = {
  id: PlanId;
  title: string;
  duration: string;
  description: string;
  price: Record<Currency, number>;
  highlightCopy: string;
  pdfExport: boolean;
  recommended?: boolean;
  expirationDays: number | null;
  marketPlanIds: Record<Currency, string>;
  stripePlanIds?: Record<Currency, string>;
  features: string[];
};

export const pricingPlans: PricingPlan[] = [
  {
    id: 'basic',
    title: 'Basic',
    duration: '7 Days',
    description: 'Short-term practice with curated questions.',
    price: { INR: 499, USD: 27 },
    highlightCopy: 'No PDF export',
    pdfExport: false,
    expirationDays: 7,
    marketPlanIds: { INR: 'BASIC_INR', USD: 'BASIC_USD' },
    stripePlanIds: { INR: 'BASIC_INR', USD: 'BASIC_USD' },
    features: ['Access to full question bank', 'Community support', 'Limited updates'],
  },
  {
    id: 'standard',
    title: 'Standard',
    duration: '20 Days',
    description: 'Extended prep + progress tracking.',
    price: { INR: 899, USD: 37 },
    highlightCopy: 'No PDF export',
    pdfExport: false,
    expirationDays: 20,
    marketPlanIds: { INR: 'STANDARD_INR', USD: 'STANDARD_USD' },
    stripePlanIds: { INR: 'STANDARD_INR', USD: 'STANDARD_USD' },
    features: ['Everything in Basic', 'Progress analytics', 'Priority support'],
  },
  {
    id: 'lifetime',
    title: 'Lifetime',
    duration: 'Unlimited',
    description: 'All questions + PDF export forever.',
    price: { INR: 1499, USD: 47 },
    highlightCopy: 'PDF export included',
    pdfExport: true,
    expirationDays: null,
    recommended: true,
    marketPlanIds: { INR: 'LIFETIME_INR', USD: 'LIFETIME_USD' },
    stripePlanIds: { INR: 'LIFETIME_INR', USD: 'LIFETIME_USD' },
    features: ['Unlimited downloads', 'PDF export', 'Early access to new content'],
  },
];

export type FeatureComparisonRow = {
  label: string;
  basic: boolean;
  standard: boolean;
  lifetime: boolean;
};

export const featureComparison: FeatureComparisonRow[] = [
  { label: 'Curated question library', basic: true, standard: true, lifetime: true },
  { label: 'AI-assisted hints', basic: false, standard: true, lifetime: true },
  { label: 'Export to PDF', basic: false, standard: false, lifetime: true },
  { label: 'Lifetime access', basic: false, standard: false, lifetime: true },
  { label: 'Interview-ready walk-throughs', basic: true, standard: true, lifetime: true },
];
