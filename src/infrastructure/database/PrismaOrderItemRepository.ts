import { PrismaClient } from '@prisma/client';
import { IOrderItemRepository } from '../../domain/repositories/IOrderItemRepository';
import { OrderItem } from '../../domain/entities/OrderItem';
import { Price } from '../../domain/value-objects/Price';

export class PrismaOrderItemRepository implements IOrderItemRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByOrderId(orderId: string): Promise<OrderItem[]> {
    const data = await this.prisma.orderItem.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
    });

    return data.map((item) =>
      OrderItem.fromPersistence({
        id: item.id,
        orderId: item.orderId,
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        price: Price.create(Number(item.price)),
        modifiers: item.modifiers ?? undefined,
        createdAt: item.createdAt,
      })
    );
  }

  async findById(id: string): Promise<OrderItem | null> {
    const data = await this.prisma.orderItem.findUnique({
      where: { id },
    });

    if (!data) return null;

    return OrderItem.fromPersistence({
      id: data.id,
      orderId: data.orderId,
      menuItemId: data.menuItemId,
      quantity: data.quantity,
      price: Price.create(Number(data.price)),
      modifiers: data.modifiers || undefined,
      createdAt: data.createdAt,
    });
  }

  async save(orderItem: OrderItem): Promise<OrderItem> {
    const data = {
      orderId: orderItem.getOrderId(),
      menuItemId: orderItem.getMenuItemId(),
      quantity: orderItem.getQuantity(),
      price: orderItem.getPrice().getValue(),
      modifiers: orderItem.getModifiers(),
    };

    const saved = await this.prisma.orderItem.upsert({
      where: { id: orderItem.getId() || undefined },
      create: data,
      update: data,
    });

    return OrderItem.fromPersistence({
      id: saved.id,
      orderId: saved.orderId,
      menuItemId: saved.menuItemId,
      quantity: saved.quantity,
      price: Price.create(Number(saved.price)),
      modifiers: saved.modifiers || undefined,
      createdAt: saved.createdAt,
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.orderItem.delete({
      where: { id },
    });
  }

  async deleteByOrderId(orderId: string): Promise<void> {
    await this.prisma.orderItem.deleteMany({
      where: { orderId },
    });
  }
}

