import { MenuItem } from '../entities/MenuItem';

export interface IMenuItemRepository {
  findById(id: string): Promise<MenuItem | null>;
  findByRestaurantId(restaurantId: string): Promise<MenuItem[]>;
  findAvailableByRestaurantId(restaurantId: string): Promise<MenuItem[]>;
  save(menuItem: MenuItem): Promise<MenuItem>;
  delete(id: string): Promise<void>;
}

