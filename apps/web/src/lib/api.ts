async function request<T>(input: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);

  // Set JSON content-type only when we actually send JSON (string body).
  const hasBody = init.body != null;
  const bodyIsString = typeof init.body === 'string';
  if (hasBody && bodyIsString && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(input, {
    ...init,
    headers,
    credentials: 'include',
  });

  const contentType = res.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');

  const data = isJson ? ((await res.json()) as unknown) : await res.text().catch(() => '');

  if (!res.ok) {
    if (isJson && data && typeof data === 'object') {
      throw data as ApiError;
    }

    // Non-JSON error (proxy, html, text, etc.)
    const message =
      typeof data === 'string' && data.trim().length > 0
        ? data.slice(0, 500)
        : `HTTP ${res.status} ${res.statusText}`;

    const err: ApiError = { error: { code: 'HTTP_ERROR', message } };
    throw err;
  }

  return data as T;
}