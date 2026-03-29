import { createSupabaseServerClient } from '@/lib/supabase/server';

type StreakRow = {
  id?: string;
  user_id?: string;
  current_streak?: number | null;
  streak?: number | null;
  longest_streak?: number | null;
  last_activity_date?: string | null;
};

function toDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function previousDay(dateIso: string): string {
  const date = new Date(`${dateIso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return toDateOnly(date);
}

export async function touchUserStreak(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  userId: string,
) {
  const today = toDateOnly(new Date());
  const yesterday = previousDay(today);

  const { data: existing, error } = await supabase
    .from('user_streaks')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    return;
  }

  const row = (existing ?? null) as StreakRow | null;
  const current = Number(row?.current_streak ?? row?.streak ?? 0) || 0;
  const longest = Number(row?.longest_streak ?? 0) || 0;
  const lastActivity = typeof row?.last_activity_date === 'string' ? row.last_activity_date : null;

  if (lastActivity === today) {
    return;
  }

  const nextCurrent = lastActivity === yesterday ? current + 1 : 1;
  const nextLongest = Math.max(longest, nextCurrent);

  await supabase.from('user_streaks').upsert(
    {
      user_id: userId,
      current_streak: nextCurrent,
      longest_streak: nextLongest,
      last_activity_date: today,
    },
    { onConflict: 'user_id' },
  );
}
