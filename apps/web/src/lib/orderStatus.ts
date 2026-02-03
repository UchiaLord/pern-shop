export type OrderStatus = 'pending' | 'paid' | 'shipped' | 'completed' | 'cancelled';

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Ausstehend',
  paid: 'Bezahlt',
  shipped: 'Versandt',
  completed: 'Abgeschlossen',
  cancelled: 'Storniert',
};

export const ORDER_STATUS_CLASS: Record<OrderStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  paid: 'bg-green-100 text-green-800',
  shipped: 'bg-blue-100 text-blue-800',
  completed: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-gray-200 text-gray-700',
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