import { NextResponse } from 'next/server';

import { clearAuthCookies } from '../../auth/_shared';

export async function POST() {
  const response = NextResponse.json({ ok: true });
  clearAuthCookies(response);
  return response;
}
