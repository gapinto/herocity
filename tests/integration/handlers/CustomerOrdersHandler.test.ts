import { CustomerOrdersHandler } from '../../../src/application/handlers/CustomerOrdersHandler';
import { EvolutionApiService } from '../../../src/infrastructure/messaging/EvolutionApiService';
import { IOrderRepository } from '../../../src/domain/repositories/IOrderRepository';
import { IMenuItemRepository } from '../../../src/domain/repositories/IMenuItemRepository';
import { IRestaurantRepository } from '../../../src/domain/repositories/IRestaurantRepository';
import { CreateOrder } from '../../../src/domain/usecases/CreateOrder';
import { NotificationService } from '../../../src/application/services/NotificationService';
import { Intent } from '../../../src/domain/enums/Intent';
import { UserContext } from '../../../src/domain/enums/UserContext';
import { MessageData } from '../../../src/application/services/OrchestrationService';
import { Order } from '../../../src/domain/entities/Order';
import { OrderStatus } from '../../../src/domain/enums/OrderStatus';
import { Price } from '../../../src/domain/value-objects/Price';
import { IOrderStateService } from '../../../src/domain/services/IOrderStateService';
import { IPaymentService } from '../../../src/domain/services/IPaymentService';

describe('CustomerOrdersHandler Integration', () => {
  let handler: CustomerOrdersHandler;
  let evolutionApi: jest.Mocked<EvolutionApiService>;
  let orderRepository: jest.Mocked<IOrderRepository>;
  let menuItemRepository: jest.Mocked<IMenuItemRepository>;
  let restaurantRepository: jest.Mocked<IRestaurantRepository>;
  let createOrder: jest.Mocked<CreateOrder>;
  let notificationService: jest.Mocked<NotificationService>;
  let orderState: jest.Mocked<IOrderStateService>;
  let paymentService: jest.Mocked<IPaymentService>;

  beforeEach(() => {
    evolutionApi = {
      sendMessage: jest.fn().mockResolvedValue(undefined),
      sendImage: jest.fn().mockResolvedValue(undefined),
    } as any;

    orderRepository = {
      findById: jest.fn(),
      findByRestaurantId: jest.fn(),
      findByCustomerId: jest.fn(),
      findByStatus: jest.fn(),
      findByRestaurantAndStatus: jest.fn(),
      findByPaymentId: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    } as any;

    menuItemRepository = {
      findById: jest.fn(),
      findByRestaurantId: jest.fn(),
      findAvailableByRestaurantId: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    } as any;

    restaurantRepository = {
      findById: jest.fn(),
      findByPhone: jest.fn(),
      findAll: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    } as any;

    createOrder = {
      execute: jest.fn(),
    } as any;

    notificationService = {
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

    handler = new CustomerOrdersHandler(
      evolutionApi,
      orderRepository,
      menuItemRepository,
      restaurantRepository,
      createOrder,
      notificationService,
      orderState,
      paymentService
    );
  });

  describe('Given a customer wants to create an order', () => {
    it('should list available restaurants', async () => {
      // Given
      const data: MessageData = {
        from: '81999999999',
        text: 'quero fazer um pedido',
        userContext: UserContext.CUSTOMER,
        customerId: 'customer-123',
      };

      restaurantRepository.findAll = jest.fn().mockResolvedValue([
        { getId: () => 'rest-1', getName: () => 'Restaurante A', isActive: () => true },
        { getId: () => 'rest-2', getName: () => 'Restaurante B', isActive: () => true },
      ] as any);

      // When
      await handler.handle(Intent.CRIAR_PEDIDO, data);

      // Then
      expect(evolutionApi.sendMessage).toHaveBeenCalled();
      expect(restaurantRepository.findAll).toHaveBeenCalled();
    });
  });

  describe('Given a customer wants to check order status', () => {
    it('should return active orders', async () => {
      // Given
      const data: MessageData = {
        from: '81999999999',
        text: 'status do pedido',
        userContext: UserContext.CUSTOMER,
        customerId: 'customer-123',
      };

      orderRepository.findByCustomerId = jest.fn().mockResolvedValue([
        {
          getId: () => 'order-123',
          getStatus: () => 'pending',
          getTotal: () => ({ getFormatted: () => 'R$ 50,00' }),
        },
      ] as any);

      // When
      await handler.handle(Intent.CONSULTAR_STATUS_PEDIDO, data);

      // Then
      expect(evolutionApi.sendMessage).toHaveBeenCalled();
      expect(orderRepository.findByCustomerId).toHaveBeenCalledWith('customer-123');
    });
  });

  describe('Given a customer scans QR code and mentions items', () => {
    it('should process direct order when items are extracted', async () => {
      // Given
      const data: MessageData = {
        from: '81999999999',
        text: 'quero 2 hambúrgueres',
        userContext: UserContext.CUSTOMER,
        customerId: 'customer-123',
        restaurantId: 'restaurant-123',
        intentResult: {
          intent: Intent.CRIAR_PEDIDO_QR_CODE,
          confidence: 0.95,
          items: [{ name: 'Hambúrguer', quantity: 2 }],
        },
      };

      const menuItem = {
        getId: () => 'item-123',
        getName: () => 'Hambúrguer',
        getPrice: () => Price.create(25.00),
        isAvailable: () => true,
      };

      menuItemRepository.findAvailableByRestaurantId = jest
        .fn()
        .mockResolvedValue([menuItem] as any);

      const order = Order.create({
        restaurantId: 'restaurant-123',
        customerId: 'customer-123',
        total: Price.create(50.00),
        status: OrderStatus.PENDING,
      });

      createOrder.execute = jest.fn().mockResolvedValue(order);

      // When
      await handler.handle(Intent.CRIAR_PEDIDO_QR_CODE, data);

      // Then
      expect(menuItemRepository.findAvailableByRestaurantId).toHaveBeenCalledWith(
        'restaurant-123'
      );
      expect(createOrder.execute).toHaveBeenCalled();
      expect(notificationService.notifyOrderCreated).toHaveBeenCalled();
      expect(evolutionApi.sendMessage).toHaveBeenCalled();
    });
  });
});

