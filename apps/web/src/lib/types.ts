// apps/web/src/lib/types.ts
export type ApiError = {
  error: {
    code: string;
    message: string;
    requestId?: string;
    details?: unknown;
  };
};

export type User = {
  id: string;
  email: string;
  role: 'customer' | 'admin';
};

export type Product = {
  id: number;
  sku: string;
  name: string;
  description: string | null;
  priceCents: number;
  currency: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type OrderStatus = 'pending' | 'paid' | 'shipped' | 'completed' | 'cancelled';

export type OrderSummary = {
  id: number;
  userId: number;
  status: OrderStatus;
  subtotalCents: number;
  currency: string | null;
  createdAt: string;
  updatedAt: string;
  paidAt?: string | null;
  shippedAt?: string | null;
  completedAt?: string | null;
};

export type OrderItem = {
  productId: number;
  sku: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  currency: string;
};

export type OrderDetails = {
  order: OrderSummary;
  items: OrderItem[];
};

export type OrderStatusEvent = {
  id: number;
  createdAt: string;
  fromStatus: OrderStatus;
  toStatus: OrderStatus;
  actorUserId: number | null;
  reason: string | null;
};

export type AdminOrder = OrderSummary & {
  allowedNextStatuses: OrderStatus[];
  statusEvents: OrderStatusEvent[];
};

export type AdminOrderDetails = {
  order: AdminOrder;
  items: OrderItem[];
};

/**
 * Cart typing (GET /cart)
 *
 * Backend liefert enriched Cart:
 * cart: {
 *   items: [{ productId, sku, name, currency, unitPriceCents, quantity, lineTotalCents }],
 *   subtotalCents,
 *   currency
 * }
 *
 * => Diese Felder sind im Frontend REQUIRED, damit Pages wie Cart/Checkout ohne Optional-Chains stabil sind.
 */
export type CartItem = {
  productId: number;
  sku: string;
  name: string;
  currency: string;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
};

export type Cart = {
  items: CartItem[];
  subtotalCents: number;
  currency: string;
};

/**
 * Payments (Stripe)
 */
export type CreatePaymentIntentResponse = {
  orderId: number;
  clientSecret: string;
};
