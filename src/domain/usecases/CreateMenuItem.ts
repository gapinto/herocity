import { IMenuItemRepository } from '../repositories/IMenuItemRepository';
import { IRestaurantRepository } from '../repositories/IRestaurantRepository';
import { MenuItem } from '../entities/MenuItem';
import { Price } from '../value-objects/Price';

export interface CreateMenuItemInput {
  restaurantId: string;
  name: string;
  description?: string;
  price: number;
  isAvailable?: boolean;
}

export class CreateMenuItem {
  constructor(
    private readonly menuItemRepository: IMenuItemRepository,
    private readonly restaurantRepository: IRestaurantRepository
  ) {}

  async execute(input: CreateMenuItemInput): Promise<MenuItem> {
    // Validar restaurante existe
    const restaurant = await this.restaurantRepository.findById(input.restaurantId);
    if (!restaurant) {
      throw new Error('Restaurant not found');
    }

    // Validar preço
    if (input.price <= 0) {
      throw new Error('Price must be greater than 0');
    }

    if (input.price > 9999.99) {
      throw new Error('Price cannot exceed 9999.99');
    }

    // Validar nome
    if (!input.name || input.name.trim().length < 3) {
      throw new Error('Name must have at least 3 characters');
    }

    if (input.name.length > 100) {
      throw new Error('Name cannot exceed 100 characters');
    }

    // Validar descrição se fornecida
    if (input.description && input.description.length > 500) {
      throw new Error('Description cannot exceed 500 characters');
    }

    // Criar menu item
    const menuItem = MenuItem.create({
      restaurantId: input.restaurantId,
      name: input.name.trim(),
      description: input.description?.trim(),
      price: Price.create(input.price),
      isAvailable: input.isAvailable ?? true,
    });

    // Salvar
    return await this.menuItemRepository.save(menuItem);
  }
}

