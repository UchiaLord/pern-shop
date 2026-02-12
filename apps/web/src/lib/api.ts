// apps/web/src/lib/api.ts
import type {
  AdminOrderDetails,
  ApiError,
  Cart,
  OrderDetails,
  OrderStatus,
  OrderSummary,
  Product,
  User,
} from './types';

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

  const data = isJson ? await res.json().catch(() => null) : await res.text().catch(() => null);

  if (!res.ok) {
    const maybeApiError = data as ApiError | null;

    const err = new Error(
      maybeApiError?.error?.message ??
        (typeof data === 'string' ? data : `Request failed (${res.status})`),
    ) as Error & { code?: string; status?: number; details?: unknown };

    err.status = res.status;
    err.code = maybeApiError?.error?.code ?? 'UNKNOWN';
    err.details = maybeApiError?.error?.details;

    throw err;
  }

  return data as T;
}

type AuthInput = { email: string; password: string };

function normalizeAuthInput(a: string | AuthInput, b?: string): AuthInput {
  if (typeof a === 'string') return { email: a, password: b ?? '' };
  return a;
}

export const api = {
  auth: {
    register: (a: AuthInput | string, b?: string) => {
      const input = normalizeAuthInput(a, b);
      return request<{ user: User }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },

    login: (a: AuthInput | string, b?: string) => {
      const input = normalizeAuthInput(a, b);
      return request<{ user: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },

    me: () => request<{ user: User }>('/auth/me'),

    logout: () => request<void>('/auth/logout', { method: 'POST' }),
  },

  products: {
    // Public: active only
    list: () => request<{ products: Product[] }>('/products'),

    // Public: product details (active only)
    get: (id: number) => request<{ product: Product }>(`/products/${id}`),

    // Admin-only (same route, role protected)
    create: (input: {
      sku: string;
      name: string;
      description?: string | null;
      priceCents: number;
      currency: string;
      isActive?: boolean;
    }) =>
      request<{ product: Product }>('/products', {
        method: 'POST',
        body: JSON.stringify(input),
      }),

    deactivate: (id: number) =>
      request<{ product: Product }>(`/products/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: false }),
      }),

    patch: (
      id: number,
      input: Partial<
        Pick<Product, 'name' | 'priceCents' | 'currency' | 'isActive' | 'sku' | 'description'>
      >,
    ) =>
      request<{ product: Product }>(`/products/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
  },

  cart: {
    get: () => request<{ cart: Cart }>('/cart'),

    add: (input: { productId: number; quantity: number }) =>
      request<{ cart: Cart }>('/cart/items', { method: 'POST', body: JSON.stringify(input) }),

    remove: (productId: number) =>
      request<{ cart: Cart }>(`/cart/items/${productId}`, { method: 'DELETE' }),

    removeItem: (productId: number) =>
      request<{ cart: Cart }>(`/cart/items/${productId}`, { method: 'DELETE' }),

    upsertItem: (productId: number, quantity: number) => {
      if (quantity <= 0) {
        return request<{ cart: Cart }>(`/cart/items/${productId}`, { method: 'DELETE' });
      }
      return request<{ cart: Cart }>('/cart/items', {
        method: 'POST',
        body: JSON.stringify({ productId, quantity }),
      });
    },
  },

  orders: {
    // Backend: POST /orders
    checkout: () => request<OrderDetails>('/orders', { method: 'POST' }),

    // Backend: GET /orders/me
    listMine: () => request<{ orders: OrderSummary[] }>('/orders/me'),

    getMine: (id: number) => request<OrderDetails>(`/orders/${id}`),

    get: (id: number) => request<OrderDetails>(`/orders/${id}`),
  },

  payments: {
    // Backend: POST /payments/create-intent
    createIntent: () =>
      request<{ orderId: number; clientSecret: string }>('/payments/create-intent', {
        method: 'POST',
      }),
  },

  admin: {
    orders: {
      list: () => request<{ orders: OrderSummary[] }>('/admin/orders'),

      get: (id: number) => request<AdminOrderDetails>(`/admin/orders/${id}`),

      updateStatus: (id: number, input: { status: OrderStatus; reason?: string }) =>
        request<{ order: OrderSummary }>(`/admin/orders/${id}/status`, {
          method: 'PATCH',
          body: JSON.stringify(input),
        }),
    },

    products: {
      // Admin list: includes inactive
      list: () => request<{ products: Product[] }>('/admin/products'),

      // Create/patch are on /products with requireRole('admin')
      create: (input: {
        sku: string;
        name: string;
        description?: string | null;
        priceCents: number;
        currency: string;
        isActive?: boolean;
      }) =>
        request<{ product: Product }>('/products', {
          method: 'POST',
          body: JSON.stringify(input),
        }),

      patch: (
        id: number,
        input: Partial<
          Pick<Product, 'name' | 'priceCents' | 'currency' | 'isActive' | 'sku' | 'description'>
        >,
      ) =>
        request<{ product: Product }>(`/products/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(input),
        }),
    },
  },
};
