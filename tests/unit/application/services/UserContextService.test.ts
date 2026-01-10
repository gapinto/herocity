import { UserContextService } from '../../../../src/application/services/UserContextService';
import { IRestaurantRepository } from '../../../../src/domain/repositories/IRestaurantRepository';
import { ICustomerRepository } from '../../../../src/domain/repositories/ICustomerRepository';
import { Restaurant } from '../../../../src/domain/entities/Restaurant';
import { Customer } from '../../../../src/domain/entities/Customer';
import { Phone } from '../../../../src/domain/value-objects/Phone';
import { UserContext } from '../../../../src/domain/enums/UserContext';

describe('UserContextService', () => {
  let userContextService: UserContextService;
  let restaurantRepository: jest.Mocked<IRestaurantRepository>;
  let customerRepository: jest.Mocked<ICustomerRepository>;

  beforeEach(() => {
    restaurantRepository = {
      findById: jest.fn(),
      findByPhone: jest.fn(),
      findAll: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };

    customerRepository = {
      findById: jest.fn(),
      findByPhone: jest.fn(),
      findAll: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };

    userContextService = new UserContextService(restaurantRepository, customerRepository);
  });

  it('should identify restaurant user', async () => {
    const phone = Phone.create('81999999999');
    const restaurant = Restaurant.create({
      name: 'Restaurante Teste',
      phone,
    });

    restaurantRepository.findByPhone.mockResolvedValue(restaurant);
    customerRepository.findByPhone.mockResolvedValue(null);

    const context = await userContextService.identify(phone);

    expect(context.type).toBe(UserContext.RESTAURANT);
    expect(context.restaurantId).toBeDefined();
  });

  it('should identify customer user', async () => {
    const phone = Phone.create('81999999999');
    const customer = Customer.create({ phone });

    restaurantRepository.findByPhone.mockResolvedValue(null);
    customerRepository.findByPhone.mockResolvedValue(customer);

    const context = await userContextService.identify(phone);

    expect(context.type).toBe(UserContext.CUSTOMER);
    expect(context.customerId).toBeDefined();
  });

  it('should identify new user when not found', async () => {
    const phone = Phone.create('81999999999');

    restaurantRepository.findByPhone.mockResolvedValue(null);
    customerRepository.findByPhone.mockResolvedValue(null);

    const context = await userContextService.identify(phone);

    expect(context.type).toBe(UserContext.NEW_USER);
  });

  it('should prioritize restaurant over customer', async () => {
    const phone = Phone.create('81999999999');
    const restaurant = Restaurant.create({
      name: 'Restaurante Teste',
      phone,
    });
    const customer = Customer.create({ phone });

    restaurantRepository.findByPhone.mockResolvedValue(restaurant);
    customerRepository.findByPhone.mockResolvedValue(customer);

    const context = await userContextService.identify(phone);

    expect(context.type).toBe(UserContext.RESTAURANT);
  });
});

