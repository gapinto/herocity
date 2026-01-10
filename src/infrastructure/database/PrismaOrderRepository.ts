import { PrismaClient } from '@prisma/client';
import { IOrderRepository } from '../../domain/repositories/IOrderRepository';
import { Order } from '../../domain/entities/Order';
import { OrderStatus } from '../../domain/enums/OrderStatus';
import { Price } from '../../domain/value-objects/Price';

export class PrismaOrderRepository implements IOrderRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Order | null> {
    const data = await this.prisma.order.findUnique({
      where: { id },
    });

    if (!data) return null;

    return Order.fromPersistence({
      id: data.id,
      restaurantId: data.restaurantId,
      customerId: data.customerId,
      status: data.status as OrderStatus,
      total: Price.create(Number(data.total)),
      paymentMethod: data.paymentMethod || undefined,
      paymentLink: data.paymentLink || undefined,
      paymentId: data.paymentId || undefined,
      platformFee: data.platformFee ? Price.create(Number(data.platformFee)) : undefined,
      restaurantAmount: data.restaurantAmount ? Price.create(Number(data.restaurantAmount)) : undefined,
      paidAt: data.paidAt || undefined,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
  }

  async findByRestaurantId(restaurantId: string): Promise<Order[]> {
    const data = await this.prisma.order.findMany({
      where: { restaurantId },
      orderBy: { createdAt: 'desc' },
    });

    return data.map((item) =>
      Order.fromPersistence({
        id: item.id,
        restaurantId: item.restaurantId,
        customerId: item.customerId,
        status: item.status as OrderStatus,
        total: Price.create(Number(item.total)),
        paymentMethod: item.paymentMethod || undefined,
        paymentLink: item.paymentLink || undefined,
        paymentId: item.paymentId || undefined,
        platformFee: item.platformFee ? Price.create(Number(item.platformFee)) : undefined,
        restaurantAmount: item.restaurantAmount ? Price.create(Number(item.restaurantAmount)) : undefined,
        paidAt: item.paidAt || undefined,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })
    );
  }

  async findByCustomerId(customerId: string): Promise<Order[]> {
    const data = await this.prisma.order.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
    });

    return data.map((item) =>
      Order.fromPersistence({
        id: item.id,
        restaurantId: item.restaurantId,
        customerId: item.customerId,
        status: item.status as OrderStatus,
        total: Price.create(Number(item.total)),
        paymentMethod: item.paymentMethod || undefined,
        paymentLink: item.paymentLink || undefined,
        paymentId: item.paymentId || undefined,
        platformFee: item.platformFee ? Price.create(Number(item.platformFee)) : undefined,
        restaurantAmount: item.restaurantAmount ? Price.create(Number(item.restaurantAmount)) : undefined,
        paidAt: item.paidAt || undefined,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })
    );
  }

  async findByStatus(status: OrderStatus): Promise<Order[]> {
    const data = await this.prisma.order.findMany({
      where: { status: status as string },
      orderBy: { createdAt: 'desc' },
    });

    return data.map((item) =>
      Order.fromPersistence({
        id: item.id,
        restaurantId: item.restaurantId,
        customerId: item.customerId,
        status: item.status as OrderStatus,
        total: Price.create(Number(item.total)),
        paymentMethod: item.paymentMethod || undefined,
        paymentLink: item.paymentLink || undefined,
        paymentId: item.paymentId || undefined,
        platformFee: item.platformFee ? Price.create(Number(item.platformFee)) : undefined,
        restaurantAmount: item.restaurantAmount ? Price.create(Number(item.restaurantAmount)) : undefined,
        paidAt: item.paidAt || undefined,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })
    );
  }

  async findByRestaurantAndStatus(
    restaurantId: string,
    status: OrderStatus
  ): Promise<Order[]> {
    const data = await this.prisma.order.findMany({
      where: {
        restaurantId,
        status: status as string,
      },
      orderBy: { createdAt: 'desc' },
    });

    return data.map((item) =>
      Order.fromPersistence({
        id: item.id,
        restaurantId: item.restaurantId,
        customerId: item.customerId,
        status: item.status as OrderStatus,
        total: Price.create(Number(item.total)),
        paymentMethod: item.paymentMethod || undefined,
        paymentLink: item.paymentLink || undefined,
        paymentId: item.paymentId || undefined,
        platformFee: item.platformFee ? Price.create(Number(item.platformFee)) : undefined,
        restaurantAmount: item.restaurantAmount ? Price.create(Number(item.restaurantAmount)) : undefined,
        paidAt: item.paidAt || undefined,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })
    );
  }

  async findByPaymentId(paymentId: string): Promise<Order | null> {
    if (!paymentId) return null;

    const data = await this.prisma.order.findFirst({
      where: { paymentId },
    });

    if (!data) return null;

    return Order.fromPersistence({
      id: data.id,
      restaurantId: data.restaurantId,
      customerId: data.customerId,
      status: data.status as OrderStatus,
      total: Price.create(Number(data.total)),
      paymentMethod: data.paymentMethod || undefined,
      paymentLink: data.paymentLink || undefined,
      paymentId: data.paymentId || undefined,
      platformFee: data.platformFee ? Price.create(Number(data.platformFee)) : undefined,
      restaurantAmount: data.restaurantAmount ? Price.create(Number(data.restaurantAmount)) : undefined,
      paidAt: data.paidAt || undefined,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
  }

  async save(order: Order): Promise<Order> {
    const data = {
      restaurantId: order.getRestaurantId(),
      customerId: order.getCustomerId(),
      status: order.getStatus() as string,
      total: order.getTotal().getValue(),
      paymentMethod: order.getPaymentMethod() || null,
      paymentLink: order.getPaymentLink() || null,
      paymentId: order.getPaymentId() || null,
      platformFee: order.getPlatformFee()?.getValue() || null,
      restaurantAmount: order.getRestaurantAmount()?.getValue() || null,
      paidAt: order.getPaidAt() || null,
    };

    const saved = await this.prisma.order.upsert({
      where: { id: order.getId() || undefined },
      create: data,
      update: data,
    });

    return Order.fromPersistence({
      id: saved.id,
      restaurantId: saved.restaurantId,
      customerId: saved.customerId,
      status: saved.status as OrderStatus,
      total: Price.create(Number(saved.total)),
      paymentMethod: saved.paymentMethod || undefined,
      paymentLink: saved.paymentLink || undefined,
      paymentId: saved.paymentId || undefined,
      platformFee: saved.platformFee ? Price.create(Number(saved.platformFee)) : undefined,
      restaurantAmount: saved.restaurantAmount ? Price.create(Number(saved.restaurantAmount)) : undefined,
      paidAt: saved.paidAt || undefined,
      createdAt: saved.createdAt,
      updatedAt: saved.updatedAt,
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.order.delete({
      where: { id },
    });
  }
}

