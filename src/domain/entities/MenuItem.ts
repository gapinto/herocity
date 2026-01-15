import { Price } from '../value-objects/Price';

export interface MenuItemProps {
  id?: string;
  friendlyId?: number;
  restaurantId: string;
  name: string;
  description?: string;
  price: Price;
  isAvailable?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export class MenuItem {
  private id: string;
  private friendlyId?: number;
  private restaurantId: string;
  private name: string;
  private description?: string;
  private price: Price;
  private _isAvailable: boolean;
  private createdAt: Date;
  private updatedAt: Date;

  private constructor(props: MenuItemProps) {
    this.id = props.id || '';
    this.friendlyId = props.friendlyId;
    this.restaurantId = props.restaurantId;
    this.name = props.name;
    this.description = props.description;
    this.price = props.price;
    this._isAvailable = props.isAvailable ?? true;
    this.createdAt = props.createdAt || new Date();
    this.updatedAt = props.updatedAt || new Date();
  }

  static create(props: MenuItemProps): MenuItem {
    if (!props.name || props.name.trim().length === 0) {
      throw new Error('Menu item name cannot be empty');
    }

    if (!props.restaurantId || props.restaurantId.trim().length === 0) {
      throw new Error('Restaurant ID cannot be empty');
    }

    return new MenuItem(props);
  }

  static fromPersistence(
    props: Required<Omit<MenuItemProps, 'description'>> & Partial<Pick<MenuItemProps, 'description'>>
  ): MenuItem {
    return new MenuItem(props);
  }

  getId(): string {
    return this.id;
  }

  getFriendlyId(): number | undefined {
    return this.friendlyId;
  }

  getRestaurantId(): string {
    return this.restaurantId;
  }

  getName(): string {
    return this.name;
  }

  getDescription(): string | undefined {
    return this.description;
  }

  getPrice(): Price {
    return this.price;
  }

  isAvailable(): boolean {
    return this._isAvailable;
  }

  updateName(name: string): void {
    this.name = name;
    this.updatedAt = new Date();
  }

  updateDescription(description?: string): void {
    this.description = description;
    this.updatedAt = new Date();
  }

  updatePrice(price: Price): void {
    this.price = price;
    this.updatedAt = new Date();
  }

  setAvailable(available: boolean = true): void {
    this._isAvailable = available;
    this.updatedAt = new Date();
  }

  setUnavailable(): void {
    this._isAvailable = false;
    this.updatedAt = new Date();
  }

  getCreatedAt(): Date {
    return this.createdAt;
  }

  getUpdatedAt(): Date {
    return this.updatedAt;
  }
}

