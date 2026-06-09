'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

interface Props {
  url: string;
  surveyTitle: string;
}

export function ParticipationQrCode({ url, surveyTitle }: Props) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    import('qrcode')
      .then((QRCode) =>
        QRCode.toDataURL(url, {
          width: 260,
          margin: 2,
          color: { dark: '#0f172a', light: '#ffffff' },
        })
      )
      .then((result) => {
        if (!cancelled) {
          setDataUrl(result);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  function downloadQr() {
    if (!dataUrl) return;
    const slug = surveyTitle
      .slice(0, 40)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w-]+/g, '-')
      .replace(/^-|-$/g, '');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `sondage-${slug || 'participation'}.png`;
    a.click();
  }

  return (
    <div className="flex flex-col items-center gap-2 shrink-0">
      {loading ? (
        <div className="w-[260px] h-[260px] bg-muted animate-pulse rounded-lg" />
      ) : dataUrl ? (
        <img
          src={dataUrl}
          alt="QR code de participation au sondage"
          className="rounded-lg border bg-white"
          width={260}
          height={260}
        />
      ) : (
        <p className="text-xs text-muted-foreground">QR code indisponible</p>
      )}
      <Button size="sm" variant="outline" onClick={downloadQr} disabled={!dataUrl}>
        <Download className="h-3 w-3 mr-1" />
        Télécharger le QR
      </Button>
      <p className="text-[10px] text-muted-foreground text-center max-w-[260px]">
        Publiez ce QR sur WhatsApp, Facebook, affiches ou réseaux sociaux.
      </p>
    </div>
  );
}
