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

export function isDangerStatus(next: OrderStatus): boolean {
  return next === 'cancelled';
}

export type OrderStatusAction = {
  nextStatus: OrderStatus;
  label: string;
  variant: 'primary' | 'secondary' | 'danger';
  confirm?: {
    title: string;
    message: string;
  };
};

export function getOrderStatusActions(current: OrderStatus): OrderStatusAction[] {
  const next = allowedNextStatuses(current);

  return next.map((s) => {
    if (s === 'paid') {
      return { nextStatus: 'paid', label: 'Als bezahlt markieren', variant: 'primary' };
    }
    if (s === 'shipped') {
      return { nextStatus: 'shipped', label: 'Als versandt markieren', variant: 'primary' };
    }
    if (s === 'completed') {
      return { nextStatus: 'completed', label: 'Als abgeschlossen markieren', variant: 'primary' };
    }
    if (s === 'cancelled') {
      return {
        nextStatus: 'cancelled',
        label: 'Stornieren',
        variant: 'danger',
        confirm: {
          title: 'Order stornieren?',
          message: 'Order wirklich stornieren? Dieser Vorgang ist endgültig.',
        },
      };
    }

    // Fallback (sollte nie passieren, aber defensiv)
    return { nextStatus: s, label: `Status setzen: ${s}`, variant: 'secondary' };
  });
}