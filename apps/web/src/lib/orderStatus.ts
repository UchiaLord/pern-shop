export type OrderStatus = 'pending' | 'paid' | 'canceled' | 'failed';

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Ausstehend',
  paid: 'Bezahlt',
  canceled: 'Storniert',
  failed: 'Fehlgeschlagen',
};

export const ORDER_STATUS_CLASS: Record<OrderStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  paid: 'bg-green-100 text-green-800',
  canceled: 'bg-gray-200 text-gray-700',
  failed: 'bg-red-100 text-red-800',
};