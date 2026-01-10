import { Restaurant } from '../entities/Restaurant';
import { Phone } from '../value-objects/Phone';

export interface IRestaurantRepository {
  findById(id: string): Promise<Restaurant | null>;
  findByPhone(phone: Phone): Promise<Restaurant | null>;
  findAll(): Promise<Restaurant[]>;
  save(restaurant: Restaurant): Promise<Restaurant>;
  delete(id: string): Promise<void>;
}

