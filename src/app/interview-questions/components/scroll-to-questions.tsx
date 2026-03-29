'use client';

import { useEffect } from 'react';

/**
 * Scrolls to the #questions section when the page loads with that hash
 * (e.g. after clicking a topic link). Needed because Next.js client navigation
 * does not always scroll to the hash target.
 */
export default function ScrollToQuestions() {
  useEffect(() => {
    if (typeof window === 'undefined' || window.location.hash !== '#questions') return;
    const el = document.getElementById('questions');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  return null;
}
