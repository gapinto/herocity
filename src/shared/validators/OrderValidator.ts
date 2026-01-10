import { CreateOrderInput } from '../../domain/usecases/CreateOrder';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export class OrderValidator {
  static validateCreateOrder(input: CreateOrderInput): ValidationResult {
    const errors: string[] = [];

    if (!input.restaurantId || input.restaurantId.trim().length === 0) {
      errors.push('Restaurant ID is required');
    }

    if (!input.customerId || input.customerId.trim().length === 0) {
      errors.push('Customer ID is required');
    }

    if (!input.items || input.items.length === 0) {
      errors.push('Order must have at least one item');
    }

    if (input.items) {
      input.items.forEach((item, index) => {
        if (!item.menuItemId || item.menuItemId.trim().length === 0) {
          errors.push(`Item ${index + 1}: Menu item ID is required`);
        }

        if (!item.quantity || item.quantity < 1) {
          errors.push(`Item ${index + 1}: Quantity must be at least 1`);
        }

        if (item.quantity > 99) {
          errors.push(`Item ${index + 1}: Quantity cannot exceed 99`);
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

