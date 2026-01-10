import { PrismaClient } from '@prisma/client';
import { IMenuItemRepository } from '../../domain/repositories/IMenuItemRepository';
import { MenuItem } from '../../domain/entities/MenuItem';
import { Price } from '../../domain/value-objects/Price';

export class PrismaMenuItemRepository implements IMenuItemRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<MenuItem | null> {
    const data = await this.prisma.menuItem.findUnique({
      where: { id },
    });

    if (!data) return null;

    return MenuItem.fromPersistence({
      id: data.id,
      restaurantId: data.restaurantId,
      name: data.name,
      description: data.description || undefined,
      price: Price.create(Number(data.price)),
      isAvailable: data.isAvailable,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
  }

  async findByRestaurantId(restaurantId: string): Promise<MenuItem[]> {
    const data = await this.prisma.menuItem.findMany({
      where: { restaurantId },
      orderBy: { name: 'asc' },
    });

    return data.map((item) =>
      MenuItem.fromPersistence({
        id: item.id,
        restaurantId: item.restaurantId,
        name: item.name,
        description: item.description || undefined,
        price: Price.create(Number(item.price)),
        isAvailable: item.isAvailable,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })
    );
  }

  async findAvailableByRestaurantId(restaurantId: string): Promise<MenuItem[]> {
    const data = await this.prisma.menuItem.findMany({
      where: {
        restaurantId,
        isAvailable: true,
      },
      orderBy: { name: 'asc' },
    });

    return data.map((item) =>
      MenuItem.fromPersistence({
        id: item.id,
        restaurantId: item.restaurantId,
        name: item.name,
        description: item.description || undefined,
        price: Price.create(Number(item.price)),
        isAvailable: item.isAvailable,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })
    );
  }

  async save(menuItem: MenuItem): Promise<MenuItem> {
    const data = {
      restaurantId: menuItem.getRestaurantId(),
      name: menuItem.getName(),
      description: menuItem.getDescription(),
      price: menuItem.getPrice().getValue(),
      isAvailable: menuItem.isAvailable(),
    };

    const saved = await this.prisma.menuItem.upsert({
      where: { id: menuItem.getId() || undefined },
      create: data,
      update: data,
    });

    return MenuItem.fromPersistence({
      id: saved.id,
      restaurantId: saved.restaurantId,
      name: saved.name,
      description: saved.description || undefined,
      price: Price.create(Number(saved.price)),
      isAvailable: saved.isAvailable,
      createdAt: saved.createdAt,
      updatedAt: saved.updatedAt,
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.menuItem.delete({
      where: { id },
    });
  }
}

