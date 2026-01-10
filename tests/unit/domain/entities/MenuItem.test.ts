import { MenuItem } from '../../../../src/domain/entities/MenuItem';
import { Price } from '../../../../src/domain/value-objects/Price';

describe('MenuItem', () => {
  it('should create a menu item with valid data', () => {
    const price = Price.create(25.50);
    const menuItem = MenuItem.create({
      restaurantId: 'restaurant-123',
      name: 'Hambúrguer',
      description: 'Hambúrguer artesanal',
      price,
    });

    expect(menuItem.getRestaurantId()).toBe('restaurant-123');
    expect(menuItem.getName()).toBe('Hambúrguer');
    expect(menuItem.getDescription()).toBe('Hambúrguer artesanal');
    expect(menuItem.getPrice().equals(price)).toBe(true);
    expect(menuItem.isAvailable()).toBe(true);
  });

  it('should create menu item without description', () => {
    const price = Price.create(25.50);
    const menuItem = MenuItem.create({
      restaurantId: 'restaurant-123',
      name: 'Hambúrguer',
      price,
    });

    expect(menuItem.getDescription()).toBeUndefined();
  });

  it('should make item available and unavailable', () => {
    const price = Price.create(25.50);
    const menuItem = MenuItem.create({
      restaurantId: 'restaurant-123',
      name: 'Hambúrguer',
      price,
    });

    expect(menuItem.isAvailable()).toBe(true);
    menuItem.setUnavailable();
    expect(menuItem.isAvailable()).toBe(false);
    menuItem.setAvailable();
    expect(menuItem.isAvailable()).toBe(true);
  });
});

