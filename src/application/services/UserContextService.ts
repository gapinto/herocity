import { IRestaurantRepository } from '../../domain/repositories/IRestaurantRepository';
import { ICustomerRepository } from '../../domain/repositories/ICustomerRepository';
import { Phone } from '../../domain/value-objects/Phone';
import { UserContext } from '../../domain/enums/UserContext';

export interface UserContextResult {
  type: UserContext;
  restaurantId?: string;
  customerId?: string;
}

export class UserContextService {
  constructor(
    private readonly restaurantRepository: IRestaurantRepository,
    private readonly customerRepository: ICustomerRepository
  ) {}

  async identify(phone: Phone): Promise<UserContextResult> {
    // Verifica se é restaurante primeiro
    const restaurant = await this.restaurantRepository.findByPhone(phone);
    if (restaurant) {
      return {
        type: UserContext.RESTAURANT,
        restaurantId: restaurant.getId(),
      };
    }

    // Verifica se é cliente
    const customer = await this.customerRepository.findByPhone(phone);
    if (customer) {
      return {
        type: UserContext.CUSTOMER,
        customerId: customer.getId(),
      };
    }

    // Novo usuário
    return {
      type: UserContext.NEW_USER,
    };
  }
}

