export enum OrderStatus {
  DRAFT = 'draft',
  AWAITING_PAYMENT = 'awaiting_payment',
  PAID = 'paid',
  PREPARING = 'preparing',
  READY = 'ready',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  // Mantido para compatibilidade
  PENDING = 'pending',
}

