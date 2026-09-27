'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

function formatDisplay(value: number, decimals: number): string {
  if (!value) return '';
  return value
    .toLocaleString('fr-FR', { maximumFractionDigits: decimals })
    .replace(/\u202F|\u00a0/g, ' ');
}

function parseInput(raw: string): number {
  const cleaned = raw.replace(/[\s\u202F\u00a0]/g, '').replace(',', '.');
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

interface Props {
  value: number;
  onChange: (value: number) => void;
  decimals?: number;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  onEnter?: () => void;
  ariaLabel?: string;
}

/** Saisie de montants/quantités : « 2 100 000 » affiché, espaces et virgules acceptés. */
export function QuoteNumberInput({
  value,
  onChange,
  decimals = 3,
  disabled,
  className,
  placeholder,
  onEnter,
  ariaLabel,
}: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      type="text"
      inputMode="decimal"
      aria-label={ariaLabel}
      disabled={disabled}
      placeholder={placeholder}
      value={draft ?? formatDisplay(value, decimals)}
      onFocus={() => setDraft(value ? String(value).replace('.', ',') : '')}
      onChange={(e) => {
        setDraft(e.target.value);
        onChange(parseInput(e.target.value));
      }}
      onBlur={() => setDraft(null)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && onEnter) {
          e.preventDefault();
          onEnter();
        }
      }}
      className={cn(
        'h-8 w-full rounded-md border border-input bg-background px-2 text-right text-sm tabular-nums',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60',
        className
      )}
    />
  );
}
