import { Phone } from '../value-objects/Phone';

export interface CustomerProps {
  id?: string;
  phone: Phone;
  name?: string;
  address?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Customer {
  private id: string;
  private phone: Phone;
  private name?: string;
  private address?: string;
  private createdAt: Date;
  private updatedAt: Date;

  private constructor(props: CustomerProps) {
    this.id = props.id || '';
    this.phone = props.phone;
    this.name = props.name;
    this.address = props.address;
    this.createdAt = props.createdAt || new Date();
    this.updatedAt = props.updatedAt || new Date();
  }

  static create(props: CustomerProps): Customer {
    return new Customer(props);
  }

  static fromPersistence(
    props: Required<Omit<CustomerProps, 'name' | 'address'>> & Partial<Pick<CustomerProps, 'name' | 'address'>>
  ): Customer {
    return new Customer(props);
  }

  getId(): string {
    return this.id;
  }

  getPhone(): Phone {
    return this.phone;
  }

  getName(): string | undefined {
    return this.name;
  }

  getAddress(): string | undefined {
    return this.address;
  }

  updateName(name: string): void {
    this.name = name;
    this.updatedAt = new Date();
  }

  updateAddress(address: string): void {
    this.address = address;
    this.updatedAt = new Date();
  }

  getCreatedAt(): Date {
    return this.createdAt;
  }

  getUpdatedAt(): Date {
    return this.updatedAt;
  }
}

