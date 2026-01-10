import { UpdateMenuItem } from '../../../../src/domain/usecases/UpdateMenuItem';
import { IMenuItemRepository } from '../../../../src/domain/repositories/IMenuItemRepository';
import { MenuItem } from '../../../../src/domain/entities/MenuItem';
import { Price } from '../../../../src/domain/value-objects/Price';

describe('UpdateMenuItem', () => {
  let updateMenuItem: UpdateMenuItem;
  let menuItemRepository: jest.Mocked<IMenuItemRepository>;

  beforeEach(() => {
    menuItemRepository = {
      findById: jest.fn(),
      findByRestaurantId: jest.fn(),
      findAvailableByRestaurantId: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };

    updateMenuItem = new UpdateMenuItem(menuItemRepository);
  });

  it('should update menu item', async () => {
    const menuItem = MenuItem.create({
      restaurantId: 'restaurant-123',
      name: 'Hambúrguer',
      price: Price.create(25.50),
      isAvailable: true,
    });

    menuItemRepository.findById.mockResolvedValue(menuItem);
    menuItemRepository.save.mockResolvedValue(menuItem);

    const result = await updateMenuItem.execute({
      id: menuItem.getId(),
      price: 30.00,
    });

    expect(result).toBeDefined();
    expect(menuItemRepository.save).toHaveBeenCalled();
  });

  it('should throw error if item not found', async () => {
    menuItemRepository.findById.mockResolvedValue(null);

    await expect(
      updateMenuItem.execute({
        id: 'invalid',
        price: 30.00,
      })
    ).rejects.toThrow('Menu item not found');
  });
});

