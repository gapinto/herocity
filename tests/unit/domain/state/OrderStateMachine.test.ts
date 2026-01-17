import { OrderStateMachine } from '../../../../src/domain/state/OrderStateMachine';
import { OrderStatus } from '../../../../src/domain/enums/OrderStatus';
import { Order } from '../../../../src/domain/entities/Order';
import { Price } from '../../../../src/domain/value-objects/Price';

describe('OrderStateMachine', () => {
  it('maps MCP status to domain status', () => {
    expect(OrderStateMachine.toDomainStatus('BUILDING')).toBe(OrderStatus.DRAFT);
    expect(OrderStateMachine.toDomainStatus('AWAITING_PAYMENT')).toBe(OrderStatus.AWAITING_PAYMENT);
    expect(OrderStateMachine.toDomainStatus('IN_PREPARATION')).toBe(OrderStatus.PREPARING);
  });

  it('maps domain status to MCP status', () => {
    expect(OrderStateMachine.toMcpStatus(OrderStatus.DRAFT)).toBe('BUILDING');
    expect(OrderStateMachine.toMcpStatus(OrderStatus.PAID)).toBe('PAID');
    expect(OrderStateMachine.toMcpStatus(OrderStatus.PREPARING)).toBe('IN_PREPARATION');
  });

  it('rejects invalid modifications', () => {
    expect(() => OrderStateMachine.assertCanModify(OrderStatus.AWAITING_PAYMENT)).toThrow(
      'Order can only be modified while BUILDING'
    );
  });

  it('allows preparing before payment when enabled', () => {
    expect(() => OrderStateMachine.assertCanMarkPreparing(OrderStatus.DRAFT, true)).not.toThrow();
    expect(() => OrderStateMachine.assertCanMarkPreparing(OrderStatus.AWAITING_PAYMENT, true)).not.toThrow();
    expect(() => OrderStateMachine.assertCanMarkPreparing(OrderStatus.DRAFT)).toThrow(
      'Order can only move to IN_PREPARATION from PAID'
    );
  });

  it('builds kitchen queue with preparing first and top 5 ready', () => {
    const makeOrder = (id: string, status: OrderStatus, createdAt: Date) =>
      Order.create({
        id,
        restaurantId: 'rest-1',
        customerId: 'cust-1',
        status,
        total: Price.create(10),
        createdAt,
      });

    const preparingOrders = [
      makeOrder('prep-2', OrderStatus.PREPARING, new Date('2024-01-02')),
      makeOrder('prep-1', OrderStatus.PREPARING, new Date('2024-01-01')),
    ];
    const readyOrders = [
      makeOrder('ready-3', OrderStatus.READY, new Date('2024-01-03')),
      makeOrder('ready-1', OrderStatus.READY, new Date('2024-01-01')),
      makeOrder('ready-2', OrderStatus.READY, new Date('2024-01-02')),
      makeOrder('ready-4', OrderStatus.READY, new Date('2024-01-04')),
      makeOrder('ready-5', OrderStatus.READY, new Date('2024-01-05')),
      makeOrder('ready-6', OrderStatus.READY, new Date('2024-01-06')),
    ];

    const queue = OrderStateMachine.buildKitchenQueue(preparingOrders, readyOrders, 5);
    expect(queue.map((order) => order.getId())).toEqual([
      'prep-1',
      'prep-2',
      'ready-1',
      'ready-2',
      'ready-3',
      'ready-4',
      'ready-5',
    ]);
  });
});
