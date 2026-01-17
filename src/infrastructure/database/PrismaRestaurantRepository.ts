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
      address: data.address,
      postalCode: data.postalCode,
      addressNumber: data.addressNumber,
      complement: data.complement,
      province: data.province,
      city: data.city,
      state: data.state,
      isActive: data.isActive,
      menuRules: (data.menuRules as any) || undefined,
      legalName: data.legalName || undefined,
      cpfCnpj: data.cpfCnpj || undefined,
      email: data.email || undefined,
      bankAccount: (data.bankAccount as any) || undefined,
      documentUrl: data.documentUrl || undefined,
      birthDate: data.birthDate || undefined,
      paymentAccountId: data.paymentAccountId || undefined,
      paymentWalletId: data.paymentWalletId || undefined,
      paymentWebhookUrl: data.paymentWebhookUrl || undefined,
      paymentWebhookToken: data.paymentWebhookToken || undefined,
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
      address: data.address,
      postalCode: data.postalCode,
      addressNumber: data.addressNumber,
      complement: data.complement,
      province: data.province,
      city: data.city,
      state: data.state,
      isActive: data.isActive,
      menuRules: (data.menuRules as any) || undefined,
      legalName: data.legalName || undefined,
      cpfCnpj: data.cpfCnpj || undefined,
      email: data.email || undefined,
      bankAccount: (data.bankAccount as any) || undefined,
      documentUrl: data.documentUrl || undefined,
      birthDate: data.birthDate || undefined,
      paymentAccountId: data.paymentAccountId || undefined,
      paymentWalletId: data.paymentWalletId || undefined,
      paymentWebhookUrl: data.paymentWebhookUrl || undefined,
      paymentWebhookToken: data.paymentWebhookToken || undefined,
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
        address: item.address,
        postalCode: item.postalCode,
        addressNumber: item.addressNumber,
        complement: item.complement,
        province: item.province,
        city: item.city,
        state: item.state,
        isActive: item.isActive,
        menuRules: (item.menuRules as any) || undefined,
        legalName: item.legalName || undefined,
        cpfCnpj: item.cpfCnpj || undefined,
        email: item.email || undefined,
        bankAccount: (item.bankAccount as any) || undefined,
        documentUrl: item.documentUrl || undefined,
        birthDate: item.birthDate || undefined,
        paymentAccountId: item.paymentAccountId || undefined,
        paymentWalletId: item.paymentWalletId || undefined,
        paymentWebhookUrl: item.paymentWebhookUrl || undefined,
        paymentWebhookToken: item.paymentWebhookToken || undefined,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })
    );
  }

  async save(restaurant: Restaurant): Promise<Restaurant> {
    const data: any = {
      name: restaurant.getName(),
      phone: restaurant.getPhone().getValue(),
      address: restaurant.getAddress(),
      postalCode: restaurant.getPostalCode(),
      addressNumber: restaurant.getAddressNumber(),
      complement: restaurant.getComplement(),
      province: restaurant.getProvince(),
      city: restaurant.getCity(),
      state: restaurant.getState(),
      isActive: restaurant.isActive(),
      menuRules: restaurant.getMenuRules() ?? null,
      legalName: restaurant.getLegalName() ?? null,
      cpfCnpj: restaurant.getCpfCnpj() ?? null,
      email: restaurant.getEmail() ?? null,
      bankAccount: restaurant.getBankAccount() ?? null,
      documentUrl: restaurant.getDocumentUrl() ?? null,
      birthDate: restaurant.getBirthDate() ?? null,
      paymentAccountId: restaurant.getPaymentAccountId() ?? null,
      paymentWalletId: restaurant.getPaymentWalletId() ?? null,
      paymentWebhookUrl: restaurant.getPaymentWebhookUrl() ?? null,
      paymentWebhookToken: restaurant.getPaymentWebhookToken() ?? null,
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
      address: saved.address,
      postalCode: saved.postalCode,
      addressNumber: saved.addressNumber,
      complement: saved.complement,
      province: saved.province,
      city: saved.city,
      state: saved.state,
      isActive: saved.isActive,
      menuRules: (saved.menuRules as any) || undefined,
      legalName: saved.legalName || undefined,
      cpfCnpj: saved.cpfCnpj || undefined,
      email: saved.email || undefined,
      bankAccount: (saved.bankAccount as any) || undefined,
      documentUrl: saved.documentUrl || undefined,
      birthDate: saved.birthDate || undefined,
      paymentAccountId: saved.paymentAccountId || undefined,
      paymentWalletId: saved.paymentWalletId || undefined,
      paymentWebhookUrl: saved.paymentWebhookUrl || undefined,
      paymentWebhookToken: saved.paymentWebhookToken || undefined,
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

