import type { ApiError, Cart, OrderDetails, OrderSummary, Product, User } from './types';

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    credentials: 'include',
  });

  const contentType = res.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');
  const data = isJson ? ((await res.json()) as unknown) : null;

  if (!res.ok) {
    const err = (data ?? { error: { code: 'UNKNOWN', message: 'Unbekannter Fehler.' } }) as ApiError;
    throw err;
  }

  return data as T;
}

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
