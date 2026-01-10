import { OrderItem } from '../../../../src/domain/entities/OrderItem';
import { Price } from '../../../../src/domain/value-objects/Price';

describe('OrderItem', () => {
  it('should create an order item with valid data', () => {
    const price = Price.create(25.50);
    const orderItem = OrderItem.create({
      orderId: 'order-123',
      menuItemId: 'item-123',
      quantity: 2,
      price,
    });

    expect(orderItem.getOrderId()).toBe('order-123');
    expect(orderItem.getMenuItemId()).toBe('item-123');
    expect(orderItem.getQuantity()).toBe(2);
    expect(orderItem.getPrice().equals(price)).toBe(true);
  });

  it('should throw error for invalid quantity', () => {
    const price = Price.create(25.50);

    expect(() =>
      OrderItem.create({
        orderId: 'order-123',
        menuItemId: 'item-123',
        quantity: 0,
        price,
      })
    ).toThrow('Quantity must be between 1 and 99');

    expect(() =>
      OrderItem.create({
        orderId: 'order-123',
        menuItemId: 'item-123',
        quantity: 100,
        price,
      })
    ).toThrow('Quantity must be between 1 and 99');
  });

  it('should calculate subtotal correctly', () => {
    const price = Price.create(25.50);
    const orderItem = OrderItem.create({
      orderId: 'order-123',
      menuItemId: 'item-123',
      quantity: 3,
      price,
    });

    const subtotal = orderItem.getSubtotal();
    expect(subtotal.getValue()).toBe(76.50);
  });

  it('should accept modifiers', () => {
    const price = Price.create(25.50);
    const orderItem = OrderItem.create({
      orderId: 'order-123',
      menuItemId: 'item-123',
      quantity: 1,
      price,
      modifiers: '{"sem_cebola": true}',
    });

    expect(orderItem.getModifiers()).toBe('{"sem_cebola": true}');
  });
});

