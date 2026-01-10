import { PrismaClient } from '@prisma/client';
import { IRestaurantRepository } from '../../domain/repositories/IRestaurantRepository';
import { Restaurant } from '../../domain/entities/Restaurant';
import { Phone } from '../../domain/value-objects/Phone';

export class PrismaRestaurantRepository implements IRestaurantRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Restaurant | null> {
    const data = await this.prisma.restaurant.findUnique({
      where: { id },
    });

    if (!data) return null;

    return Restaurant.fromPersistence({
      id: data.id,
      name: data.name,
      phone: Phone.create(data.phone),
      address: data.address || undefined,
      isActive: data.isActive,
      menuRules: (data.menuRules as any) || undefined,
      legalName: data.legalName || undefined,
      cpfCnpj: data.cpfCnpj || undefined,
      email: data.email || undefined,
      bankAccount: (data.bankAccount as any) || undefined,
      documentUrl: data.documentUrl || undefined,
      paymentAccountId: data.paymentAccountId || undefined,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
  }

  async findByPhone(phone: Phone): Promise<Restaurant | null> {
    const data = await this.prisma.restaurant.findUnique({
      where: { phone: phone.getValue() },
    });

    if (!data) return null;

    return Restaurant.fromPersistence({
      id: data.id,
      name: data.name,
      phone: Phone.create(data.phone),
      address: data.address || undefined,
      isActive: data.isActive,
      menuRules: (data.menuRules as any) || undefined,
      legalName: data.legalName || undefined,
      cpfCnpj: data.cpfCnpj || undefined,
      email: data.email || undefined,
      bankAccount: (data.bankAccount as any) || undefined,
      documentUrl: data.documentUrl || undefined,
      paymentAccountId: data.paymentAccountId || undefined,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
  }

  async findAll(): Promise<Restaurant[]> {
    const data = await this.prisma.restaurant.findMany({
      where: { isActive: true },
    });

    return data.map((item) =>
      Restaurant.fromPersistence({
        id: item.id,
        name: item.name,
        phone: Phone.create(item.phone),
        address: item.address || undefined,
        isActive: item.isActive,
        menuRules: (item.menuRules as any) || undefined,
        legalName: item.legalName || undefined,
        cpfCnpj: item.cpfCnpj || undefined,
        email: item.email || undefined,
        bankAccount: (item.bankAccount as any) || undefined,
        documentUrl: item.documentUrl || undefined,
        paymentAccountId: item.paymentAccountId || undefined,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })
    );
  }

  async save(restaurant: Restaurant): Promise<Restaurant> {
    const data: any = {
      name: restaurant.getName(),
      phone: restaurant.getPhone().getValue(),
      address: restaurant.getAddress() ?? null,
      isActive: restaurant.isActive(),
      menuRules: restaurant.getMenuRules() ?? null,
      legalName: restaurant.getLegalName() ?? null,
      cpfCnpj: restaurant.getCpfCnpj() ?? null,
      email: restaurant.getEmail() ?? null,
      bankAccount: restaurant.getBankAccount() ?? null,
      documentUrl: restaurant.getDocumentUrl() ?? null,
      paymentAccountId: restaurant.getPaymentAccountId() ?? null,
    };

    // Usa phone como chave única para upsert (phone é @unique no schema)
    // Se tiver ID válido (não vazio), usa ID, senão usa phone
    const restaurantId = restaurant.getId();
    const whereClause = restaurantId && restaurantId.trim() !== '' 
      ? { id: restaurantId } 
      : { phone: restaurant.getPhone().getValue() };

    const saved = await this.prisma.restaurant.upsert({
      where: whereClause,
      create: data,
      update: data,
    });

    return Restaurant.fromPersistence({
      id: saved.id,
      name: saved.name,
      phone: Phone.create(saved.phone),
      address: saved.address || undefined,
      isActive: saved.isActive,
      menuRules: (saved.menuRules as any) || undefined,
      legalName: saved.legalName || undefined,
      cpfCnpj: saved.cpfCnpj || undefined,
      email: saved.email || undefined,
      bankAccount: (saved.bankAccount as any) || undefined,
      documentUrl: saved.documentUrl || undefined,
      paymentAccountId: saved.paymentAccountId || undefined,
      createdAt: saved.createdAt,
      updatedAt: saved.updatedAt,
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.restaurant.delete({
      where: { id },
    });
  }
}

