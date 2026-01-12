import type { ApiError } from './types';

type UnknownRecord = Record<string, unknown>;

function isRecord(v: unknown): v is UnknownRecord {
  return typeof v === 'object' && v !== null;
}

function isApiError(err: unknown): err is ApiError {
  if (!isRecord(err)) return false;
  if (!('error' in err)) return false;

  const inner = (err as UnknownRecord).error;
  if (!isRecord(inner)) return false;

  const code = inner.code;
  const message = inner.message;

  return typeof code === 'string' && typeof message === 'string';
}

function stringifyDetails(details: unknown): string {
  if (!details) return '';
  if (typeof details === 'string') return details;

  if (isRecord(details)) {
    try {
      return JSON.stringify(details);
    } catch {
      return '';
    }
  }

  return '';
}

/**
 * Liefert eine nutzerfreundliche Fehlermeldung aus:
 * - ApiError Contract { error: { code, message, details? } }
 * - native Error
 * - fallback
 */
export function extractErrorMessage(err: unknown): string {
  if (isApiError(err)) {
    const code = err.error.code || 'UNKNOWN';
    const msg = err.error.message || 'Unbekannter Fehler.';
    const details = stringifyDetails(err.error.details);
    return details ? `${code}: ${msg} (${details})` : `${code}: ${msg}`;
  }

  if (err instanceof Error) return err.message;

  return 'Unbekannter Fehler.';
}

/**
 * Optional: Details extrahieren (z. B. für Feldfehler).
 */
export function extractErrorDetails(err: unknown): Record<string, string> | null {
  if (!isApiError(err)) return null;

  const details = err.error.details;
  if (!details || typeof details !== 'object') return null;

  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(details as Record<string, unknown>)) {
    if (typeof v === 'string') out[k] = v;
  }

  return Object.keys(out).length > 0 ? out : null;
}
