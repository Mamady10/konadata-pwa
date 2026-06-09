'use client';

import { useState } from 'react';
import { getDocumentUrl } from '@/lib/actions/storage';
import { ExternalLink } from 'lucide-react';

interface Props {
  fileName: string;
  filePath: string | null;
}

export function EnrollmentDocumentLink({ fileName, filePath }: Props) {
  const [loading, setLoading] = useState(false);

  async function openFile() {
    if (!filePath) return;
    setLoading(true);
    try {
      const url = await getDocumentUrl(filePath);
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
    } finally {
      setLoading(false);
    }
  }

  if (!filePath) {
    return <span className="truncate font-medium">{fileName}</span>;
  }

  return (
    <button
      type="button"
      onClick={() => void openFile()}
      disabled={loading}
      className="truncate font-medium text-primary hover:underline inline-flex items-center gap-1 text-left max-w-full"
      title="Ouvrir le document"
    >
      {loading ? 'Ouverture…' : fileName}
      <ExternalLink className="h-3 w-3 shrink-0" />
    </button>
  );
}
