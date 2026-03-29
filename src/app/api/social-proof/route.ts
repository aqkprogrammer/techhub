import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createSupabaseServerClient } from '@/lib/supabase/server';

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(8),
});

let purchaseNotificationsTableMissing = false;
let hasLoggedMissingPurchaseNotifications = false;

type SocialProofRow = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  country_code: string | null;
  country_flag: string | null;
  plan_label: string | null;
  provider: string | null;
  purchased_at: string | null;
};

type SocialProofItem = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  countryCode: string | null;
  countryFlag: string | null;
  planLabel: string;
  provider: string;
  purchasedAt: string | null;
  isSynthetic: boolean;
};

const SYNTHETIC_NAMES = [
  'Giovanna',
  'Arjun',
  'Maya',
  'Luca',
  'Aarav',
  'Noah',
  'Isabella',
  'Riya',
  'Mateo',
  'Fatima',
  'Kabir',
  'Elena',
];

const SYNTHETIC_COUNTRIES = [
  { code: 'PT', flag: '🇵🇹' },
  { code: 'IN', flag: '🇮🇳' },
  { code: 'US', flag: '🇺🇸' },
  { code: 'DE', flag: '🇩🇪' },
  { code: 'AE', flag: '🇦🇪' },
  { code: 'BR', flag: '🇧🇷' },
  { code: 'CA', flag: '🇨🇦' },
  { code: 'SG', flag: '🇸🇬' },
];

const SYNTHETIC_PLANS = ['Lifetime', 'Pro', 'Pro+', 'Premium'];
const SYNTHETIC_PROVIDERS = ['Stripe', 'Razorpay', 'PayPal'];

function randomPick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function createSyntheticItems(count: number): SocialProofItem[] {
  return Array.from({ length: count }, (_, index) => {
    const country = randomPick(SYNTHETIC_COUNTRIES);
    const minutesAgo = Math.floor(Math.random() * (6 * 24 * 60)) + 2;
    return {
      id: `synthetic-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
      displayName: randomPick(SYNTHETIC_NAMES),
      avatarUrl: null,
      countryCode: country.code,
      countryFlag: country.flag,
      planLabel: randomPick(SYNTHETIC_PLANS),
      provider: randomPick(SYNTHETIC_PROVIDERS),
      purchasedAt: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
      isSynthetic: true,
    };
  });
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }
  return result;
}

function mapItem(row: SocialProofRow): SocialProofItem {
  return {
    id: row.id,
    displayName: row.display_name || 'A tech candidate',
    avatarUrl: row.avatar_url,
    countryCode: row.country_code,
    countryFlag: row.country_flag,
    planLabel: row.plan_label || 'Pro',
    provider: row.provider || 'Stripe',
    purchasedAt: row.purchased_at,
    isSynthetic: false,
  };
}

function syntheticResponse(limit: number) {
  const synthetic = createSyntheticItems(Math.max(limit, 6));
  return NextResponse.json({
    items: shuffle(synthetic).slice(0, limit),
    total: Math.min(limit, synthetic.length),
    fallback: true,
    hasRealData: false,
  });
}

export async function GET(request: Request) {
  const parsed = querySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams)
  );
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query params.' }, { status: 400 });
  }

  try {
    if (purchaseNotificationsTableMissing) {
      return syntheticResponse(parsed.data.limit);
    }

    const supabase = createSupabaseServerClient();
    const fetchLimit = Math.min(parsed.data.limit * 6, 60);

    const { data, error } = await supabase
      .from('purchase_notifications')
      .select(
        'id, display_name, avatar_url, country_code, country_flag, plan_label, provider, purchased_at'
      )
      .eq('is_active', true)
      .order('purchased_at', { ascending: false })
      .limit(fetchLimit);

    if (error) {
      const missingTable =
        error.code === 'PGRST205' &&
        typeof error.message === 'string' &&
        error.message.includes('public.purchase_notifications');

      if (missingTable) {
        purchaseNotificationsTableMissing = true;
        if (!hasLoggedMissingPurchaseNotifications) {
          hasLoggedMissingPurchaseNotifications = true;
          console.warn(
            'purchase_notifications table is missing. Using synthetic social proof until table is created.',
          );
        }
        return syntheticResponse(parsed.data.limit);
      }

      console.warn('Social proof query failed, using synthetic pool:', error);
      return syntheticResponse(parsed.data.limit);
    }

    const realItems = ((data ?? []) as SocialProofRow[]).map(mapItem);
    const synthetic = createSyntheticItems(Math.max(4, Math.ceil(parsed.data.limit / 2)));
    const randomized = shuffle([...realItems, ...synthetic]).slice(0, parsed.data.limit);

    if (randomized.length === 0) {
      return syntheticResponse(parsed.data.limit);
    }

    return NextResponse.json({
      items: randomized,
      total: randomized.length,
      fallback: false,
      hasRealData: realItems.length > 0,
    });
  } catch (error) {
    console.warn('Social proof endpoint failed, using synthetic pool:', error);
    return syntheticResponse(parsed.data.limit);
  }
}
