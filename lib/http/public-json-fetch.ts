const DEFAULT_TIMEOUT_MS = 30_000;

export type PublicJsonResult<T> =
  | { ok: true; data: T; status: number }
  | { ok: false; error: string; status?: number };

/**
 * POST JSON vers une route API publique avec garde-fous démo :
 * - pas de redirection silencieuse (middleware / login)
 * - réponse JSON attendue
 * - timeout réseau
 */
export async function postPublicJson<T>(
  path: string,
  body: unknown,
  options?: { timeoutMs?: number }
): Promise<PublicJsonResult<T>> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      redirect: 'manual',
      signal: controller.signal,
      body: JSON.stringify(body),
    });

    if (res.type === 'opaqueredirect' || (res.status >= 300 && res.status < 400)) {
      return {
        ok: false,
        status: res.status,
        error: 'Accès refusé par le serveur. Rechargez la page ou contactez le support.',
      };
    }

    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      return {
        ok: false,
        status: res.status,
        error: 'Réponse serveur invalide. Réessayez dans un instant.',
      };
    }

    const data = (await res.json()) as T;
    if (!res.ok) {
      const message =
        typeof data === 'object' &&
        data !== null &&
        'error' in data &&
        typeof (data as { error?: unknown }).error === 'string'
          ? (data as { error: string }).error
          : 'Requête impossible';
      return { ok: false, status: res.status, error: message };
    }

    return { ok: true, data, status: res.status };
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      return { ok: false, error: 'Délai dépassé. Vérifiez votre connexion et réessayez.' };
    }
    return { ok: false, error: 'Connexion impossible. Vérifiez votre réseau et réessayez.' };
  } finally {
    clearTimeout(timer);
  }
}
