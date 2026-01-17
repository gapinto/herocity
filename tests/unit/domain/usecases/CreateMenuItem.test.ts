import { CreateMenuItem } from '../../../../src/domain/usecases/CreateMenuItem';
import { IMenuItemRepository } from '../../../../src/domain/repositories/IMenuItemRepository';
import { IRestaurantRepository } from '../../../../src/domain/repositories/IRestaurantRepository';
import { Restaurant } from '../../../../src/domain/entities/Restaurant';
import { MenuItem } from '../../../../src/domain/entities/MenuItem';
import { Phone } from '../../../../src/domain/value-objects/Phone';
import { Price } from '../../../../src/domain/value-objects/Price';

describe('CreateMenuItem', () => {
  let createMenuItem: CreateMenuItem;
  let menuItemRepository: jest.Mocked<IMenuItemRepository>;
  let restaurantRepository: jest.Mocked<IRestaurantRepository>;
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

    createMenuItem = new CreateMenuItem(menuItemRepository, restaurantRepository);
  });

  it('should create menu item with valid data', async () => {
    const restaurant = Restaurant.create({
      id: 'restaurant-123',
      name: 'Restaurante Teste',
      phone: Phone.create('81999999999'),
      ...baseAddress,
      isActive: true,
    });

    restaurantRepository.findById.mockResolvedValue(restaurant);

    const savedMenuItem = MenuItem.create({
      restaurantId: restaurant.getId(),
      name: 'Hambúrguer',
      price: Price.create(25.50),
      isAvailable: true,
    });
    menuItemRepository.save.mockResolvedValue(savedMenuItem);

    const result = await createMenuItem.execute({
      restaurantId: restaurant.getId(),
      name: 'Hambúrguer',
      price: 25.50,
      isAvailable: true,
    });

    expect(result).toBeDefined();
    expect(menuItemRepository.save).toHaveBeenCalled();
  });

  it('should throw error if restaurant not found', async () => {
    restaurantRepository.findById.mockResolvedValue(null);

    await expect(
      createMenuItem.execute({
        restaurantId: 'invalid',
        name: 'Hambúrguer',
        price: 25.50,
      })
    ).rejects.toThrow('Restaurant not found');
  });

  it('should throw error if price is invalid', async () => {
    const restaurant = Restaurant.create({
      id: 'restaurant-123',
      name: 'Restaurante Teste',
      phone: Phone.create('81999999999'),
      ...baseAddress,
      isActive: true,
    });

    restaurantRepository.findById.mockResolvedValue(restaurant);

    await expect(
      createMenuItem.execute({
        restaurantId: restaurant.getId(),
        name: 'Hambúrguer',
        price: -10,
      })
    ).rejects.toThrow();
  });
});

