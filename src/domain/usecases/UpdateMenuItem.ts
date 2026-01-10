import { IMenuItemRepository } from '../repositories/IMenuItemRepository';
import { MenuItem } from '../entities/MenuItem';
import { Price } from '../value-objects/Price';

export interface UpdateMenuItemInput {
  id: string;
  name?: string;
  description?: string;
  price?: number;
  isAvailable?: boolean;
}

export class UpdateMenuItem {
  constructor(private readonly menuItemRepository: IMenuItemRepository) {}

  async execute(input: UpdateMenuItemInput): Promise<MenuItem> {
    // Buscar item
    const menuItem = await this.menuItemRepository.findById(input.id);
    if (!menuItem) {
      throw new Error('Menu item not found');
    }

    // Atualizar campos se fornecidos
    if (input.name !== undefined) {
      if (input.name.trim().length < 3) {
        throw new Error('Name must have at least 3 characters');
      }
      if (input.name.length > 100) {
        throw new Error('Name cannot exceed 100 characters');
      }
      menuItem.updateName(input.name.trim());
    }

    if (input.description !== undefined) {
      if (input.description && input.description.length > 500) {
        throw new Error('Description cannot exceed 500 characters');
      }
      menuItem.updateDescription(input.description?.trim());
    }

    if (input.price !== undefined) {
      if (input.price <= 0) {
        throw new Error('Price must be greater than 0');
      }
      if (input.price > 9999.99) {
        throw new Error('Price cannot exceed 9999.99');
      }
      menuItem.updatePrice(Price.create(input.price));
    }

    if (input.isAvailable !== undefined) {
      menuItem.setAvailable(input.isAvailable);
    }

    // Salvar
    return await this.menuItemRepository.save(menuItem);
  }
}

