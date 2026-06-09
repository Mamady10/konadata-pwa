export const FORMS_DB_NAME = 'guinea-pwa-offline';
export const FORMS_STORE = 'pending-forms';

export interface PendingForm {
  id?: number;
  url: string;
  method: string;
  headers?: Record<string, string>;
  body: unknown;
  status?: 'pending' | 'failed';
  createdAt?: number;
  retries?: number;
}

export function openFormsDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(FORMS_DB_NAME, 1);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(FORMS_STORE)) {
        const store = db.createObjectStore(FORMS_STORE, {
          keyPath: 'id',
          autoIncrement: true,
        });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        store.createIndex('status', 'status', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getPendingFormsCount(): Promise<number> {
  const db = await openFormsDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FORMS_STORE, 'readonly');
    const store = tx.objectStore(FORMS_STORE);
    const req = store.getAll();
    req.onsuccess = () => {
      const forms = (req.result as PendingForm[]) || [];
      resolve(forms.filter((f) => f.status === 'pending').length);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function queueFormViaSW(
  registration: ServiceWorkerRegistration,
  form: Omit<PendingForm, 'id'>
): Promise<number | null> {
  const sw = registration.active || registration.waiting || registration.installing;
  if (!sw) return null;

  return new Promise((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = (event) => {
      if (event.data?.type === 'FORM_QUEUED') {
        resolve(event.data.formId);
      }
    };
    sw.postMessage({ type: 'QUEUE_FORM', payload: form }, [channel.port2]);
    setTimeout(() => resolve(null), 3000);
  });
}

export async function requestFormSync(registration: ServiceWorkerRegistration) {
  const sw = registration.active;
  if (!sw) return;
  sw.postMessage({ type: 'SYNC_FORMS' });

  if ('sync' in registration) {
    try {
      const syncRegistration = registration as ServiceWorkerRegistration & {
        sync: { register: (tag: string) => Promise<void> };
      };
      await syncRegistration.sync.register('sync-pending-forms');
    } catch {
      /* Background Sync non supporté */
    }
  }
}
