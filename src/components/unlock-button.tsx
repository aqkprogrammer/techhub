'use client';

import { useState } from 'react';

import { useAuth } from './auth-provider';
import UnlockModal from './unlock-modal';

type UnlockButtonProps = {
  totalQuestions?: number;
  className?: string;
  children?: React.ReactNode;
};

export default function UnlockButton({
  totalQuestions = 0,
  className = '',
  children,
}: UnlockButtonProps) {
  const { user, isLoading, hasPaidAccess, isSubscriptionLoading } = useAuth();
  const [open, setOpen] = useState(false);

  if (isLoading) {
    return null;
  }

  if (user && isSubscriptionLoading) {
    return null;
  }

  if (user && hasPaidAccess) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ||
          'inline-flex items-center gap-2 rounded-full bg-[rgb(var(--accent))] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90'
        }
      >
        {children ?? (
          <>
            <span aria-hidden>🔒</span>
            Unlock {totalQuestions > 0 ? `${totalQuestions} ` : ''}Answers
          </>
        )}
      </button>
      <UnlockModal
        open={open}
        onClose={() => setOpen(false)}
        answerCount={totalQuestions}
      />
    </>
  );
}
