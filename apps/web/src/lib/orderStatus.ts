// apps/web/src/lib/orderStatus.ts
import type { OrderStatus } from './types';

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Pending',
  paid: 'Paid',
  shipped: 'Shipped',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const ORDER_STATUS_CLASS: Record<OrderStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  paid: 'bg-blue-100 text-blue-800',
  shipped: 'bg-purple-100 text-purple-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['paid', 'cancelled'],
  paid: ['shipped', 'cancelled'],
  shipped: ['completed'],
  completed: [],
  cancelled: [],
};

export function allowedNextStatuses(current: OrderStatus): OrderStatus[] {
  return ALLOWED_TRANSITIONS[current] ?? [];
}

export function isTerminalStatus(status: OrderStatus): boolean {
  return status === 'completed' || status === 'cancelled';
}

export function isDangerStatus(next: OrderStatus): boolean {
  return next === 'cancelled';
}

export type OrderStatusAction = {
  nextStatus: OrderStatus;
  label: string;
  danger?: boolean;
};

export function getOrderStatusActions(current: OrderStatus): OrderStatusAction[] {
  return allowedNextStatuses(current).map((next) => ({
    nextStatus: next,
    label: ORDER_STATUS_LABEL[next] ?? next,
    danger: isDangerStatus(next),
  }));
}
