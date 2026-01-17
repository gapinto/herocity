import { CustomerOrdersHandler } from '../../../src/application/handlers/CustomerOrdersHandler';
import { EvolutionApiService } from '../../../src/infrastructure/messaging/EvolutionApiService';
import { IMenuItemRepository } from '../../../src/domain/repositories/IMenuItemRepository';
import { IRestaurantRepository } from '../../../src/domain/repositories/IRestaurantRepository';
import { CreateOrder } from '../../../src/domain/usecases/CreateOrder';
import { Intent } from '../../../src/domain/enums/Intent';
import { UserContext } from '../../../src/domain/enums/UserContext';
import { MessageData } from '../../../src/application/services/OrchestrationService';
import { MenuItem } from '../../../src/domain/entities/MenuItem';
import { Price } from '../../../src/domain/value-objects/Price';
import { Order } from '../../../src/domain/entities/Order';
import { OrderStatus } from '../../../src/domain/enums/OrderStatus';
import { IOrderStateService } from '../../../src/domain/services/IOrderStateService';
import { IPaymentService } from '../../../src/domain/services/IPaymentService';
import { IOrderItemRepository } from '../../../src/domain/repositories/IOrderItemRepository';
import { ICustomerRepository } from '../../../src/domain/repositories/ICustomerRepository';

