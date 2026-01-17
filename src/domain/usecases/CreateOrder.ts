import { IOrderRepository } from '../repositories/IOrderRepository';
import { IMenuItemRepository } from '../repositories/IMenuItemRepository';
import { IRestaurantRepository } from '../repositories/IRestaurantRepository';
import { IOrderItemRepository } from '../repositories/IOrderItemRepository';
import { IIdempotencyService } from '../services/IIdempotencyService';
import { Order } from '../entities/Order';
import { OrderItem } from '../entities/OrderItem';
import { OrderStatus } from '../enums/OrderStatus';
import { Price } from '../value-objects/Price';
import { getLocalDateStart, getTimezoneOrDefault } from '../../shared/utils/timezone';

export interface CreateOrderInput {
  restaurantId: string;
  customerId: string;
  items: Array<{
    menuItemId: string;
    quantity: number;
    modifiers?: string;
  }>;
  status?: OrderStatus;
  idempotencyKey?: string; // Chave para idempotência
}

export class CreateOrder {
  constructor(
    private readonly orderRepository: IOrderRepository,
    private readonly menuItemRepository: IMenuItemRepository,
    private readonly restaurantRepository: IRestaurantRepository,
    private readonly orderItemRepository: IOrderItemRepository,
    private readonly idempotencyService?: IIdempotencyService
  ) {}

  async execute(input: CreateOrderInput): Promise<Order> {
    // Idempotência: verifica se já existe pedido DRAFT para este cliente/restaurante
    // ou se já foi processado com a mesma chave
    if (input.idempotencyKey && this.idempotencyService) {
      const idempotencyKey = `order:create:${input.idempotencyKey}`;
      const isProcessed = await this.idempotencyService.isProcessed(idempotencyKey);
      
      if (isProcessed) {
        // Busca resultado armazenado
        const cachedOrderId = await this.idempotencyService.getResult<string>(idempotencyKey);
        if (cachedOrderId) {
          const existingOrder = await this.orderRepository.findById(cachedOrderId);
          if (
            existingOrder &&
            (existingOrder.getStatus() === OrderStatus.DRAFT || existingOrder.getStatus() === OrderStatus.NEW)
          ) {
            return existingOrder;
          }
        }

        // Fallback: busca pedido existente em DRAFT ou AWAITING_PAYMENT para o mesmo cliente/restaurante
        const existingOrders = await this.orderRepository.findByCustomerId(input.customerId);
        const draftOrder = existingOrders.find(
          (o) =>
            o.getRestaurantId() === input.restaurantId &&
            (o.getStatus() === OrderStatus.DRAFT ||
              o.getStatus() === OrderStatus.NEW ||
              o.getStatus() === OrderStatus.AWAITING_PAYMENT)
        );
        if (draftOrder) {
          // Armazena resultado para próxima vez
          await this.idempotencyService.markAsProcessed(idempotencyKey, 3600, draftOrder.getId());
          return draftOrder;
        }
      }
    }

    // 1. Validar restaurante existe e está ativo
    const restaurant = await this.restaurantRepository.findById(input.restaurantId);
    if (!restaurant || !restaurant.isActive()) {
      throw new Error('Restaurant not found or inactive');
    }

    const now = new Date();
    if (!restaurant.isOpenAt(now)) {
      throw new Error('Restaurant is closed');
    }

    // 2. Validar itens existem e estão disponíveis
    const menuItems = [];
    for (const item of input.items) {
      const menuItem = await this.menuItemRepository.findById(item.menuItemId);
      if (!menuItem) {
        throw new Error(`Menu item ${item.menuItemId} not found`);
      }
      if (!menuItem.isAvailable()) {
        throw new Error(`Menu item ${item.menuItemId} is not available`);
      }
      menuItems.push(menuItem);
    }

    // 3. Calcular total
    let total = Price.create(0);
    for (let i = 0; i < input.items.length; i++) {
      const item = input.items[i];
      const menuItem = menuItems[i];
      const itemTotal = menuItem.getPrice().multiply(item.quantity);
      total = total.add(itemTotal);
    }

    // 4. Criar Order
    const status = input.status || OrderStatus.DRAFT;
    const sequenceDate =
      status === OrderStatus.NEW
        ? getLocalDateStart(now, getTimezoneOrDefault(restaurant.getTimezone()))
        : undefined;

    const order = Order.create({
      restaurantId: input.restaurantId,
      customerId: input.customerId,
      total,
      status,
      sequenceDate,
    });

    const savedOrder = await this.orderRepository.save(order);

    // 5. Criar OrderItems
    for (let i = 0; i < input.items.length; i++) {
      const item = input.items[i];
      const menuItem = menuItems[i];

      const orderItem = OrderItem.create({
        orderId: savedOrder.getId(),
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        price: menuItem.getPrice(),
        modifiers: item.modifiers,
      });

      await this.orderItemRepository.save(orderItem);
    }

    // Marca como processado (idempotência) DEPOIS de criar com sucesso
    // Armazena orderId para retornar em chamadas subsequentes
    if (input.idempotencyKey && this.idempotencyService) {
      const idempotencyKey = `order:create:${input.idempotencyKey}`;
      await this.idempotencyService.markAsProcessed(idempotencyKey, 3600, savedOrder.getId()); // 1 hora
    }

    return savedOrder;
  }
}

