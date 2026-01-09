import type { ApiError } from './types';

export function extractErrorMessage(err: unknown): string {
  if (typeof err === 'object' && err !== null && 'error' in err) {
    const e = err as ApiError;
    return e.error?.message ?? 'Unbekannter Fehler.';
  }
  return 'Unbekannter Fehler.';
}
