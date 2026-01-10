import { RestaurantManagementHandler } from '../../../src/application/handlers/RestaurantManagementHandler';
import { EvolutionApiService } from '../../../src/infrastructure/messaging/EvolutionApiService';
import { IOrderRepository } from '../../../src/domain/repositories/IOrderRepository';
import { IMenuItemRepository } from '../../../src/domain/repositories/IMenuItemRepository';
import { NotificationService } from '../../../src/application/services/NotificationService';
import { UpdateMenuItem } from '../../../src/domain/usecases/UpdateMenuItem';
import { Intent } from '../../../src/domain/enums/Intent';
import { UserContext } from '../../../src/domain/enums/UserContext';
import { OrderStatus } from '../../../src/domain/enums/OrderStatus';
import { MessageData } from '../../../src/application/services/OrchestrationService';

describe('RestaurantManagementHandler Integration', () => {
  let handler: RestaurantManagementHandler;
  let evolutionApi: jest.Mocked<EvolutionApiService>;
  let orderRepository: jest.Mocked<IOrderRepository>;
  let menuItemRepository: jest.Mocked<IMenuItemRepository>;
  let notificationService: jest.Mocked<NotificationService>;
  let updateMenuItem: jest.Mocked<UpdateMenuItem>;

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

    handler = new RestaurantManagementHandler(
      evolutionApi,
      orderRepository,
      menuItemRepository,
      notificationService,
      updateMenuItem
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
});

