import { Order } from '../../../../src/domain/entities/Order';
import { OrderStatus } from '../../../../src/domain/enums/OrderStatus';
import { Price } from '../../../../src/domain/value-objects/Price';

describe('Order', () => {
  it('should create an order with valid data', () => {
    const total = Price.create(50.00);
    const order = Order.create({
      restaurantId: 'restaurant-123',
      customerId: 'customer-123',
      total,
    });

    expect(order.getRestaurantId()).toBe('restaurant-123');
    expect(order.getCustomerId()).toBe('customer-123');
    expect(order.getTotal().equals(total)).toBe(true);
    expect(order.getStatus()).toBe(OrderStatus.PENDING);
  });

  it('should update order status', () => {
    const total = Price.create(50.00);
    const order = Order.create({
      restaurantId: 'restaurant-123',
      customerId: 'customer-123',
      total,
    });

    order.updateStatus(OrderStatus.PAID);
    expect(order.getStatus()).toBe(OrderStatus.PAID);

    order.updateStatus(OrderStatus.PREPARING);
    expect(order.getStatus()).toBe(OrderStatus.PREPARING);
  });

  it('should not allow invalid status transitions', () => {
    const total = Price.create(50.00);
    const order = Order.create({
      restaurantId: 'restaurant-123',
      customerId: 'customer-123',
      total,
    });

    order.updateStatus(OrderStatus.CANCELLED);
    expect(() => order.updateStatus(OrderStatus.PAID)).toThrow('Cannot update status of cancelled order');
  });
});

