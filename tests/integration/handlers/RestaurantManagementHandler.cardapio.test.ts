import { RestaurantManagementHandler } from '../../../src/application/handlers/RestaurantManagementHandler';
import { EvolutionApiService } from '../../../src/infrastructure/messaging/EvolutionApiService';
import { IOrderRepository } from '../../../src/domain/repositories/IOrderRepository';
import { IMenuItemRepository } from '../../../src/domain/repositories/IMenuItemRepository';
import { NotificationService } from '../../../src/application/services/NotificationService';
import { UpdateMenuItem } from '../../../src/domain/usecases/UpdateMenuItem';
import { MessageData } from '../../../src/application/services/OrchestrationService';
import { Intent } from '../../../src/domain/enums/Intent';
import { UserContext } from '../../../src/domain/enums/UserContext';
import { Restaurant } from '../../../src/domain/entities/Restaurant';
import { Phone } from '../../../src/domain/value-objects/Phone';
import { CreateMenuItem } from '../../../src/domain/usecases/CreateMenuItem';

describe('RestaurantManagementHandler - Cadastro de Cardápio', () => {
  let handler: RestaurantManagementHandler;
  let mockEvolutionApi: jest.Mocked<EvolutionApiService>;
  let mockOrderRepository: jest.Mocked<IOrderRepository>;
  let mockMenuItemRepository: jest.Mocked<IMenuItemRepository>;
  let mockNotificationService: jest.Mocked<NotificationService>;
  let mockUpdateMenuItem: jest.Mocked<UpdateMenuItem>;
  let mockCreateMenuItem: jest.Mocked<CreateMenuItem>;

  beforeEach(() => {
    mockEvolutionApi = {
      sendMessage: jest.fn().mockResolvedValue(undefined),
    } as any;

    mockOrderRepository = {
      findByRestaurantId: jest.fn().mockResolvedValue([]),
    } as any;

    mockMenuItemRepository = {
      findByRestaurantId: jest.fn().mockResolvedValue([]),
      save: jest.fn().mockResolvedValue({} as any),
    } as any;

    mockNotificationService = {} as any;
    mockUpdateMenuItem = {} as any;
    mockCreateMenuItem = {
      execute: jest.fn().mockResolvedValue({} as any),
    } as any;

    // Criar handler sem CreateMenuItem primeiro, depois adicionar
    handler = new RestaurantManagementHandler(
      mockEvolutionApi,
      mockOrderRepository,
      mockMenuItemRepository,
      mockNotificationService,
      mockUpdateMenuItem,
      mockCreateMenuItem
    );
  });

  describe('Cenário: Restaurante finalizou onboarding e quer cadastrar cardápio', () => {
    it('deve identificar intenção CADASTRAR_ITEM_CARDAPIO quando restaurante manda "cadastrar cardápio"', async () => {
      // Arrange
      const restaurant = Restaurant.create({
        id: 'rest-123',
        name: 'Restaurante Teste',
        phone: Phone.create('81973129000'),
        isActive: true,
      });

      const messageData: MessageData = {
        from: '81973129000',
        text: 'cadastrar cardápio',
        pushName: 'Restaurante Teste',
        userContext: UserContext.RESTAURANT,
        restaurantId: restaurant.getId(),
        intent: Intent.CADASTRAR_ITEM_CARDAPIO,
      };

      // Act
      await handler.handle(Intent.CADASTRAR_ITEM_CARDAPIO, messageData);

      // Assert
      expect(mockEvolutionApi.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          to: '81973129000',
          text: expect.stringContaining('Cadastrar Item no Cardápio'),
        })
      );
    });

    it('não deve permitir cadastrar cardápio se usuário não for restaurante', async () => {
      // Arrange
      const messageData: MessageData = {
        from: '81973129000',
        text: 'cadastrar cardápio',
        pushName: 'Cliente',
        userContext: UserContext.NEW_USER,
        intent: Intent.CADASTRAR_ITEM_CARDAPIO,
      };

      // Act
      await handler.handle(Intent.CADASTRAR_ITEM_CARDAPIO, messageData);

      // Assert
      expect(mockEvolutionApi.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          to: '81973129000',
          text: expect.stringContaining('Erro: Restaurante não identificado'),
        })
      );
    });

    it('deve processar cadastro de item quando restaurante fornece nome e preço', async () => {
      // Arrange
      const restaurant = Restaurant.create({
        id: 'rest-123',
        name: 'Restaurante Teste',
        phone: Phone.create('81973129000'),
        isActive: true,
      });

      const messageData: MessageData = {
        from: '81973129000',
        text: 'Pizza Portuguesa - R$ 35,00',
        pushName: 'Restaurante Teste',
        userContext: UserContext.RESTAURANT,
        restaurantId: restaurant.getId(),
        intent: Intent.CADASTRAR_ITEM_CARDAPIO,
      };

      mockCreateMenuItem.execute.mockResolvedValue({
        id: 'item-123',
        name: 'Pizza Portuguesa',
        price: 35.0,
      } as any);

      // Act
      await handler.handle(Intent.CADASTRAR_ITEM_CARDAPIO, messageData);

      // Assert
      expect(mockCreateMenuItem.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          restaurantId: restaurant.getId(),
          name: expect.stringContaining('Pizza Portuguesa'),
          price: expect.any(Number),
        })
      );
      expect(mockEvolutionApi.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          to: '81973129000',
          text: expect.stringContaining('Item cadastrado'),
        })
      );
    });

    it('não deve iniciar novo onboarding quando restaurante já cadastrado pede para cadastrar cardápio', async () => {
      // Arrange
      const restaurant = Restaurant.create({
        id: 'rest-123',
        name: 'Restaurante Teste',
        phone: Phone.create('81973129000'),
        isActive: true,
      });

      const messageData: MessageData = {
        from: '81973129000',
        text: 'cadastrar cardápio',
        pushName: 'Restaurante Teste',
        userContext: UserContext.RESTAURANT,
        restaurantId: restaurant.getId(),
        intent: Intent.CADASTRAR_ITEM_CARDAPIO, // Não é RESTAURANT_ONBOARDING
      };

      // Act
      await handler.handle(Intent.CADASTRAR_ITEM_CARDAPIO, messageData);

      // Assert
      expect(mockEvolutionApi.sendMessage).toHaveBeenCalled();
      const call = (mockEvolutionApi.sendMessage as jest.Mock).mock.calls[0][0];
      expect(call.text).not.toContain('cadastrar seu restaurante');
      expect(call.text).not.toContain('opção 1');
    });
  });
});
