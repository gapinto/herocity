import { CreateMenuItemInput } from '../../domain/usecases/CreateMenuItem';
import { UpdateMenuItemInput } from '../../domain/usecases/UpdateMenuItem';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export class MenuItemValidator {
  static validateCreate(input: CreateMenuItemInput): ValidationResult {
    const errors: string[] = [];

    if (!input.restaurantId || input.restaurantId.trim().length === 0) {
      errors.push('Restaurant ID is required');
    }

    if (!input.name || input.name.trim().length < 3) {
      errors.push('Name must have at least 3 characters');
    }

    if (input.name && input.name.length > 100) {
      errors.push('Name cannot exceed 100 characters');
    }

    if (input.description && input.description.length > 500) {
      errors.push('Description cannot exceed 500 characters');
    }

    if (!input.price || input.price <= 0) {
      errors.push('Price must be greater than 0');
    }

    if (input.price && input.price > 9999.99) {
      errors.push('Price cannot exceed 9999.99');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  static validateUpdate(input: UpdateMenuItemInput): ValidationResult {
    const errors: string[] = [];

    if (!input.id || input.id.trim().length === 0) {
      errors.push('Menu item ID is required');
    }

    if (input.name !== undefined) {
      if (input.name.trim().length < 3) {
        errors.push('Name must have at least 3 characters');
      }
      if (input.name.length > 100) {
        errors.push('Name cannot exceed 100 characters');
      }
    }

    if (input.description !== undefined && input.description && input.description.length > 500) {
      errors.push('Description cannot exceed 500 characters');
    }

    if (input.price !== undefined) {
      if (input.price <= 0) {
        errors.push('Price must be greater than 0');
      }
      if (input.price > 9999.99) {
        errors.push('Price cannot exceed 9999.99');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

