'use client';

import { useState } from 'react';

import { Highlight, themes } from 'prism-react-renderer';

type CodeBlockProps = {
  code: string;
  language?: string;
  className?: string;
};

const defaultLanguage = 'typescript';

export default function CodeBlock({ code, language = defaultLanguage, className = '' }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code.trim());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Highlight theme={themes.github} code={code.trim()} language={language}>
      {({ className: innerClassName, style, tokens, getLineProps, getTokenProps }) => (
        <div className="relative w-full min-w-0 max-w-full">
          <button
            type="button"
            onClick={() => {
              void handleCopy();
            }}
            className="absolute right-3 top-3 z-10 rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-2 py-1 text-xs font-medium text-[rgb(var(--muted))] transition hover:text-[rgb(var(--text))]"
            aria-label="Copy code"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
          <pre
            className={`w-full max-w-full overflow-x-auto rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-3 pt-11 text-xs sm:text-sm ${innerClassName} ${className}`}
            style={{
              ...style,
              whiteSpace: 'pre-wrap',
              overflowWrap: 'anywhere',
              wordBreak: 'break-word',
            }}
          >
            <code className="block w-full font-mono">
              {tokens.map((line, i) => (
                <div key={i} {...getLineProps({ line })}>
                  {line.map((token, key) => (
                    <span key={key} {...getTokenProps({ token })} />
                  ))}
                </div>
              ))}
            </code>
          </pre>
        </div>
      )}
    </Highlight>
  );
}
