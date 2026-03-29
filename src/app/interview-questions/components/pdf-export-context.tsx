'use client';

import type { ReactNode } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { useAuth } from '@/components/auth-provider';
import { useSubscription } from '@/hooks/use-subscription';

type PdfExportContextValue = {
  selectedQuestionIds: string[];
  selectedCount: number;
  isSelected: (questionId: string) => boolean;
  toggleQuestion: (questionId: string) => void;
  clearSelection: () => void;
  hasPaidAccess: boolean;
  isSubscriptionLoading: boolean;
  isDownloading: boolean;
  downloadError: string | null;
  downloadPdf: () => Promise<void>;
};

const PdfExportContext = createContext<PdfExportContextValue | null>(null);

function parseFileName(contentDisposition: string | null): string {
  if (!contentDisposition) return 'techhub-interview-questions.pdf';
  const match = contentDisposition.match(/filename="?([^"]+)"?/i);
  if (!match?.[1]) return 'techhub-interview-questions.pdf';
  return match[1].trim() || 'techhub-interview-questions.pdf';
}

export function PdfExportProvider({
  questionIds,
  children,
}: {
  questionIds: string[];
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, isLoading } = useAuth();
  const subscription = useSubscription();
  const [selectedIdMap, setSelectedIdMap] = useState<Record<string, boolean>>({});
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const selectedQuestionIds = useMemo(() => {
    const visibleSet = new Set(questionIds);
    return Object.entries(selectedIdMap)
      .filter(([questionId, selected]) => selected && visibleSet.has(questionId))
      .map(([questionId]) => questionId);
  }, [questionIds, selectedIdMap]);

  const selectedCount = selectedQuestionIds.length;

  const isSelected = useCallback(
    (questionId: string) => Boolean(selectedIdMap[questionId]),
    [selectedIdMap]
  );

  const toggleQuestion = useCallback((questionId: string) => {
    setSelectedIdMap((current) => ({
      ...current,
      [questionId]: !current[questionId],
    }));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIdMap({});
  }, []);

  const redirectToLogin = useCallback(() => {
    const query = searchParams.toString();
    const nextPath = query ? `${pathname}?${query}` : pathname;
    router.push(`/login?next=${encodeURIComponent(nextPath || '/interview-questions')}`);
  }, [pathname, router, searchParams]);

  const downloadPdf = useCallback(async () => {
    setDownloadError(null);
    if (isLoading) {
      setDownloadError('Checking your session. Please try again in a moment.');
      return;
    }

    if (!user) {
      redirectToLogin();
      return;
    }

    const ids = selectedQuestionIds.length > 0 ? selectedQuestionIds : questionIds;
    if (ids.length === 0) {
      setDownloadError('No questions available to export.');
      return;
    }

    setIsDownloading(true);
    try {
      const response = await fetch('/api/questions/export-pdf', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionIds: ids }),
      });

      if (response.status === 401) {
        redirectToLogin();
        return;
      }

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(payload.error ?? 'Failed to generate PDF.');
      }

      const blob = await response.blob();
      const fileName = parseFileName(response.headers.get('content-disposition'));
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      setDownloadError(
        error instanceof Error ? error.message : 'Failed to generate PDF.'
      );
    } finally {
      setIsDownloading(false);
    }
  }, [isLoading, questionIds, redirectToLogin, selectedQuestionIds, user]);

  const value = useMemo<PdfExportContextValue>(
    () => ({
      selectedQuestionIds,
      selectedCount,
      isSelected,
      toggleQuestion,
      clearSelection,
      hasPaidAccess: subscription.hasActiveAccess,
      isSubscriptionLoading: subscription.isLoading,
      isDownloading,
      downloadError,
      downloadPdf,
    }),
    [
      selectedQuestionIds,
      selectedCount,
      isSelected,
      toggleQuestion,
      clearSelection,
      subscription.hasActiveAccess,
      subscription.isLoading,
      isDownloading,
      downloadError,
      downloadPdf,
    ]
  );

  return (
    <PdfExportContext.Provider value={value}>{children}</PdfExportContext.Provider>
  );
}

const FALLBACK_CONTEXT: PdfExportContextValue = {
  selectedQuestionIds: [],
  selectedCount: 0,
  isSelected: () => false,
  toggleQuestion: () => undefined,
  clearSelection: () => undefined,
  hasPaidAccess: false,
  isSubscriptionLoading: false,
  isDownloading: false,
  downloadError: null,
  downloadPdf: async () => undefined,
};

export function usePdfExport() {
  const context = useContext(PdfExportContext);
  if (!context) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        'usePdfExport used outside PdfExportProvider. Falling back to no-op handlers.'
      );
    }
    return FALLBACK_CONTEXT;
  }
  return context;
}
