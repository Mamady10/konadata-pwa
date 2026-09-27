import { notFound } from 'next/navigation';
import { requireBtpPage } from '@/lib/btp/require-btp-page';
import { getBtpQuote, getBtpQuoteAccess, listBtpPriceCatalog } from '@/lib/actions/btp-quotes';
import { QuoteAccessNotice } from '../quote-access-notice';
import { QuoteEditorClient } from './quote-editor-client';

interface Props {
  params: Promise<{ quoteId: string }>;
}

export default async function BtpQuoteEditorPage({ params }: Props) {
  const { quoteId } = await params;
  await requireBtpPage('devis');
  const access = await getBtpQuoteAccess();
  if (!access.allowed) {
    return <QuoteAccessNotice migrationMissing={access.migrationMissing} isDirector={access.isDirector} />;
  }

  const [quoteRes, catalogRes] = await Promise.all([getBtpQuote(quoteId), listBtpPriceCatalog()]);
  if ('error' in quoteRes) {
    if (quoteRes.error === 'Devis introuvable.') notFound();
    return <QuoteAccessNotice message={quoteRes.error} />;
  }

  return (
    <QuoteEditorClient
      key={quoteRes.quote.id}
      initialQuote={quoteRes.quote}
      catalog={'error' in catalogRes ? [] : catalogRes.items}
      isDirector={access.isDirector}
    />
  );
}
