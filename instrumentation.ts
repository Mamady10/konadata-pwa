/**
 * Exécuté au démarrage du serveur Next.js.
 * Corrige « self is not defined » dans le bundle middleware (Windows / dev).
 */
export async function register() {
  if (typeof globalThis !== 'undefined') {
    const g = globalThis as typeof globalThis & { self?: typeof globalThis };
    if (typeof g.self === 'undefined') {
      g.self = globalThis as Window & typeof globalThis;
    }
  }
}
