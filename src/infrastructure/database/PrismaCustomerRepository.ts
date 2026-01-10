import { PrismaClient } from '@prisma/client';
import { ICustomerRepository } from '../../domain/repositories/ICustomerRepository';
import { Customer } from '../../domain/entities/Customer';
import { Phone } from '../../domain/value-objects/Phone';

export class PrismaCustomerRepository implements ICustomerRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Customer | null> {
    const data = await this.prisma.customer.findUnique({
      where: { id },
    });

    if (!data) return null;

    return Customer.fromPersistence({
      id: data.id,
      phone: Phone.create(data.phone),
      name: data.name ?? undefined,
      address: data.address ?? undefined,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
  }

  async findByPhone(phone: Phone): Promise<Customer | null> {
    const data = await this.prisma.customer.findUnique({
      where: { phone: phone.getValue() },
    });

    if (!data) return null;

    return Customer.fromPersistence({
      id: data.id,
      phone: Phone.create(data.phone),
      name: data.name ?? undefined,
      address: data.address ?? undefined,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
  }

  async findAll(): Promise<Customer[]> {
    const data = await this.prisma.customer.findMany();

    return data.map((item) =>
      Customer.fromPersistence({
        id: item.id,
        phone: Phone.create(item.phone),
        name: item.name ?? undefined,
        address: item.address ?? undefined,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })
    );
  }

  async save(customer: Customer): Promise<Customer> {
    const data = {
      phone: customer.getPhone().getValue(),
      name: customer.getName(),
      address: customer.getAddress(),
    };

    const saved = await this.prisma.customer.upsert({
      where: { id: customer.getId() || undefined },
      create: data,
      update: data,
    });

    return Customer.fromPersistence({
      id: saved.id,
      phone: Phone.create(saved.phone),
      name: saved.name ?? undefined,
      address: saved.address ?? undefined,
      createdAt: saved.createdAt,
      updatedAt: saved.updatedAt,
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.customer.delete({
      where: { id },
    });
  }
}

