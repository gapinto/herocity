import { CreateOrder } from '../../../../src/domain/usecases/CreateOrder';
import { IOrderRepository } from '../../../../src/domain/repositories/IOrderRepository';
import { IMenuItemRepository } from '../../../../src/domain/repositories/IMenuItemRepository';
import { IRestaurantRepository } from '../../../../src/domain/repositories/IRestaurantRepository';
import { IOrderItemRepository } from '../../../../src/domain/repositories/IOrderItemRepository';
import { Restaurant } from '../../../../src/domain/entities/Restaurant';
import { MenuItem } from '../../../../src/domain/entities/MenuItem';
import { Order } from '../../../../src/domain/entities/Order';
import { Phone } from '../../../../src/domain/value-objects/Phone';
import { Price } from '../../../../src/domain/value-objects/Price';
import { OrderStatus } from '../../../../src/domain/enums/OrderStatus';

describe('CreateOrder', () => {
  let createOrder: CreateOrder;
  let orderRepository: jest.Mocked<IOrderRepository>;
  let menuItemRepository: jest.Mocked<IMenuItemRepository>;
  let restaurantRepository: jest.Mocked<IRestaurantRepository>;
  let orderItemRepository: jest.Mocked<IOrderItemRepository>;
  const baseAddress = {
    address: 'Rua Teste, 123',
    postalCode: '50000000',
    addressNumber: '123',
    complement: 'Sala 1',
    province: 'Centro',
    city: 'Recife',
    state: 'PE',
  };

  beforeEach(() => {
    orderRepository = {
      findById: jest.fn(),
      findByRestaurantId: jest.fn(),
      findByCustomerId: jest.fn(),
      findByStatus: jest.fn(),
      findByRestaurantAndStatus: jest.fn(),
      findByPaymentId: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };

    menuItemRepository = {
      findById: jest.fn(),
      findByRestaurantId: jest.fn(),
      findAvailableByRestaurantId: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };

    restaurantRepository = {
      findById: jest.fn(),
      findByPhone: jest.fn(),
      findAll: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };

    orderItemRepository = {
      findByOrderId: jest.fn(),
      findById: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      deleteByOrderId: jest.fn(),
    };

    createOrder = new CreateOrder(
      orderRepository,
      menuItemRepository,
      restaurantRepository,
      orderItemRepository
    );
  });

  it('should create order with items', async () => {
    const restaurant = Restaurant.create({
      id: 'restaurant-123',
      name: 'Restaurante Teste',
      phone: Phone.create('81999999999'),
      ...baseAddress,
      isActive: true,
      timezone: 'America/Recife',
    });

    const menuItem1 = MenuItem.create({
      id: 'menu-item-1',
      restaurantId: restaurant.getId(),
      name: 'Hambúrguer',
      price: Price.create(25.50),
      isAvailable: true,
    });

    const menuItem2 = MenuItem.create({
      id: 'menu-item-2',
      restaurantId: restaurant.getId(),
      name: 'Refrigerante',
      price: Price.create(5.00),
      isAvailable: true,
    });

    restaurantRepository.findById.mockResolvedValue(restaurant);
    menuItemRepository.findById
      .mockResolvedValueOnce(menuItem1)
      .mockResolvedValueOnce(menuItem2);

    const savedOrder = Order.create({
      id: 'order-123',
      restaurantId: restaurant.getId(),
      customerId: 'customer-123',
      total: Price.create(56.00),
      status: OrderStatus.NEW,
    });
    orderRepository.save.mockResolvedValue(savedOrder);

    const result = await createOrder.execute({
      restaurantId: restaurant.getId(),
      customerId: 'customer-123',
      items: [
        { menuItemId: menuItem1.getId(), quantity: 2 },
        { menuItemId: menuItem2.getId(), quantity: 1 },
      ],
      status: OrderStatus.NEW,
    });

    expect(result).toBeDefined();
    expect(orderRepository.save).toHaveBeenCalled();
    const saved = (orderRepository.save as jest.Mock).mock.calls[0][0] as Order;
    expect(saved.getSequenceDate()).toBeDefined();
    expect(orderItemRepository.save).toHaveBeenCalledTimes(2);
  });

  it('should throw error if restaurant not found', async () => {
    restaurantRepository.findById.mockResolvedValue(null);

    await expect(
      createOrder.execute({
        restaurantId: 'invalid',
        customerId: 'customer-123',
        items: [{ menuItemId: 'item-1', quantity: 1 }],
      })
    ).rejects.toThrow('Restaurant not found or inactive');
  });

  it('should throw error if item not available', async () => {
    const restaurant = Restaurant.create({
      id: 'restaurant-123',
      name: 'Restaurante Teste',
      phone: Phone.create('81999999999'),
      ...baseAddress,
      isActive: true,
    });

    const menuItem = MenuItem.create({
      id: 'menu-item-1',
      restaurantId: restaurant.getId(),
      name: 'Hambúrguer',
      price: Price.create(25.50),
      isAvailable: false, // Indisponível
    });

    restaurantRepository.findById.mockResolvedValue(restaurant);
    menuItemRepository.findById.mockResolvedValue(menuItem);

    await expect(
      createOrder.execute({
        restaurantId: restaurant.getId(),
        customerId: 'customer-123',
        items: [{ menuItemId: menuItem.getId(), quantity: 1 }],
      })
    ).rejects.toThrow('not available');
  });

  it('should throw error if restaurant is closed', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-19T12:00:00.000Z'));

    const restaurant = Restaurant.create({
      id: 'restaurant-123',
      name: 'Restaurante Teste',
      phone: Phone.create('81999999999'),
      ...baseAddress,
      isActive: true,
      timezone: 'America/Recife',
      openingHours: [{ day: 1, open: '10:00', close: '11:00' }],
    });

    const menuItem = MenuItem.create({
      id: 'menu-item-1',
      restaurantId: restaurant.getId(),
      name: 'Hambúrguer',
      price: Price.create(25.50),
      isAvailable: true,
    });

    restaurantRepository.findById.mockResolvedValue(restaurant);
    menuItemRepository.findById.mockResolvedValue(menuItem);

    await expect(
      createOrder.execute({
        restaurantId: restaurant.getId(),
        customerId: 'customer-123',
        items: [{ menuItemId: menuItem.getId(), quantity: 1 }],
        status: OrderStatus.NEW,
      })
    ).rejects.toThrow('Restaurant is closed');

    jest.useRealTimers();
  });
});

