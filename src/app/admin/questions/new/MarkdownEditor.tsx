'use client';

import {
  Bold,
  Code2,
  Copy,
  Eye,
  FileCode2,
  Heading2,
  Highlighter,
  ImagePlus,
  Italic,
  Link2,
  List,
  Pencil,
  Quote,
  Table2,
} from 'lucide-react';
import { useRef, useState, type ChangeEvent } from 'react';

import RichContent from '@/components/rich-content';

type MarkdownEditorProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  required?: boolean;
  placeholder?: string;
  helperText?: string;
  uploadImage: (file: File) => Promise<string>;
};

function toolbarButtonClass(active = false) {
  return `inline-flex h-8 items-center justify-center rounded-md border px-2 text-xs font-medium transition ${
    active
      ? 'border-[rgb(var(--accent))] bg-[rgb(var(--accent))]/10 text-[rgb(var(--accent))]'
      : 'border-[rgb(var(--border))] text-[rgb(var(--muted))] hover:bg-[rgb(var(--border))]/20 hover:text-[rgb(var(--text))]'
  }`;
}

export default function MarkdownEditor({
  label,
  value,
  onChange,
  rows = 6,
  required = false,
  placeholder,
  helperText,
  uploadImage,
}: MarkdownEditorProps) {
  const [preview, setPreview] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [copyState, setCopyState] = useState<'idle' | 'success' | 'error'>('idle');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const applyWrap = (before: string, after = before, fallback = 'text') => {
    const el = textareaRef.current;
    if (!el) return;

    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? start;
    const selected = value.slice(start, end);
    const next = `${value.slice(0, start)}${before}${selected || fallback}${after}${value.slice(end)}`;
    onChange(next);

    requestAnimationFrame(() => {
      el.focus();
      const cursorStart = start + before.length;
      const cursorEnd = selected ? cursorStart + selected.length : cursorStart + fallback.length;
      el.setSelectionRange(cursorStart, cursorEnd);
    });
  };

  const applyPrefix = (prefix: string, fallback = 'item') => {
    const el = textareaRef.current;
    if (!el) return;

    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? start;
    const selected = value.slice(start, end);
    const target = selected || fallback;
    const lines = target.split('\n').map((line) => `${prefix}${line}`);
    const replacement = lines.join('\n');
    const next = `${value.slice(0, start)}${replacement}${value.slice(end)}`;
    onChange(next);

    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start, start + replacement.length);
    });
  };

  const applyCodeBlock = () => {
    const block = '```ts\n// your code\n```';
    const el = textareaRef.current;
    if (!el) {
      onChange(value ? `${value}\n\n${block}` : block);
      return;
    }

    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? start;
    const selected = value.slice(start, end);
    const body = selected || '// your code';
    const replacement = `\`\`\`ts\n${body}\n\`\`\``;
    const next = `${value.slice(0, start)}${replacement}${value.slice(end)}`;
    onChange(next);

    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + 6, start + replacement.length - 4);
    });
  };

  const insertTextAtCursor = (text: string) => {
    const el = textareaRef.current;
    if (!el) {
      onChange(value ? `${value}\n${text}` : text);
      return;
    }

    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? start;
    const next = `${value.slice(0, start)}${text}${value.slice(end)}`;
    onChange(next);

    requestAnimationFrame(() => {
      el.focus();
      const cursor = start + text.length;
      el.setSelectionRange(cursor, cursor);
    });
  };

  const insertTable = () => {
    const table = `\n| Column | Value |\n| --- | --- |\n| Item 1 | Description |\n| Item 2 | Description |\n`;
    insertTextAtCursor(table);
  };

  const copyMarkdownSnippet = async () => {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? 0;
    const end = el?.selectionEnd ?? 0;

    const selected = end > start ? value.slice(start, end) : '';
    const snippet = selected || value || '```ts\n// markdown snippet\n```';

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(snippet);
      } else {
        const temp = document.createElement('textarea');
        temp.value = snippet;
        temp.setAttribute('readonly', 'true');
        temp.style.position = 'fixed';
        temp.style.opacity = '0';
        document.body.appendChild(temp);
        temp.select();
        document.execCommand('copy');
        document.body.removeChild(temp);
      }
      setCopyState('success');
    } catch {
      setCopyState('error');
    } finally {
      window.setTimeout(() => setCopyState('idle'), 1600);
    }
  };

  const onSelectImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Image must be 5MB or smaller.');
      event.target.value = '';
      return;
    }

    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      setUploadError('Only jpg/jpeg/png/webp/gif files are supported.');
      event.target.value = '';
      return;
    }

    setUploadError(null);
    setUploadingImage(true);
    setUploadProgress(20);
    try {
      setUploadProgress(70);
      const url = await uploadImage(file);
      insertTextAtCursor(`\n![${file.name}](${url})\n`);
      setUploadProgress(100);
      window.setTimeout(() => setUploadProgress(0), 500);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Failed to upload image.');
    } finally {
      setUploadingImage(false);
      event.target.value = '';
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="block text-sm font-medium text-[rgb(var(--text))]">
          {label} {required ? '*' : ''}
        </label>
        <div className="inline-flex rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-1">
          <button
            type="button"
            onClick={() => setPreview(false)}
            className={toolbarButtonClass(!preview)}
            title="Write mode"
            aria-label="Write mode"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setPreview(true)}
            className={toolbarButtonClass(preview)}
            title="Preview mode"
            aria-label="Preview mode"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {!preview && (
        <>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button type="button" onClick={() => applyWrap('**')} className={toolbarButtonClass()} title="Bold text">
              <Bold className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={() => applyWrap('*')} className={toolbarButtonClass()} title="Italic text">
              <Italic className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={() => applyPrefix('## ', 'Heading')} className={toolbarButtonClass()} title="Heading">
              <Heading2 className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={() => applyWrap('==', '==', 'highlight')} className={toolbarButtonClass()} title="Highlight text">
              <Highlighter className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => applyWrap('[', '](https://example.com)', 'link text')}
              className={toolbarButtonClass()}
              title="Insert link"
            >
              <Link2 className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={() => applyWrap('`')} className={toolbarButtonClass()} title="Inline code">
              <Code2 className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={applyCodeBlock} className={toolbarButtonClass()} title="Code block">
              <FileCode2 className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={() => applyPrefix('- ', 'list item')} className={toolbarButtonClass()} title="Bullet list">
              <List className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={() => applyPrefix('> ', 'quote')} className={toolbarButtonClass()} title="Quote block">
              <Quote className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={insertTable} className={`${toolbarButtonClass()} gap-1.5 px-2.5`} title="Insert markdown table">
              <Table2 className="h-3.5 w-3.5" />
              <span>Table</span>
            </button>
            <button
              type="button"
              onClick={() => {
                void copyMarkdownSnippet();
              }}
              className={`${toolbarButtonClass()} gap-1.5 px-2.5`}
              title="Copy selected markdown snippet"
            >
              <Copy className="h-3.5 w-3.5" />
              <span>{copyState === 'success' ? 'Copied' : copyState === 'error' ? 'Retry' : 'Copy snippet'}</span>
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingImage}
              className={toolbarButtonClass()}
              title="Upload image"
            >
              <ImagePlus className="h-3.5 w-3.5" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(event) => {
                void onSelectImage(event);
              }}
            />
            <span className="ml-2 text-xs text-[rgb(var(--muted))]">
              {uploadingImage ? 'Uploading image…' : 'Supports bold, code blocks, tables, ==highlight==, and images'}
            </span>
          </div>

          <div
            className="mt-2 rounded-lg border border-dashed border-[rgb(var(--border))]"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const file = event.dataTransfer.files?.[0];
              if (!file) return;
              const syntheticEvent = {
                target: {
                  files: [file],
                  value: '',
                },
              } as unknown as ChangeEvent<HTMLInputElement>;
              void onSelectImage(syntheticEvent);
            }}
          >
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(event) => onChange(event.target.value)}
              required={required}
              rows={rows}
              className="w-full rounded-lg border-0 bg-[rgb(var(--card))] px-3 py-2 text-sm text-[rgb(var(--text))] focus:outline-none focus:ring-1 focus:ring-[rgb(var(--accent))]"
              placeholder={placeholder}
            />
          </div>
        </>
      )}

      {preview && (
        <div className="mt-2 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-4">
          {value.trim() ? (
            <RichContent content={value} className="text-sm" />
          ) : (
            <p className="text-sm text-[rgb(var(--muted))]">Nothing to preview yet.</p>
          )}
        </div>
      )}

      {uploadError ? <p className="mt-2 text-xs text-red-600">{uploadError}</p> : null}
      {uploadingImage ? (
        <p className="mt-2 text-xs text-[rgb(var(--muted))]">Uploading image... {uploadProgress}%</p>
      ) : null}
      {helperText ? <p className="mt-2 text-xs text-[rgb(var(--muted))]">{helperText}</p> : null}
    </div>
  );
}
