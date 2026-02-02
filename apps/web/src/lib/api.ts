import type { ApiError, Cart, OrderDetails, OrderSummary, Product, User } from './types';

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

type CreateProductInput = {
  sku: string;
  name: string;
  description?: string | null;
  priceCents: number;
  currency?: string;
  isActive?: boolean;
};

type PatchProductInput = Partial<
  Pick<Product, 'sku' | 'name' | 'description' | 'priceCents' | 'currency' | 'isActive'>
>;

export const api = {
  auth: {
    register: (email: string, password: string) =>
      request<{ user: User }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    login: (email: string, password: string) =>
      request<{ user: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    logout: () => request<void>('/auth/logout', { method: 'POST' }),
    me: () => request<{ user: User }>('/auth/me'),
  },

  products: {
    list: () => request<{ products: Product[] }>('/products'),
    get: (id: number) => request<{ product: Product }>(`/products/${id}`),

    // admin-only
    create: (input: CreateProductInput) =>
      request<{ product: Product }>('/products', {
        method: 'POST',
        body: JSON.stringify(input),
      }),

    // admin-only
    patch: (id: number, patch: PatchProductInput) =>
      request<{ product: Product }>(`/products/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
  },

  cart: {
    get: () => request<{ cart: Cart }>('/cart'),
    upsertItem: (productId: number, quantity: number) =>
      request<{ ok: true }>('/cart/items', {
        method: 'POST',
        body: JSON.stringify({ productId, quantity }),
      }),
    removeItem: (productId: number) => request<void>(`/cart/items/${productId}`, { method: 'DELETE' }),
  },

  orders: {
    checkout: () => request<OrderDetails>('/orders', { method: 'POST' }),
    listMine: () => request<{ orders: OrderSummary[] }>('/orders/me'),
    get: (id: number) => request<OrderDetails>(`/orders/${id}`),
  },
};