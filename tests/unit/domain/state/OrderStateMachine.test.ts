import { OrderStateMachine } from '../../../../src/domain/state/OrderStateMachine';
import { OrderStatus } from '../../../../src/domain/enums/OrderStatus';

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
});
