import { OrderStateService, OrderCreationState } from '../../../../src/application/services/OrderStateService';

describe('OrderStateService', () => {
  let service: OrderStateService;

  beforeEach(() => {
    service = new OrderStateService();
  });

  it('should start order creation', () => {
    service.startOrderCreation('81999999999');
    const data = service.getOrderData('81999999999');

    expect(data).toBeDefined();
    expect(data?.state).toBe(OrderCreationState.SELECTING_RESTAURANT);
    expect(data?.items).toEqual([]);
  });

  it('should update state', () => {
    service.startOrderCreation('81999999999');
    service.updateState('81999999999', OrderCreationState.VIEWING_MENU);

    const data = service.getOrderData('81999999999');
    expect(data?.state).toBe(OrderCreationState.VIEWING_MENU);
  });

  it('should add item to cart', () => {
    service.startOrderCreation('81999999999');
    service.setRestaurant('81999999999', 'restaurant-123');

    service.addItem('81999999999', {
      menuItemId: 'item-1',
      menuItemName: 'Hambúrguer',
      quantity: 2,
      unitPrice: 25.50,
      totalPrice: 51.00,
    });

    const data = service.getOrderData('81999999999');
    expect(data?.items.length).toBe(1);
    expect(data?.items[0].quantity).toBe(2);
  });

  it('should calculate total', () => {
    service.startOrderCreation('81999999999');
    service.setRestaurant('81999999999', 'restaurant-123');

    service.addItem('81999999999', {
      menuItemId: 'item-1',
      menuItemName: 'Hambúrguer',
      quantity: 2,
      unitPrice: 25.50,
      totalPrice: 51.00,
    });

    service.addItem('81999999999', {
      menuItemId: 'item-2',
      menuItemName: 'Refrigerante',
      quantity: 1,
      unitPrice: 5.00,
      totalPrice: 5.00,
    });

    const total = service.calculateTotal('81999999999');
    expect(total).toBe(56.00);
  });

  it('should set and get pending ambiguity', () => {
    service.startOrderCreation('81999999999');
    service.setRestaurant('81999999999', 'restaurant-123');

    const ambiguity = {
      itemName: 'hambúrguer',
      quantity: 2,
      matches: [
        { id: 'item-1', name: 'Hambúrguer Clássico', price: 'R$ 25,00' },
        { id: 'item-2', name: 'Hambúrguer Artesanal', price: 'R$ 35,00' },
      ],
    };

    service.setPendingAmbiguity('81999999999', ambiguity);

    const data = service.getOrderData('81999999999');
    expect(data?.state).toBe(OrderCreationState.RESOLVING_AMBIGUITY);
    expect(data?.pendingAmbiguity).toEqual(ambiguity);

    const retrieved = service.getPendingAmbiguity('81999999999');
    expect(retrieved).toEqual(ambiguity);
  });

  it('should clear pending ambiguity', () => {
    service.startOrderCreation('81999999999');
    service.setRestaurant('81999999999', 'restaurant-123');

    const ambiguity = {
      itemName: 'hambúrguer',
      quantity: 2,
      matches: [{ id: 'item-1', name: 'Hambúrguer Clássico', price: 'R$ 25,00' }],
    };

    service.setPendingAmbiguity('81999999999', ambiguity);
    service.clearPendingAmbiguity('81999999999');

    const data = service.getOrderData('81999999999');
    expect(data?.pendingAmbiguity).toBeUndefined();
  });

  it('should clear order data', () => {
    service.startOrderCreation('81999999999');
    service.clearOrderData('81999999999');

    const data = service.getOrderData('81999999999');
    expect(data).toBeUndefined();
  });
});
