export enum OrderStatus {
  DRAFT = 'draft',
  NEW = 'new',
  AWAITING_PAYMENT = 'awaiting_payment',
  PAID = 'paid',
  PREPARING = 'preparing',
  READY = 'ready',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  // Mantido para compatibilidade
  PENDING = 'pending',
}

