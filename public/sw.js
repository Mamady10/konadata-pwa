/**
 * Service Worker — Guinea PWA
 * Cache agressif du shell UI + mode hors-ligne avec persistance des formulaires.
 */

const CACHE_VERSION = 'guinea-pwa-v1';
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const OFFLINE_URL = '/offline.html';

/** URLs du shell à précharger à l'installation */
const SHELL_ASSETS = [
  '/',
  OFFLINE_URL,
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

/** IndexedDB pour formulaires en attente */
const FORMS_DB_NAME = 'guinea-pwa-offline';
const FORMS_STORE = 'pending-forms';
const FORMS_DB_VERSION = 1;

// ---------------------------------------------------------------------------
// IndexedDB helpers (Service Worker context)
// ---------------------------------------------------------------------------

function openFormsDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(FORMS_DB_NAME, FORMS_DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
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

async function savePendingForm(formData) {
  const db = await openFormsDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FORMS_STORE, 'readwrite');
    const store = tx.objectStore(FORMS_STORE);
    const record = {
      ...formData,
      status: 'pending',
      createdAt: Date.now(),
      retries: 0,
    };
    const req = store.add(record);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getAllPendingForms() {
  const db = await openFormsDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FORMS_STORE, 'readonly');
    const store = tx.objectStore(FORMS_STORE);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function deletePendingForm(id) {
  const db = await openFormsDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FORMS_STORE, 'readwrite');
    const store = tx.objectStore(FORMS_STORE);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function markFormFailed(id, error) {
  const db = await openFormsDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FORMS_STORE, 'readwrite');
    const store = tx.objectStore(FORMS_STORE);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const record = getReq.result;
      if (!record) return resolve();
      record.retries = (record.retries || 0) + 1;
      record.lastError = error;
      record.status = record.retries >= 5 ? 'failed' : 'pending';
      store.put(record);
      resolve();
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

// ---------------------------------------------------------------------------
// Cache helpers
// ---------------------------------------------------------------------------

async function cacheShellAssets() {
  const cache = await caches.open(SHELL_CACHE);
  await cache.addAll(SHELL_ASSETS);
}

async function cacheResponse(request, response) {
  if (!response || response.status !== 200 || response.type === 'opaque') return;
  const cache = await caches.open(RUNTIME_CACHE);
  await cache.put(request, response.clone());
}

function isNavigationRequest(request) {
  return request.mode === 'navigate';
}

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.webp') ||
    url.pathname.endsWith('.avif') ||
    url.pathname.endsWith('.svg')
  );
}

function isApiRequest(url) {
  return url.pathname.startsWith('/api/');
}

// ---------------------------------------------------------------------------
// Stratégies de fetch
// ---------------------------------------------------------------------------

/** Cache-first : assets statiques (shell UI) */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    await cacheResponse(request, response);
    return response;
  } catch {
    return caches.match(OFFLINE_URL);
  }
}

/** Network-first avec repli cache : navigation */
async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    const offline = await caches.match(OFFLINE_URL);
    if (offline) return offline;
    return new Response('Hors ligne — contenu indisponible.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

/** Network-first pour API avec mise en file d'attente si hors-ligne */
async function networkFirstApi(request) {
  try {
    return await fetch(request);
  } catch {
    if (request.method !== 'GET') {
      const body = await request.clone().text();
      let parsedBody = body;
      try {
        parsedBody = JSON.parse(body);
      } catch {
        /* corps brut */
      }
      await savePendingForm({
        url: request.url,
        method: request.method,
        headers: Object.fromEntries(request.headers.entries()),
        body: parsedBody,
      });
      return new Response(
        JSON.stringify({
          offline: true,
          queued: true,
          message: 'Formulaire enregistré localement. Envoi automatique à la reconnexion.',
        }),
        {
          status: 202,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ offline: true, error: 'Pas de connexion' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// ---------------------------------------------------------------------------
// Synchronisation des formulaires en attente
// ---------------------------------------------------------------------------

async function syncPendingForms() {
  const pending = await getAllPendingForms();
  const stillPending = pending.filter((f) => f.status === 'pending');

  for (const form of stillPending) {
    try {
      const headers = new Headers(form.headers || {});
      if (!headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }

      const body =
        typeof form.body === 'string' ? form.body : JSON.stringify(form.body);

      const response = await fetch(form.url, {
        method: form.method || 'POST',
        headers,
        body: form.method === 'GET' ? undefined : body,
      });

      if (response.ok) {
        await deletePendingForm(form.id);
        await notifyClients({
          type: 'FORM_SYNCED',
          formId: form.id,
          url: form.url,
        });
      } else {
        await markFormFailed(form.id, `HTTP ${response.status}`);
      }
    } catch (err) {
      await markFormFailed(form.id, err.message || 'Network error');
    }
  }

  const remaining = await getAllPendingForms();
  await notifyClients({
    type: 'SYNC_COMPLETE',
    pendingCount: remaining.filter((f) => f.status === 'pending').length,
  });
}

async function notifyClients(message) {
  const clients = await self.clients.matchAll({ type: 'window' });
  clients.forEach((client) => client.postMessage(message));
}

// ---------------------------------------------------------------------------
// Événements Service Worker
// ---------------------------------------------------------------------------

self.addEventListener('install', (event) => {
  event.waitUntil(
    cacheShellAssets().then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => !key.startsWith(CACHE_VERSION))
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;

  if (isApiRequest(url)) {
    event.respondWith(networkFirstApi(request));
    return;
  }

  if (isNavigationRequest(request)) {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(
    fetch(request).catch(() => caches.match(request).then((r) => r || caches.match(OFFLINE_URL)))
  );
});

/** Background Sync API — envoi différé des formulaires */
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-pending-forms') {
    event.waitUntil(syncPendingForms());
  }
});

/** Messages depuis le client (enregistrement manuel de formulaire) */
self.addEventListener('message', (event) => {
  const { type, payload } = event.data || {};

  if (type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  if (type === 'CACHE_SHELL') {
    event.waitUntil(cacheShellAssets());
    return;
  }

  if (type === 'QUEUE_FORM') {
    event.waitUntil(
      savePendingForm(payload).then((id) => {
        event.source?.postMessage({ type: 'FORM_QUEUED', formId: id });
        if ('sync' in self.registration) {
          return self.registration.sync.register('sync-pending-forms');
        }
      })
    );
    return;
  }

  if (type === 'SYNC_FORMS') {
    event.waitUntil(syncPendingForms());
    return;
  }

  if (type === 'GET_PENDING_COUNT') {
    event.waitUntil(
      getAllPendingForms().then((forms) => {
        const count = forms.filter((f) => f.status === 'pending').length;
        event.source?.postMessage({ type: 'PENDING_COUNT', count });
      })
    );
  }
});

// La synchronisation est déclenchée par Background Sync ou message client SYNC_FORMS
