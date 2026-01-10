import { Customer } from '../entities/Customer';
import { Phone } from '../value-objects/Phone';

export interface ICustomerRepository {
  findById(id: string): Promise<Customer | null>;
  findByPhone(phone: Phone): Promise<Customer | null>;
  findAll(): Promise<Customer[]>;
  save(customer: Customer): Promise<Customer>;
  delete(id: string): Promise<void>;
}

