import type { OrderStatus } from './orderStatus';

export type ApiError = {
  error: {
    code: string;
    message: string;
    details?: Record<string, string>;
  };
};

export type User = { id: number; email: string; role: string };

export type Product = {
  id: number;
  sku: string;
  name: string;
  description: string | null;
  priceCents: number;
  currency: string;
  isActive: boolean;
};

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

export type OrderSummary = {
  id: number;
  status: OrderStatus;
  currency: string;
  subtotalCents: number;
  createdAt: string;


  updatedAt?: string | null;
  paidAt?: string | null;
  shippedAt?: string | null;
  completedAt?: string | null;
};

export type OrderDetails = {
  order: OrderSummary;
  items: Array<{
    productId: number;
    sku: string;
    name: string;
    unitPriceCents: number;
    currency: string;
    quantity: number;
    lineTotalCents: number;
  }>;
};