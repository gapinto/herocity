import { Restaurant } from '../../../../src/domain/entities/Restaurant';
import { Phone } from '../../../../src/domain/value-objects/Phone';

describe('Restaurant', () => {
  const baseAddress = {
    address: 'Rua Teste, 123',
    postalCode: '50000000',
    addressNumber: '123',
    complement: 'Sala 1',
    province: 'Centro',
    city: 'Recife',
    state: 'PE',
  };

  it('should create restaurant', () => {
    const restaurant = Restaurant.create({
      name: 'Test Restaurant',
      phone: Phone.create('81999999999'),
      ...baseAddress,
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
      ...baseAddress,
      menuRules,
    });

    expect(restaurant.getMenuRules()).toEqual(menuRules);
  });

  it('should create restaurant without menu rules', () => {
    const restaurant = Restaurant.create({
      name: 'Test Restaurant',
      phone: Phone.create('81999999999'),
      ...baseAddress,
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
      ...baseAddress,
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
      ...baseAddress,
    });

    expect(restaurant.isActive()).toBe(true);

    restaurant.deactivate();
    expect(restaurant.isActive()).toBe(false);

    restaurant.activate();
    expect(restaurant.isActive()).toBe(true);
  });

  it('should require address data for payment account', () => {
    const restaurant = Restaurant.create({
      name: 'Test Restaurant',
      phone: Phone.create('81999999999'),
      ...baseAddress,
      legalName: 'Teste LTDA',
      cpfCnpj: '12345678000190',
      birthDate: '1992-05-06',
      email: 'contato@restaurante.com.br',
      bankAccount: {
        bankCode: '001',
        agency: '1234',
        account: '567890',
        accountDigit: '1',
        accountType: 'CHECKING',
        accountHolderName: 'Teste LTDA',
      },
    });

    expect(restaurant.hasPaymentAccountData()).toBe(true);

    restaurant.updatePaymentData({ postalCode: '' });
    expect(restaurant.hasPaymentAccountData()).toBe(false);
  });

  it('should update birth date on payment data', () => {
    const restaurant = Restaurant.create({
      name: 'Test Restaurant',
      phone: Phone.create('81999999999'),
      ...baseAddress,
    });

    restaurant.updatePaymentData({ birthDate: '1992-05-06' });

    expect(restaurant.getBirthDate()).toBe('1992-05-06');
  });
});
