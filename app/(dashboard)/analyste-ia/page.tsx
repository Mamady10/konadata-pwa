import { redirect } from 'next/navigation';
import { getKonaAIChatConfig } from '@/lib/actions/kona-ai-chat';
import { resolveAssistantNavVisible } from '@/lib/ai/chat/assistant-nav-server';
import { AnalysteIAView } from '@/app/(dashboard)/analyste-ia/analyste-ia-view';

export default async function AnalysteIAPage() {
  const navVisible = await resolveAssistantNavVisible();
  if (!navVisible) {
    redirect('/parametres');
  }

  const config = await getKonaAIChatConfig();
  return <AnalysteIAView config={'error' in config ? null : config} configError={'error' in config ? config.error : null} />;
}
