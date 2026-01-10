import { Restaurant } from '../../../../src/domain/entities/Restaurant';
import { Phone } from '../../../../src/domain/value-objects/Phone';

describe('Restaurant', () => {
  it('should create restaurant', () => {
    const restaurant = Restaurant.create({
      name: 'Test Restaurant',
      phone: Phone.create('81999999999'),
    });

    expect(restaurant.getName()).toBe('Test Restaurant');
    expect(restaurant.getPhone().getValue()).toBe('81999999999');
    expect(restaurant.isActive()).toBe(true);
  });

  it('should create restaurant with menu rules', () => {
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
      name: 'Test Restaurant',
      phone: Phone.create('81999999999'),
      menuRules,
    });

    expect(restaurant.getMenuRules()).toEqual(menuRules);
  });

  it('should create restaurant without menu rules', () => {
    const restaurant = Restaurant.create({
      name: 'Test Restaurant',
      phone: Phone.create('81999999999'),
    });

    expect(restaurant.getMenuRules()).toBeUndefined();
  });

  it('should restore menu rules from persistence', () => {
    const menuRules = {
      orderType: 'standard' as const,
      rules: [
        {
          type: 'minTotal' as const,
          value: 30.0,
          message: 'Pedido mínimo de R$ 30,00',
        },
      ],
    };

    const restaurant = Restaurant.fromPersistence({
      id: 'rest-123',
      name: 'Test Restaurant',
      phone: Phone.create('81999999999'),
      isActive: true,
      menuRules,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    expect(restaurant.getMenuRules()).toEqual(menuRules);
  });

  it('should activate and deactivate', () => {
    const restaurant = Restaurant.create({
      name: 'Test Restaurant',
      phone: Phone.create('81999999999'),
    });

    expect(restaurant.isActive()).toBe(true);

    restaurant.deactivate();
    expect(restaurant.isActive()).toBe(false);

    restaurant.activate();
    expect(restaurant.isActive()).toBe(true);
  });
});