describe('CustomerOrdersHandler - Menu Rules Integration', () => {
  let handler: CustomerOrdersHandler;
  let evolutionApi: jest.Mocked<EvolutionApiService>;
  let menuItemRepository: jest.Mocked<IMenuItemRepository>;
  let restaurantRepository: jest.Mocked<IRestaurantRepository>;
  let createOrder: jest.Mocked<CreateOrder>;
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

    restaurantRepository = {
      findById: jest.fn(),
      findByPhone: jest.fn(),
      findAll: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    } as any;
    restaurantRepository.findById.mockResolvedValue({ isOpenAt: () => true } as any);

    createOrder = {
      execute: jest.fn(),
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

    handler = new CustomerOrdersHandler(
      evolutionApi,
      {} as any,
      menuItemRepository,
      restaurantRepository,
      orderItemRepository,
      customerRepository,
      createOrder,
      notificationService,
      orderState,
      paymentService
    );
  });

  describe('Given a restaurant with combo rules (protein required)', () => {
    it('should reject order when protein is missing', async () => {
      // Given
      const data: MessageData = {
        from: '81999999999',
        text: 'quero só arroz e feijão',
        userContext: UserContext.CUSTOMER,
        customerId: 'customer-123',
        restaurantId: 'restaurant-123',
        intentResult: {
          intent: Intent.CRIAR_PEDIDO_QR_CODE,
          confidence: 0.9,
          items: [
            { name: 'Arroz', quantity: 1, category: 'side' },
            { name: 'Feijão', quantity: 1, category: 'side' },
          ],
          validation: {
            isValid: true,
            isComplete: false,
            missingRequired: ['proteína'],
            warnings: [],
            errors: [],
          },
        },
      };

      const menuItems = [
        MenuItem.create({
          restaurantId: 'restaurant-123',
          name: 'Arroz',
          price: Price.create(0),
          isAvailable: true,
        }),
        MenuItem.create({
          restaurantId: 'restaurant-123',
          name: 'Feijão',
          price: Price.create(0),
          isAvailable: true,
        }),
      ];

      menuItemRepository.findAvailableByRestaurantId.mockResolvedValue(menuItems);

      // When
      await (handler as any).handleDirectOrderFromQRCode(data);

      // Then
      expect(evolutionApi.sendMessage).toHaveBeenCalledWith({
        to: '81999999999',
        text: expect.stringContaining('incompleto'),
      });
      expect(createOrder.execute).not.toHaveBeenCalled();
    });

    it('should create order when protein is present', async () => {
      // Given
      const data: MessageData = {
        from: '81999999999',
        text: 'quero frango com arroz e feijão',
        userContext: UserContext.CUSTOMER,
        customerId: 'customer-123',
        restaurantId: 'restaurant-123',
        intentResult: {
          intent: Intent.CRIAR_PEDIDO_QR_CODE,
          confidence: 0.95,
          items: [
            { name: 'Frango Grelhado', quantity: 1, category: 'protein' },
            { name: 'Arroz', quantity: 1, category: 'side' },
            { name: 'Feijão', quantity: 1, category: 'side' },
          ],
          validation: {
            isValid: true,
            isComplete: true,
            missingRequired: [],
            warnings: [],
            errors: [],
          },
        },
      };

      const menuItems = [
        MenuItem.create({
          restaurantId: 'restaurant-123',
          name: 'Frango Grelhado',
          price: Price.create(25.00),
          isAvailable: true,
        }),
        MenuItem.create({
          restaurantId: 'restaurant-123',
          name: 'Arroz',
          price: Price.create(0),
          isAvailable: true,
        }),
        MenuItem.create({
          restaurantId: 'restaurant-123',
          name: 'Feijão',
          price: Price.create(0),
          isAvailable: true,
        }),
      ];

      menuItemRepository.findAvailableByRestaurantId.mockResolvedValue(menuItems);
      menuItemRepository.findById.mockImplementation((id) => {
        return Promise.resolve(menuItems.find((item) => item.getId() === id) || null);
      });

      const order = Order.create({
        restaurantId: 'restaurant-123',
        customerId: 'customer-123',
        total: Price.create(25.00),
        status: OrderStatus.PENDING,
      });

      createOrder.execute.mockResolvedValue(order);

      // When
      await (handler as any).handleDirectOrderFromQRCode(data);

      // Then
      expect(createOrder.execute).toHaveBeenCalled();
      expect(evolutionApi.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          to: '81999999999',
          text: expect.stringContaining('Pedido criado'),
        })
      );
    });
  });

  describe('Given a restaurant with minimum order value rule', () => {
    it('should reject order when minimum is not met', async () => {
      // Given
      const data: MessageData = {
        from: '81999999999',
        text: 'quero só um refrigerante',
        userContext: UserContext.CUSTOMER,
        customerId: 'customer-123',
        restaurantId: 'restaurant-123',
        intentResult: {
          intent: Intent.CRIAR_PEDIDO_QR_CODE,
          confidence: 0.9,
          items: [{ name: 'Refrigerante', quantity: 1 }],
          validation: {
            isValid: false,
            isComplete: true,
            missingRequired: [],
            warnings: [],
            errors: ['Pedido mínimo de R$ 30,00 não atingido'],
          },
        },
      };

      // When
      await (handler as any).handleDirectOrderFromQRCode(data);

      // Then
      expect(evolutionApi.sendMessage).toHaveBeenCalledWith({
        to: '81999999999',
        text: expect.stringContaining('Erro no pedido'),
      });
      expect(createOrder.execute).not.toHaveBeenCalled();
    });
  });

  describe('Given a restaurant with max quantity rule', () => {
    it('should show warning when limit is exceeded', async () => {
      // Given
      const data: MessageData = {
        from: '81999999999',
        text: 'quero frango com 5 acompanhamentos',
        userContext: UserContext.CUSTOMER,
        customerId: 'customer-123',
        restaurantId: 'restaurant-123',
        intentResult: {
          intent: Intent.CRIAR_PEDIDO_QR_CODE,
          confidence: 0.9,
          items: [
            { name: 'Frango Grelhado', quantity: 1, category: 'protein' },
            { name: 'Arroz', quantity: 1, category: 'side' },
            { name: 'Feijão', quantity: 1, category: 'side' },
            { name: 'Batata', quantity: 1, category: 'side' },
            { name: 'Salada', quantity: 1, category: 'side' },
            { name: 'Farofa', quantity: 1, category: 'side' },
          ],
          validation: {
            isValid: true,
            isComplete: true,
            missingRequired: [],
            warnings: ['Máximo 3 acompanhamentos permitidos'],
            errors: [],
          },
        },
      };

      // When
      await (handler as any).handleDirectOrderFromQRCode(data);

      // Then
      expect(evolutionApi.sendMessage).toHaveBeenCalledWith({
        to: '81999999999',
        text: expect.stringContaining('⚠️'),
      });
    });
  });

  describe('Given a restaurant without rules', () => {
    it('should create order normally', async () => {
      // Given
      const data: MessageData = {
        from: '81999999999',
        text: 'quero um hambúrguer',
        userContext: UserContext.CUSTOMER,
        customerId: 'customer-123',
        restaurantId: 'restaurant-123',
        intentResult: {
          intent: Intent.CRIAR_PEDIDO_QR_CODE,
          confidence: 0.95,
          items: [{ name: 'Hambúrguer', quantity: 1 }],
          // No validation = no rules
        },
      };

      const menuItem = MenuItem.create({
        restaurantId: 'restaurant-123',
        name: 'Hambúrguer',
        price: Price.create(20.00),
        isAvailable: true,
      });

      menuItemRepository.findAvailableByRestaurantId.mockResolvedValue([menuItem]);
      menuItemRepository.findById.mockResolvedValue(menuItem);

      const order = Order.create({
        restaurantId: 'restaurant-123',
        customerId: 'customer-123',
        total: Price.create(20.00),
        status: OrderStatus.PENDING,
      });

      createOrder.execute.mockResolvedValue(order);

      // When
      await (handler as any).handleDirectOrderFromQRCode(data);

      // Then
      expect(createOrder.execute).toHaveBeenCalled();
      expect(evolutionApi.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          to: '81999999999',
          text: expect.stringContaining('Pedido criado'),
        })
      );
    });
  });
});

