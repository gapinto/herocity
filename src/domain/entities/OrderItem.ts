import { Price } from '../value-objects/Price';

export interface OrderItemProps {
  id?: string;
  orderId: string;
  menuItemId: string;
  quantity: number;
  price: Price;
  modifiers?: string;
  createdAt?: Date;
}

export class OrderItem {
  private id: string;
  private orderId: string;
  private menuItemId: string;
  private quantity: number;
  private price: Price;
  private modifiers?: string;
  private createdAt: Date;

  private constructor(props: OrderItemProps) {
    this.id = props.id || '';
    this.orderId = props.orderId;
    this.menuItemId = props.menuItemId;
    this.quantity = props.quantity;
    this.price = props.price;
    this.modifiers = props.modifiers;
    this.createdAt = props.createdAt || new Date();
  }

  static create(props: OrderItemProps): OrderItem {
    if (!props.orderId || props.orderId.trim().length === 0) {
      throw new Error('Order ID cannot be empty');
    }

    if (!props.menuItemId || props.menuItemId.trim().length === 0) {
      throw new Error('Menu item ID cannot be empty');
    }

    if (props.quantity < 1 || props.quantity > 99) {
      throw new Error('Quantity must be between 1 and 99');
    }

    return new OrderItem(props);
  }

  static fromPersistence(
    props: Required<Omit<OrderItemProps, 'modifiers'>> & Partial<Pick<OrderItemProps, 'modifiers'>>
  ): OrderItem {
    return new OrderItem(props);
  }

  getId(): string {
    return this.id;
  }

  getOrderId(): string {
    return this.orderId;
  }

  getMenuItemId(): string {
    return this.menuItemId;
  }

  getQuantity(): number {
    return this.quantity;
  }

  getPrice(): Price {
    return this.price;
  }

  getModifiers(): string | undefined {
    return this.modifiers;
  }

  getSubtotal(): Price {
    return this.price.multiply(this.quantity);
  }

  getCreatedAt(): Date {
    return this.createdAt;
  }
}

