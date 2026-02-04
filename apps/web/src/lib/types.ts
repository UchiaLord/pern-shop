// apps/web/src/lib/types.ts

export type ApiError = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export type User = {
  id: number;
  email: string;
  role: 'user' | 'admin';
  createdAt?: string;
};

export type Product = {
  id: number;
  sku: string;
  name: string;
  priceCents: number;
  currency: string;
  isActive: boolean;
  description?: string | null;
};
export type CartItem = {
  productId: number;
  sku: string;
  name: string;
  unitPriceCents: number;
  currency: string;
  quantity: number;
  lineTotalCents: number;
};

export type Cart = {
  items: CartItem[];
  currency: string;
  subtotalCents: number;
};

export type OrderStatus = 'pending' | 'paid' | 'shipped' | 'completed' | 'cancelled';

export type OrderSummary = {
  id: number;
  status: OrderStatus;
  currency: string;
  subtotalCents: number;
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
  shippedAt: string | null;
  completedAt: string | null;
};

export type OrderItem = {
  productId: number;
  sku: string;
  name: string;
  unitPriceCents: number;
  currency: string;
  quantity: number;
  lineTotalCents: number;
};

export type OrderDetails = {
  order: {
    id: number;
    userId: number;
    status: OrderStatus;
    currency: string;
    subtotalCents: number;
    createdAt: string;
    updatedAt: string;
    paidAt: string | null;
    shippedAt: string | null;
    completedAt: string | null;
  };
  items: OrderItem[];
};

export type AdminOrderStatusEvent = {
  id: number;
  fromStatus: OrderStatus;
  toStatus: OrderStatus;
  actorUserId: number | null;
  reason: string | null;
  createdAt: string;
};

export type AdminOrderDetails = {
  order: {
    id: number;
    userId: number;
    status: OrderStatus;
    currency: string;
    subtotalCents: number;
    createdAt: string;
    updatedAt: string;
    paidAt: string | null;
    shippedAt: string | null;
    completedAt: string | null;

    // Admin-only extras
    allowedNextStatuses: OrderStatus[];
    statusEvents: AdminOrderStatusEvent[];
  };
  items: OrderItem[];
};