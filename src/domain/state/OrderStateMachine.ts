import { OrderStatus } from '../enums/OrderStatus';
import { Order } from '../entities/Order';

export type McpOrderStatus =
  | 'MONTANDO'
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
  MONTANDO: OrderStatus.DRAFT,
  NEW: OrderStatus.NEW,
  BUILDING: OrderStatus.DRAFT,
  WAITING_PAYMENT: OrderStatus.AWAITING_PAYMENT,
  AWAITING_PAYMENT: OrderStatus.AWAITING_PAYMENT,
  PAID: OrderStatus.PAID,
  IN_PREPARATION: OrderStatus.PREPARING,
  READY: OrderStatus.READY,
  DELIVERED: OrderStatus.DELIVERED,
  CLOSED: OrderStatus.DELIVERED,
  CANCELLED: OrderStatus.CANCELLED,
};

const domainToMcpMap: Record<OrderStatus, McpOrderStatus> = {
  [OrderStatus.DRAFT]: 'MONTANDO',
  [OrderStatus.NEW]: 'NEW',
  [OrderStatus.AWAITING_PAYMENT]: 'NEW',
  [OrderStatus.PAID]: 'PAID',
  [OrderStatus.PREPARING]: 'IN_PREPARATION',
  [OrderStatus.READY]: 'READY',
  [OrderStatus.DELIVERED]: 'DELIVERED',
  [OrderStatus.CANCELLED]: 'CANCELLED',
  // Compat
  [OrderStatus.PENDING]: 'MONTANDO',
};

export class OrderStateMachine {
  static buildKitchenQueue(
    newOrders: Order[],
    preparingOrders: Order[],
    readyOrders: Order[],
    readyLimit = 5
  ): Order[] {
    const byCreatedAsc = (a: Order, b: Order) =>
      a.getCreatedAt().getTime() - b.getCreatedAt().getTime();

    const newSorted = [...newOrders].sort(byCreatedAsc);
    const preparingSorted = [...preparingOrders].sort(byCreatedAsc);
    const readySorted = [...readyOrders].sort(byCreatedAsc).slice(0, readyLimit);

    return [...newSorted, ...preparingSorted, ...readySorted];
  }

  static toDomainStatus(status: string): OrderStatus {
    const key = status.toUpperCase();
    const mapped = mcpToDomainMap[key];
    if (!mapped) {
      throw new Error(`Unknown status: ${status}`);
    }
    return mapped;
  }

  static toMcpStatus(status: OrderStatus): McpOrderStatus {
    return domainToMcpMap[status] || 'MONTANDO';
  }

  static assertCanModify(status: OrderStatus): void {
    if (status !== OrderStatus.DRAFT && status !== OrderStatus.NEW) {
      throw new Error('Order can only be modified while MONTANDO or NEW');
    }
  }

  static assertCanCancel(status: OrderStatus): void {
    if (
      status !== OrderStatus.DRAFT &&
      status !== OrderStatus.NEW &&
      status !== OrderStatus.AWAITING_PAYMENT
    ) {
      throw new Error('Order can only be cancelled before IN_PREPARATION');
    }
  }

  static assertCanRequestPayment(status: OrderStatus): void {
    if (status !== OrderStatus.NEW && status !== OrderStatus.AWAITING_PAYMENT) {
      throw new Error('Payment can only be requested for NEW orders');
    }
  }

  static assertCanConfirmPayment(status: OrderStatus): void {
    if (status !== OrderStatus.AWAITING_PAYMENT) {
      throw new Error('Payment can only be confirmed for AWAITING_PAYMENT orders');
    }
  }

  static assertCanNotifyKitchen(status: OrderStatus, allowBeforePayment = false): void {
    if (status === OrderStatus.PAID) {
      return;
    }
    if (allowBeforePayment && (status === OrderStatus.AWAITING_PAYMENT || status === OrderStatus.NEW)) {
      return;
    }
    throw new Error('Kitchen can only be notified after payment is confirmed');
  }

  static assertCanMarkPreparing(status: OrderStatus, allowBeforePayment = false): void {
    if (status === OrderStatus.PAID) {
      return;
    }
    if (
      allowBeforePayment &&
      (status === OrderStatus.AWAITING_PAYMENT || status === OrderStatus.NEW)
    ) {
      return;
    }
    throw new Error('Order can only move to IN_PREPARATION from PAID');
  }

  static assertCanMarkReady(status: OrderStatus): void {
    if (status !== OrderStatus.PREPARING) {
      throw new Error('Order can only move to READY from IN_PREPARATION');
    }
  }
}
