'use client';

import type { ReactNode } from 'react';

import CodeBlock from './code-block';

const CODE_BLOCK_REGEX = /```([a-zA-Z0-9_+-]+)?[ \t]*\n([\s\S]*?)\n```/g;
const IMAGE_ONLY_LINE_REGEX = /^!\[([^\]]*)\]\(([^)]+)\)$/;
const HEADING_REGEX = /^(#{1,4})\s+(.+)$/;
const LIST_REGEX = /^[-*]\s+(.+)$/;
const QUOTE_REGEX = /^>\s?(.*)$/;

type RichContentProps = {
  content: string;
  className?: string;
};

type ContentPart = {
  type: 'text' | 'code';
  value: string;
  language?: string;
};

function parseInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const regex =
    /!\[([^\]]*)\]\(([^)]+)\)|\[(.*?)\]\(([^)]+)\)|\*\*([^*]+)\*\*|==([^=]+)==|`([^\n`]+)`|\*([^*]+)\*/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    if (match[1] !== undefined && match[2] !== undefined) {
      const alt = match[1];
      const src = match[2];
      nodes.push(
        <img
          key={`${keyPrefix}-img-${index}`}
          src={src}
          alt={alt || 'Embedded illustration'}
          loading="lazy"
          className="my-2 max-h-[420px] w-auto max-w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] object-contain"
        />,
      );
    } else if (match[3] !== undefined && match[4] !== undefined) {
      nodes.push(
        <a
          key={`${keyPrefix}-a-${index}`}
          href={match[4]}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-[rgb(var(--accent))] underline"
        >
          {match[3]}
        </a>,
      );
    } else if (match[5] !== undefined) {
      nodes.push(
        <strong key={`${keyPrefix}-b-${index}`} className="font-semibold text-[rgb(var(--text))]">
          {match[5]}
        </strong>,
      );
    } else if (match[6] !== undefined) {
      nodes.push(
        <mark
          key={`${keyPrefix}-m-${index}`}
          className="rounded bg-amber-100 px-1 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200"
        >
          {match[6]}
        </mark>,
      );
    } else if (match[7] !== undefined) {
      nodes.push(
        <code
          key={`${keyPrefix}-c-${index}`}
          className="rounded-md bg-[rgb(var(--bg))] px-1.5 py-0.5 font-mono text-[0.9em] text-[rgb(var(--accent))]"
        >
          {match[7]}
        </code>,
      );
    } else if (match[8] !== undefined) {
      nodes.push(
        <em key={`${keyPrefix}-i-${index}`} className="italic">
          {match[8]}
        </em>,
      );
    }

    index += 1;
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

function renderTextBlock(part: string, partIndex: number): ReactNode[] {
  const nodes: ReactNode[] = [];
  const lines = part.replace(/\r\n/g, '\n').split('\n');

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) {
      i += 1;
      continue;
    }

    const headingMatch = line.match(HEADING_REGEX);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2].trim();
      const inline = parseInline(text, `h-${partIndex}-${i}`);
      if (level === 1) {
        nodes.push(
          <h2 key={`h1-${partIndex}-${i}`} className="text-xl font-semibold text-[rgb(var(--text))]">
            {inline}
          </h2>,
        );
      } else if (level === 2) {
        nodes.push(
          <h3 key={`h2-${partIndex}-${i}`} className="text-lg font-semibold text-[rgb(var(--text))]">
            {inline}
          </h3>,
        );
      } else {
        nodes.push(
          <h4 key={`h3-${partIndex}-${i}`} className="text-base font-semibold text-[rgb(var(--text))]">
            {inline}
          </h4>,
        );
      }
      i += 1;
      continue;
    }

    const imageMatch = line.match(IMAGE_ONLY_LINE_REGEX);
    if (imageMatch) {
      const alt = imageMatch[1];
      const src = imageMatch[2];
      nodes.push(
        <img
          key={`image-${partIndex}-${i}`}
          src={src}
          alt={alt || 'Embedded illustration'}
          loading="lazy"
          className="max-h-[460px] w-auto max-w-full rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] object-contain"
        />,
      );
      i += 1;
      continue;
    }

    if (LIST_REGEX.test(line)) {
      const listItems: ReactNode[] = [];
      let listIndex = i;
      while (listIndex < lines.length) {
        const listLine = lines[listIndex].trim();
        const listMatch = listLine.match(LIST_REGEX);
        if (!listMatch) break;
        listItems.push(
          <li key={`li-${partIndex}-${listIndex}`} className="leading-relaxed text-[rgb(var(--text))]">
            {parseInline(listMatch[1].trim(), `li-${partIndex}-${listIndex}`)}
          </li>,
        );
        listIndex += 1;
      }
      nodes.push(
        <ul key={`ul-${partIndex}-${i}`} className="list-inside list-disc space-y-1 break-words text-sm">
          {listItems}
        </ul>,
      );
      i = listIndex;
      continue;
    }

    if (QUOTE_REGEX.test(line)) {
      const quoteLines: string[] = [];
      let quoteIndex = i;
      while (quoteIndex < lines.length) {
        const quoteLine = lines[quoteIndex].trim();
        const quoteMatch = quoteLine.match(QUOTE_REGEX);
        if (!quoteMatch) break;
        quoteLines.push(quoteMatch[1].trim());
        quoteIndex += 1;
      }

      nodes.push(
        <blockquote
          key={`quote-${partIndex}-${i}`}
          className="rounded-r-lg border-l-4 border-[rgb(var(--accent))] bg-[rgb(var(--accent))]/5 px-4 py-2 break-words text-sm text-[rgb(var(--text))]"
        >
          {parseInline(quoteLines.join(' '), `quote-${partIndex}-${i}`)}
        </blockquote>,
      );
      i = quoteIndex;
      continue;
    }

    const paragraphLines = [line];
    let paragraphIndex = i + 1;
    while (paragraphIndex < lines.length) {
      const next = lines[paragraphIndex].trim();
      if (!next) break;
      if (HEADING_REGEX.test(next) || LIST_REGEX.test(next) || QUOTE_REGEX.test(next) || IMAGE_ONLY_LINE_REGEX.test(next)) {
        break;
      }
      paragraphLines.push(next);
      paragraphIndex += 1;
    }

    nodes.push(
      <p key={`p-${partIndex}-${i}`} className="break-words text-sm leading-relaxed text-[rgb(var(--text))]">
        {parseInline(paragraphLines.join(' '), `p-${partIndex}-${i}`)}
      </p>,
    );
    i = paragraphIndex;
  }

  return nodes;
}

function splitContent(content: string): ContentPart[] {
  const normalizedContent = content.replace(/\r\n/g, '\n');
  const trimmedContent = normalizedContent.trim();

  if (
    trimmedContent.length >= 2 &&
    trimmedContent.startsWith('`') &&
    trimmedContent.endsWith('`') &&
    trimmedContent.includes('\n')
  ) {
    const inner = trimmedContent.slice(1, -1).trim();
    if (inner) {
      return [{ type: 'code', value: inner }];
    }
  }

  if (
    trimmedContent.length >= 4 &&
    trimmedContent.startsWith('\\`') &&
    trimmedContent.endsWith('\\`') &&
    trimmedContent.includes('\n')
  ) {
    const inner = trimmedContent.slice(2, -2).trim();
    if (inner) {
      return [{ type: 'code', value: inner }];
    }
  }

  const parts: ContentPart[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const re = new RegExp(CODE_BLOCK_REGEX.source, 'g');
  while ((match = re.exec(normalizedContent)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: normalizedContent.slice(lastIndex, match.index) });
    }
    parts.push({
      type: 'code',
      value: match[2].replace(/\n$/, ''),
      language: match[1] || undefined,
    });
    lastIndex = re.lastIndex;
  }

  if (lastIndex < normalizedContent.length) {
    parts.push({ type: 'text', value: normalizedContent.slice(lastIndex) });
  }

  if (parts.length === 0 && normalizedContent.trim()) {
    parts.push({ type: 'text', value: normalizedContent });
  }

  return parts;
}

export default function RichContent({ content, className = '' }: RichContentProps) {
  const parts = splitContent(content);

  return (
    <div className={`w-full min-w-0 max-w-full overflow-hidden space-y-4 text-[rgb(var(--text))] ${className}`}>
      {parts.map((part, index) =>
        part.type === 'code' ? (
          <CodeBlock key={`code-${index}`} code={part.value} language={part.language} />
        ) : (
          <div key={`text-${index}`} className="space-y-3">
            {renderTextBlock(part.value, index)}
          </div>
        ),
      )}
    </div>
  );
}
