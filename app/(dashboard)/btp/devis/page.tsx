import { requireBtpPage } from '@/lib/btp/require-btp-page';
import {
  getBtpQuoteAccess,
  listBtpPriceCatalog,
  listBtpQuoteAccessMembers,
  listBtpQuotes,
} from '@/lib/actions/btp-quotes';
import { DevisClient } from './devis-client';
import { QuoteAccessNotice } from './quote-access-notice';

export default async function Page() {
  await requireBtpPage('devis');
  const access = await getBtpQuoteAccess();
  if (!access.allowed) {
    return <QuoteAccessNotice migrationMissing={access.migrationMissing} isDirector={access.isDirector} />;
  }

  const [quotesRes, catalogRes, membersRes] = await Promise.all([
    listBtpQuotes(),
    listBtpPriceCatalog(),
    access.isDirector ? listBtpQuoteAccessMembers() : Promise.resolve(null),
  ]);
  if ('error' in quotesRes) return <QuoteAccessNotice message={quotesRes.error} />;

  return (
    <DevisClient
      quotes={quotesRes.quotes}
      catalog={'error' in catalogRes ? [] : catalogRes.items}
      members={membersRes && !('error' in membersRes) ? membersRes.members : []}
      isDirector={access.isDirector}
    />
  );
}
