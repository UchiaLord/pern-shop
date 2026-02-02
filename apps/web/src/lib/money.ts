const formatterCache = new Map<string, Intl.NumberFormat>();

function getFormatter(currency: string) {
  const key = currency.toUpperCase();
  const existing = formatterCache.get(key);
  if (existing) return existing;

  // Default locale: Browser locale. Für AT typischerweise de-AT.
  // Wir formatieren in "currency". Wenn currency invalide ist, fallback.
  let fmt: Intl.NumberFormat;
  try {
    fmt = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: key,
      currencyDisplay: 'symbol',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } catch {
    // Fallback (wenn currency code ungültig ist)
    fmt = new Intl.NumberFormat(undefined, {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  formatterCache.set(key, fmt);
  return fmt;
}

/**
 * Cents (Integer) -> Currency String.
 * Beispiel: (1999, 'EUR') => "€19.99" (abhängig von Locale)
 */
export function formatCents(cents: number, currency: string): string {
  const safeCurrency = (currency || 'EUR').toUpperCase();
  const n = Number.isFinite(cents) ? cents : 0;
  const major = n / 100;

  const fmt = getFormatter(safeCurrency);
  const out = fmt.format(major);

  // Wenn wir im Fallback-Formatter sind, hängt kein currency symbol dran.
  // Dann fügen wir es minimal an.
  if (!out.includes(safeCurrency) && fmt.resolvedOptions().style !== 'currency') {
    return `${out} ${safeCurrency}`;
  }

  return out;
}