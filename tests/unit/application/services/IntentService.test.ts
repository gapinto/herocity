import { IntentService } from '../../../../src/application/services/IntentService';
import { DeepSeekService, IntentResult } from '../../../../src/infrastructure/ai/DeepSeekService';
import { IMenuItemRepository } from '../../../../src/domain/repositories/IMenuItemRepository';
import { IRestaurantRepository } from '../../../../src/domain/repositories/IRestaurantRepository';
import { UserContext } from '../../../../src/domain/enums/UserContext';
import { Intent } from '../../../../src/domain/enums/Intent';
import { MenuItem } from '../../../../src/domain/entities/MenuItem';
import { Price } from '../../../../src/domain/value-objects/Price';
import { Restaurant } from '../../../../src/domain/entities/Restaurant';
import { Phone } from '../../../../src/domain/value-objects/Phone';

describe('IntentService', () => {
  let service: IntentService;
  let deepSeekService: jest.Mocked<DeepSeekService>;
  let menuItemRepository: jest.Mocked<IMenuItemRepository>;
  let restaurantRepository: jest.Mocked<IRestaurantRepository>;

  beforeEach(() => {
    deepSeekService = {
      identifyIntent: jest.fn(),
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

    service = new IntentService(deepSeekService, menuItemRepository, restaurantRepository);
  });

  it('should identify intent without menu items', async () => {
    const result: IntentResult = {
      intent: Intent.CRIAR_PEDIDO,
      confidence: 0.9,
    };

    deepSeekService.identifyIntent.mockResolvedValue(result);

    const response = await service.identify('quero fazer um pedido', UserContext.CUSTOMER);

    expect(response).toEqual(result);
    expect(deepSeekService.identifyIntent).toHaveBeenCalledWith(
      'quero fazer um pedido',
      UserContext.CUSTOMER,
      undefined,
      null
    );
  });

  it('should identify intent with menu items when restaurantId is provided', async () => {
    const menuItem1 = MenuItem.create({
      restaurantId: 'restaurant-123',
      name: 'Hambúrguer Clássico',
      price: Price.create(25.00),
      isAvailable: true,
    });

    const menuItem2 = MenuItem.create({
      restaurantId: 'restaurant-123',
      name: 'Refrigerante',
      price: Price.create(5.00),
      isAvailable: true,
    });

    menuItemRepository.findAvailableByRestaurantId.mockResolvedValue([menuItem1, menuItem2]);
    restaurantRepository.findById.mockResolvedValue(null);

    const result: IntentResult = {
      intent: Intent.CRIAR_PEDIDO_QR_CODE,
      confidence: 0.95,
      items: [{ name: 'Hambúrguer Clássico', quantity: 2 }],
    };

    deepSeekService.identifyIntent.mockResolvedValue(result);

    const response = await service.identify(
      'quero 2 hambúrgueres',
      UserContext.CUSTOMER,
      'restaurant-123'
    );

    expect(response).toEqual(result);
    expect(menuItemRepository.findAvailableByRestaurantId).toHaveBeenCalledWith('restaurant-123');
    expect(deepSeekService.identifyIntent).toHaveBeenCalledWith(
      'quero 2 hambúrgueres',
      UserContext.CUSTOMER,
      expect.arrayContaining([
        expect.objectContaining({ name: 'Hambúrguer Clássico', price: expect.stringContaining('R$') }),
        expect.objectContaining({ name: 'Refrigerante', price: expect.stringContaining('R$') }),
      ]),
      null
    );
  });

  it('should handle error when fetching menu items', async () => {
    menuItemRepository.findAvailableByRestaurantId.mockRejectedValue(
      new Error('Database error')
    );

    const result: IntentResult = {
      intent: Intent.CRIAR_PEDIDO,
      confidence: 0.9,
    };

    deepSeekService.identifyIntent.mockResolvedValue(result);

    const response = await service.identify(
      'quero fazer um pedido',
      UserContext.CUSTOMER,
      'restaurant-123'
    );

    // Deve continuar sem cardápio se der erro
    expect(response.intent).toBe(result.intent);
    expect(response.confidence).toBe(result.confidence);
    expect(deepSeekService.identifyIntent).toHaveBeenCalledWith(
      'quero fazer um pedido',
      UserContext.CUSTOMER,
      undefined,
      null
    );
  });

  it('should return help intent on error', async () => {
    deepSeekService.identifyIntent.mockRejectedValue(new Error('API error'));

    const response = await service.identify('test', UserContext.CUSTOMER);

    expect(response.intent).toBe(Intent.SOLICITAR_AJUDA);
    expect(response.confidence).toBe(0.0);
  });

  it('should fetch menu rules from restaurant and pass to DeepSeek', async () => {
    const menuRules = {
      orderType: 'combo' as const,
      rules: [
        {
          type: 'required' as const,
          category: 'protein',
          message: 'Escolha uma proteína',
        },
      ],
    };

    const restaurant = Restaurant.create({
      id: 'rest-123',
      name: 'Test Restaurant',
      phone: Phone.create('81999999999'),
      menuRules,
    });

    restaurantRepository.findById.mockResolvedValue(restaurant);

    const menuItem = MenuItem.create({
      restaurantId: 'rest-123',
      name: 'Frango Grelhado',
      price: Price.create(25.00),
      isAvailable: true,
    });

    menuItemRepository.findAvailableByRestaurantId.mockResolvedValue([menuItem]);

    const result: IntentResult = {
      intent: Intent.CRIAR_PEDIDO_QR_CODE,
      confidence: 0.95,
      items: [{ name: 'Frango Grelhado', quantity: 1 }],
      validation: {
        isValid: true,
        isComplete: true,
        missingRequired: [],
        warnings: [],
        errors: [],
      },
    };

    deepSeekService.identifyIntent.mockResolvedValue(result);

    await service.identify(
      'quero um frango',
      UserContext.CUSTOMER,
      'rest-123'
    );

    expect(restaurantRepository.findById).toHaveBeenCalledWith('rest-123');
    expect(deepSeekService.identifyIntent).toHaveBeenCalledWith(
      'quero um frango',
      UserContext.CUSTOMER,
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Frango Grelhado',
          price: expect.stringContaining('R$'),
        }),
      ]),
      menuRules
    );
    expect(result.validation).toBeDefined();
  });

  it('should work without menu rules when restaurant has none', async () => {
    const restaurant = Restaurant.create({
      id: 'rest-123',
      name: 'Test Restaurant',
      phone: Phone.create('81999999999'),
    });

    restaurantRepository.findById.mockResolvedValue(restaurant);

    const menuItem = MenuItem.create({
      restaurantId: 'rest-123',
      name: 'Hambúrguer',
      price: Price.create(20.00),
      isAvailable: true,
    });

    menuItemRepository.findAvailableByRestaurantId.mockResolvedValue([menuItem]);

    const result: IntentResult = {
      intent: Intent.CRIAR_PEDIDO_QR_CODE,
      confidence: 0.9,
      items: [{ name: 'Hambúrguer', quantity: 1 }],
    };

    deepSeekService.identifyIntent.mockResolvedValue(result);

    await service.identify(
      'quero um hambúrguer',
      UserContext.CUSTOMER,
      'rest-123'
    );

    expect(deepSeekService.identifyIntent).toHaveBeenCalledWith(
      'quero um hambúrguer',
      UserContext.CUSTOMER,
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Hambúrguer',
          price: expect.stringContaining('R$'),
        }),
      ]),
      null
    );
  });
});
