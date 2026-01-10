import { Customer } from '../../../../src/domain/entities/Customer';
import { Phone } from '../../../../src/domain/value-objects/Phone';

describe('Customer', () => {
  it('should create a customer with valid data', () => {
    const phone = Phone.create('81999999999');
    const customer = Customer.create({
      phone,
      name: 'João Silva',
      address: 'Rua Teste, 123',
    });

    expect(customer.getPhone().equals(phone)).toBe(true);
    expect(customer.getName()).toBe('João Silva');
    expect(customer.getAddress()).toBe('Rua Teste, 123');
  });

  it('should create customer without name and address', () => {
    const phone = Phone.create('81999999999');
    const customer = Customer.create({
      phone,
    });

    expect(customer.getName()).toBeUndefined();
    expect(customer.getAddress()).toBeUndefined();
  });

  it('should update customer name', () => {
    const phone = Phone.create('81999999999');
    const customer = Customer.create({
      phone,
    });

    customer.updateName('João Silva');
    expect(customer.getName()).toBe('João Silva');
  });
});

