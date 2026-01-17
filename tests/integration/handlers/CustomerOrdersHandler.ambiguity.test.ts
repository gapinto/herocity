import { CustomerOrdersHandler } from '../../../src/application/handlers/CustomerOrdersHandler';
import { EvolutionApiService } from '../../../src/infrastructure/messaging/EvolutionApiService';
import { IMenuItemRepository } from '../../../src/domain/repositories/IMenuItemRepository';
import { MenuItem } from '../../../src/domain/entities/MenuItem';
import { Price } from '../../../src/domain/value-objects/Price';
import { IOrderStateService } from '../../../src/domain/services/IOrderStateService';
import { IOrderItemRepository } from '../../../src/domain/repositories/IOrderItemRepository';
import { ICustomerRepository } from '../../../src/domain/repositories/ICustomerRepository';
import { IPaymentService } from '../../../src/domain/services/IPaymentService';

describe('CustomerOrdersHandler - Ambiguity Resolution', () => {
  let handler: CustomerOrdersHandler;
  let evolutionApi: jest.Mocked<EvolutionApiService>;
  let menuItemRepository: jest.Mocked<IMenuItemRepository>;
  let orderState: jest.Mocked<IOrderStateService>;
  let paymentService: jest.Mocked<IPaymentService>;
  let orderItemRepository: jest.Mocked<IOrderItemRepository>;
  let customerRepository: jest.Mocked<ICustomerRepository>;

  beforeEach(() => {
    evolutionApi = {
      sendMessage: jest.fn().mockResolvedValue(undefined),
      sendImage: jest.fn().mockResolvedValue(undefined),
    } as any;

    menuItemRepository = {
      findById: jest.fn(),
      findByRestaurantId: jest.fn(),
      findAvailableByRestaurantId: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    } as any;

    const notificationService = {
      notifyCustomer: jest.fn(),
      notifyRestaurant: jest.fn(),
      notifyOrderCreated: jest.fn(),
      notifyOrderStatusChanged: jest.fn(),
      notifyOrderCancelled: jest.fn(),
    } as any;

    orderState = {
      getOrderData: jest.fn().mockResolvedValue(null),
      startOrderCreation: jest.fn(),
      setRestaurant: jest.fn(),
      updateState: jest.fn(),
      addItem: jest.fn(),
      removeItem: jest.fn(),
      calculateTotal: jest.fn().mockResolvedValue(0),
      setPendingAmbiguity: jest.fn(),
      getPendingAmbiguity: jest.fn(),
      clearPendingAmbiguity: jest.fn(),
      setCurrentOrderId: jest.fn(),
      getCurrentOrderId: jest.fn(),
      clearOrderData: jest.fn(),
    } as any;

    paymentService = {
      createPayment: jest.fn(),
      confirmPayment: jest.fn(),
      getPaymentStatus: jest.fn(),
      cancelPayment: jest.fn(),
    } as any;

    orderItemRepository = {
      findByOrderId: jest.fn().mockResolvedValue([]),
      findById: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      deleteByOrderId: jest.fn(),
    } as any;

    customerRepository = {
      findById: jest.fn(),
      findByPhone: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    } as any;

    const restaurantRepository = {
      findById: jest.fn().mockResolvedValue({ isOpenAt: () => true }),
    } as any;

    handler = new CustomerOrdersHandler(
      evolutionApi,
      {} as any,
      menuItemRepository,
      restaurantRepository,
      orderItemRepository,
      customerRepository,
      {} as any,
      notificationService,
      orderState,
      paymentService
    );
  });

  describe('Given ambiguous menu items', () => {
    it('should detect multiple matches for item name', async () => {
      // Given
      const menuItems = [
        MenuItem.create({
          restaurantId: 'rest-1',
          name: 'Hambúrguer Clássico',
          price: Price.create(25.00),
          isAvailable: true,
        }),
        MenuItem.create({
          restaurantId: 'rest-1',
          name: 'Hambúrguer Artesanal',
          price: Price.create(35.00),
          isAvailable: true,
        }),
        MenuItem.create({
          restaurantId: 'rest-1',
          name: 'Hambúrguer Vegetariano',
          price: Price.create(30.00),
          isAvailable: true,
        }),
      ];

      // When
      const matches = (handler as any).findAmbiguousItems('hambúrguer', menuItems);

      // Then
      expect(matches.length).toBe(3);
      expect(matches[0].getName()).toBe('Hambúrguer Clássico');
      expect(matches[1].getName()).toBe('Hambúrguer Artesanal');
      expect(matches[2].getName()).toBe('Hambúrguer Vegetariano');
    });

    it('should find single match for specific item name', async () => {
      // Given
      const menuItems = [
        MenuItem.create({
          restaurantId: 'rest-1',
          name: 'Hambúrguer Clássico',
          price: Price.create(25.00),
          isAvailable: true,
        }),
        MenuItem.create({
          restaurantId: 'rest-1',
          name: 'Refrigerante',
          price: Price.create(5.00),
          isAvailable: true,
        }),
      ];

      // When
      const matches = (handler as any).findAmbiguousItems('refrigerante', menuItems);

      // Then
      expect(matches.length).toBe(1);
      expect(matches[0].getName()).toBe('Refrigerante');
    });

    it('should return empty array for non-matching item', async () => {
      // Given
      const menuItems = [
        MenuItem.create({
          restaurantId: 'rest-1',
          name: 'Hambúrguer',
          price: Price.create(25.00),
          isAvailable: true,
        }),
      ];

      // When
      const matches = (handler as any).findAmbiguousItems('pizza', menuItems);

      // Then
      expect(matches.length).toBe(0);
    });
  });
});

