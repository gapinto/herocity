import { RestaurantManagementHandler } from '../../../src/application/handlers/RestaurantManagementHandler';
import { EvolutionApiService } from '../../../src/infrastructure/messaging/EvolutionApiService';
import { IOrderRepository } from '../../../src/domain/repositories/IOrderRepository';
import { IMenuItemRepository } from '../../../src/domain/repositories/IMenuItemRepository';
import { IOrderItemRepository } from '../../../src/domain/repositories/IOrderItemRepository';
import { NotificationService } from '../../../src/application/services/NotificationService';
import { UpdateMenuItem } from '../../../src/domain/usecases/UpdateMenuItem';
import { CreateMenuItem } from '../../../src/domain/usecases/CreateMenuItem';
import { Intent } from '../../../src/domain/enums/Intent';
import { UserContext } from '../../../src/domain/enums/UserContext';
import { OrderStatus } from '../../../src/domain/enums/OrderStatus';
import { MessageData } from '../../../src/application/services/OrchestrationService';
import { Order } from '../../../src/domain/entities/Order';
import { Price } from '../../../src/domain/value-objects/Price';
import { OrderItem } from '../../../src/domain/entities/OrderItem';

describe('RestaurantManagementHandler Integration', () => {
  let handler: RestaurantManagementHandler;
  let evolutionApi: jest.Mocked<EvolutionApiService>;
  let orderRepository: jest.Mocked<IOrderRepository>;
  let menuItemRepository: jest.Mocked<IMenuItemRepository>;
  let orderItemRepository: jest.Mocked<IOrderItemRepository>;
  let notificationService: jest.Mocked<NotificationService>;
  let updateMenuItem: jest.Mocked<UpdateMenuItem>;
  let createMenuItem: jest.Mocked<CreateMenuItem>;

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

    orderItemRepository = {
      findByOrderId: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    } as any;

    notificationService = {
      notifyCustomer: jest.fn(),
      notifyRestaurant: jest.fn(),
      notifyOrderCreated: jest.fn(),
      notifyOrderStatusChanged: jest.fn(),
      notifyOrderCancelled: jest.fn(),
    } as any;

    updateMenuItem = {
      execute: jest.fn(),
    } as any;

    createMenuItem = {
      execute: jest.fn(),
    } as any;

    handler = new RestaurantManagementHandler(
      evolutionApi,
      orderRepository,
      menuItemRepository,
      orderItemRepository,
      notificationService,
      updateMenuItem,
      createMenuItem
    );
  });

  describe('Given a restaurant wants to mark order as preparing', () => {
    it('should update order status and notify customer', async () => {
      // Given
      const data: MessageData = {
        from: '81999999999',
        text: 'marcar pedido em preparo',
        userContext: UserContext.RESTAURANT,
        restaurantId: 'restaurant-123',
      };

      const order = {
        getId: () => 'order-123',
        getStatus: () => OrderStatus.PAID,
        updateStatus: jest.fn(),
        getCustomerId: () => 'customer-123',
        getRestaurantId: () => 'restaurant-123',
      };

      orderRepository.findByRestaurantAndStatus = jest.fn().mockResolvedValue([order] as any);
      orderRepository.save = jest.fn().mockResolvedValue(order);

      // When
      await handler.handle(Intent.MARCAR_PEDIDO_PREPARO, data);

      // Then
      expect(order.updateStatus).toHaveBeenCalledWith(OrderStatus.PREPARING);
      expect(orderRepository.save).toHaveBeenCalled();
      expect(notificationService.notifyOrderStatusChanged).toHaveBeenCalled();
    });
  });

  describe('Given a restaurant wants to view menu', () => {
    it('should return formatted menu', async () => {
      // Given
      const data: MessageData = {
        from: '81999999999',
        text: 'consultar estoque',
        userContext: UserContext.RESTAURANT,
        restaurantId: 'restaurant-123',
      };

      menuItemRepository.findByRestaurantId = jest.fn().mockResolvedValue([
        {
          getId: () => 'item-1',
          getName: () => 'Hambúrguer',
          getPrice: () => ({ getFormatted: () => 'R$ 25,00' }),
          isAvailable: () => true,
        },
      ] as any);

      // When
      await handler.handle(Intent.ATUALIZAR_ESTOQUE, data);

      // Then
      expect(evolutionApi.sendMessage).toHaveBeenCalled();
      expect(menuItemRepository.findByRestaurantId).toHaveBeenCalledWith('restaurant-123');
    });
  });

  describe('Given a restaurant wants to view kitchen queue', () => {
    it('should return preparing then top ready orders', async () => {
      const data: MessageData = {
        from: '81999999999',
        text: 'fila cozinha',
        userContext: UserContext.RESTAURANT,
        restaurantId: 'restaurant-123',
      };

      const makeOrder = (id: string, status: OrderStatus, createdAt: Date) =>
        Order.create({
          id,
          restaurantId: 'restaurant-123',
          customerId: 'customer-123',
          status,
          total: Price.create(25),
          createdAt,
        });

      const preparingOrders = [
        makeOrder('prep-2', OrderStatus.PREPARING, new Date('2024-01-02')),
        makeOrder('prep-1', OrderStatus.PREPARING, new Date('2024-01-01')),
      ];
      const readyOrders = [
        makeOrder('ready-1', OrderStatus.READY, new Date('2024-01-01')),
        makeOrder('ready-2', OrderStatus.READY, new Date('2024-01-02')),
      ];

      orderRepository.findByRestaurantAndStatus = jest
        .fn()
        .mockImplementation((_, status: OrderStatus) => {
          if (status === OrderStatus.PREPARING) return Promise.resolve(preparingOrders);
          if (status === OrderStatus.READY) return Promise.resolve(readyOrders);
          return Promise.resolve([]);
        });

      await handler.handle(Intent.CONSULTAR_FILA_COZINHA, data);

      const message = (evolutionApi.sendMessage as jest.Mock).mock.calls[0][0].text;
      expect(message).toContain('prep-1'.slice(0, 8));
      expect(message).toContain('prep-2'.slice(0, 8));
      expect(message).toContain('ready-1'.slice(0, 8));
    });
  });

  describe('Given a restaurant wants kitchen order details', () => {
    it('should return order items for provided id prefix', async () => {
      const data: MessageData = {
        from: '81999999999',
        text: 'detalhe order-123',
        userContext: UserContext.RESTAURANT,
        restaurantId: 'restaurant-123',
      };

      const order = Order.create({
        id: 'order-123',
        restaurantId: 'restaurant-123',
        customerId: 'customer-123',
        status: OrderStatus.PREPARING,
        total: Price.create(40),
      });

      orderRepository.findByRestaurantId = jest.fn().mockResolvedValue([order]);
      orderItemRepository.findByOrderId = jest.fn().mockResolvedValue([
        OrderItem.create({
          orderId: order.getId(),
          menuItemId: 'item-1',
          quantity: 2,
          price: Price.create(10),
        }),
      ]);
      menuItemRepository.findById = jest.fn().mockResolvedValue({
        getName: () => 'Hambúrguer',
      } as any);

      await handler.handle(Intent.DETALHAR_PEDIDO_COZINHA, data);

      const message = (evolutionApi.sendMessage as jest.Mock).mock.calls[0][0].text;
      expect(message).toContain('Hambúrguer');
      expect(message).toContain('Pedido #order-12');
    });
  });
});

