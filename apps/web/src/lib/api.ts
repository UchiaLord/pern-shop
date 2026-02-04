// apps/web/src/lib/api.ts
import type {
  ApiError,
  Cart,
  OrderDetails,
  OrderSummary,
  Product,
  User,
  AdminOrderDetails,
  OrderStatus,
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

    // Normalize into thrown Error with code/message on it.
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
    // Backwards-compatible overload:
    // - register({email,password})
    // - register(email, password)
    register: (a: AuthInput | string, b?: string) => {
      const input = normalizeAuthInput(a, b);
      return request<{ user: User }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },

    // Backwards-compatible overload:
    // - login({email,password})
    // - login(email, password)
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
    list: () => request<{ products: Product[] }>('/products'),

    create: (input: { sku: string; name: string; priceCents: number; currency: string }) =>
      request<{ product: Product }>('/products', {
        method: 'POST',
        body: JSON.stringify(input),
      }),

    // Existing behavior
    deactivate: (id: number) =>
      request<{ product: Product }>(`/products/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: false }),
      }),

    // New: generic patch/update (needed by AdminProductsPage)
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

    // Backwards-compatible aliases used by older UI code
    removeItem: (productId: number) =>
      request<{ cart: Cart }>(`/cart/items/${productId}`, { method: 'DELETE' }),

    // upsertItem(productId, qty)
    // Assumption: POST /cart/items is an upsert (common).
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
    // Backend: POST /orders (Checkout)
    checkout: () => request<OrderDetails>('/orders', { method: 'POST' }),

    // Backend: GET /orders/me
    listMine: () => request<{ orders: OrderSummary[] }>('/orders/me'),

    // Backend: GET /orders/:id
    getMine: (id: number) => request<OrderDetails>(`/orders/${id}`),

    // Backwards-compatible alias used by older UI code
    get: (id: number) => request<OrderDetails>(`/orders/${id}`),
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
  },
};
