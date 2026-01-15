import { OrderStatus } from '../enums/OrderStatus';

export type McpOrderStatus =
  | 'NEW'
  | 'BUILDING'
  | 'AWAITING_PAYMENT'
  | 'PAID'
  | 'IN_PREPARATION'
  | 'READY'
  | 'DELIVERED'
  | 'CLOSED'
  | 'CANCELLED';

const mcpToDomainMap: Record<string, OrderStatus> = {
  NEW: OrderStatus.DRAFT,
  BUILDING: OrderStatus.DRAFT,
  AWAITING_PAYMENT: OrderStatus.AWAITING_PAYMENT,
  PAID: OrderStatus.PAID,
  IN_PREPARATION: OrderStatus.PREPARING,
  READY: OrderStatus.READY,
  DELIVERED: OrderStatus.DELIVERED,
  CLOSED: OrderStatus.DELIVERED,
  CANCELLED: OrderStatus.CANCELLED,
};

const domainToMcpMap: Record<OrderStatus, McpOrderStatus> = {
  [OrderStatus.DRAFT]: 'BUILDING',
  [OrderStatus.AWAITING_PAYMENT]: 'AWAITING_PAYMENT',
  [OrderStatus.PAID]: 'PAID',
  [OrderStatus.PREPARING]: 'IN_PREPARATION',
  [OrderStatus.READY]: 'READY',
  [OrderStatus.DELIVERED]: 'DELIVERED',
  [OrderStatus.CANCELLED]: 'CANCELLED',
  // Compat
  [OrderStatus.PENDING]: 'BUILDING',
};

export class OrderStateMachine {
  static toDomainStatus(status: string): OrderStatus {
    const key = status.toUpperCase();
    const mapped = mcpToDomainMap[key];
    if (!mapped) {
      throw new Error(`Unknown status: ${status}`);
    }
    return mapped;
  }

  static toMcpStatus(status: OrderStatus): McpOrderStatus {
    return domainToMcpMap[status] || 'BUILDING';
  }

  static assertCanModify(status: OrderStatus): void {
    if (status !== OrderStatus.DRAFT) {
      throw new Error('Order can only be modified while BUILDING');
    }
  }

  static assertCanCancel(status: OrderStatus): void {
    if (status !== OrderStatus.DRAFT && status !== OrderStatus.AWAITING_PAYMENT) {
      throw new Error('Order can only be cancelled before IN_PREPARATION');
    }
  }

  static assertCanRequestPayment(status: OrderStatus): void {
    if (status !== OrderStatus.DRAFT) {
      throw new Error('Payment can only be requested for BUILDING orders');
    }
  }

  static assertCanConfirmPayment(status: OrderStatus): void {
    if (status !== OrderStatus.AWAITING_PAYMENT) {
      throw new Error('Payment can only be confirmed for AWAITING_PAYMENT orders');
    }
  }

  static assertCanNotifyKitchen(status: OrderStatus): void {
    if (status !== OrderStatus.PAID) {
      throw new Error('Kitchen can only be notified after payment is confirmed');
    }
  }

  static assertCanMarkPreparing(status: OrderStatus): void {
    if (status !== OrderStatus.PAID) {
      throw new Error('Order can only move to IN_PREPARATION from PAID');
    }
  }

  static assertCanMarkReady(status: OrderStatus): void {
    if (status !== OrderStatus.PREPARING) {
      throw new Error('Order can only move to READY from IN_PREPARATION');
    }
  }
}
