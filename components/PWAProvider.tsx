'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  getPendingFormsCount,
  queueFormViaSW,
  requestFormSync,
} from '@/lib/offline-forms';

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') return;
    if (!('serviceWorker' in navigator)) return;

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none',
        });

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (
              newWorker.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              newWorker.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });

        let reloaded = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (reloaded) return;
          reloaded = true;
          window.location.reload();
        });

        if (registration.active) {
          registration.active.postMessage({ type: 'CACHE_SHELL' });
        }
      } catch (err) {
        console.error('[PWA] Échec enregistrement SW:', err);
      }
    };

    if (document.readyState === 'complete') {
      register();
    } else {
      window.addEventListener('load', register);
      return () => window.removeEventListener('load', register);
    }
  }, []);

  return null;
}

export function OfflineIndicator() {
  const [online, setOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  const refreshPending = useCallback(async () => {
    try {
      const count = await getPendingFormsCount();
      setPendingCount(count);
    } catch {
      /* IndexedDB indisponible */
    }
  }, []);

  useEffect(() => {
    setOnline(navigator.onLine);

    const handleOnline = async () => {
      setOnline(true);
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready;
        await requestFormSync(reg);
      }
      refreshPending();
    };

    const handleOffline = () => setOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    refreshPending();

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (
          event.data?.type === 'FORM_SYNCED' ||
          event.data?.type === 'SYNC_COMPLETE'
        ) {
          refreshPending();
        }
      });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [refreshPending]);

  if (online && pendingCount === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-0 inset-x-0 z-50 px-4 py-2 text-center text-sm font-medium"
      style={{
        background: online ? '#1E3A5F' : '#991B1B',
        color: '#F8FAFC',
      }}
    >
      {!online && '📡 Mode hors-ligne — vos données sont sauvegardées localement'}
      {online && pendingCount > 0 &&
        `⏳ ${pendingCount} formulaire${pendingCount > 1 ? 's' : ''} en attente d'envoi`}
    </div>
  );
}

interface OfflineFormProps extends Omit<React.FormHTMLAttributes<HTMLFormElement>, 'onSubmit'> {
  action: string;
  method?: 'POST' | 'PUT' | 'PATCH';
  children: React.ReactNode;
  onSubmit?: React.SubmitEventHandler<HTMLFormElement>;
}

/**
 * Wrapper de formulaire avec persistance hors-ligne automatique.
 */
export function OfflineForm({
  action,
  method = 'POST',
  onSubmit,
  children,
  ...props
}: OfflineFormProps) {
  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    if (!navigator.onLine && 'serviceWorker' in navigator) {
      e.preventDefault();

      const form = e.currentTarget;
      const formData = new FormData(form);
      const body: Record<string, string> = {};
      formData.forEach((value, key) => {
        body[key] = String(value);
      });

      const reg = await navigator.serviceWorker.ready;
      await queueFormViaSW(reg, {
        url: action,
        method,
        body,
        headers: { 'Content-Type': 'application/json' },
      });

      form.reset();
      alert(
        'Pas de connexion. Votre formulaire a été enregistré et sera envoyé automatiquement.'
      );
      return;
    }

    onSubmit?.(e);
  };

  return (
    <form action={action} method={method} onSubmit={handleSubmit} {...props}>
      {children}
    </form>
  );
}
