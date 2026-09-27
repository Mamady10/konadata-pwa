import { Badge } from '@/components/ui/badge';
import { QUOTE_STATUS_LABELS, type QuoteStatus } from '@/lib/btp/quotes/quote-types';

const QUOTE_STATUS_CLASS: Record<QuoteStatus, string> = {
  draft: 'bg-slate-500/10 text-slate-700 border-slate-200',
  sent: 'bg-blue-500/10 text-blue-700 border-blue-200',
  accepted: 'bg-emerald-500/10 text-emerald-700 border-emerald-200',
  refused: 'bg-red-500/10 text-red-700 border-red-200',
  cancelled: 'bg-zinc-500/10 text-zinc-600 border-zinc-200',
};

export function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  return (
    <Badge variant="outline" className={QUOTE_STATUS_CLASS[status]}>
      {QUOTE_STATUS_LABELS[status]}
    </Badge>
  );
}
