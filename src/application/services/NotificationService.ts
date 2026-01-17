import { EvolutionApiService } from '../../infrastructure/messaging/EvolutionApiService';
import { ICustomerRepository } from '../../domain/repositories/ICustomerRepository';
import { IRestaurantRepository } from '../../domain/repositories/IRestaurantRepository';
import { Order } from '../../domain/entities/Order';
import { OrderStatus } from '../../domain/enums/OrderStatus';
import { logger } from '../../shared/utils/logger';
import { MessageFormatter } from './MessageFormatter';

export class NotificationService {
  constructor(
    private readonly evolutionApi: EvolutionApiService,
    private readonly customerRepository: ICustomerRepository,
    private readonly restaurantRepository: IRestaurantRepository
  ) {}

  async notifyCustomer(customerId: string, message: string): Promise<void> {
    try {
      const customer = await this.customerRepository.findById(customerId);
      if (!customer) {
        logger.warn('Customer not found for notification', { customerId });
        return;
      }

      await this.evolutionApi.sendMessage({
        to: customer.getPhone().getValue(),
        text: message,
      });

      logger.info('Customer notified', { customerId });
    } catch (error: any) {
      logger.error('Error notifying customer', {
        error: error.message,
        customerId,
      });
    }
  }

  async notifyRestaurant(restaurantId: string, message: string): Promise<void> {
    try {
      const restaurant = await this.restaurantRepository.findById(restaurantId);
      if (!restaurant) {
        logger.warn('Restaurant not found for notification', { restaurantId });
        return;
      }

      // Por enquanto, notifica usando o telefone do restaurante
      // Futuro: buscar usuários do restaurante e notificar todos
      await this.evolutionApi.sendMessage({
        to: restaurant.getPhone().getValue(),
        text: message,
      });

      logger.info('Restaurant notified', { restaurantId });
    } catch (error: any) {
      logger.error('Error notifying restaurant', {
        error: error.message,
        restaurantId,
      });
    }
  }

  async notifyOrderCreated(order: Order): Promise<void> {
    const orderId = MessageFormatter.formatOrderNumber(order);
    const total = order.getTotal().getFormatted();

    const message = `📦 Novo pedido recebido!

Pedido #${orderId}
Total: ${total}

Use "marcar preparo" para iniciar.`;

    await this.notifyRestaurant(order.getRestaurantId(), message);
  }

  async notifyOrderStatusChanged(order: Order, newStatus: OrderStatus): Promise<void> {
    const orderId = MessageFormatter.formatOrderNumber(order);

    const statusMessages: Record<OrderStatus, string> = {
      [OrderStatus.DRAFT]: `🛠️ Seu pedido #${orderId} está sendo montado.`,
      [OrderStatus.NEW]: `🆕 Seu pedido #${orderId} foi criado.`,
      [OrderStatus.AWAITING_PAYMENT]: `⏳ Seu pedido #${orderId} está aguardando pagamento.`,
      [OrderStatus.PAID]: `💳 Seu pedido #${orderId} foi confirmado!`,
      [OrderStatus.PREPARING]: `👨‍🍳 Seu pedido #${orderId} está sendo preparado!\n\nEm breve estará pronto.`,
      [OrderStatus.READY]: `✅ Seu pedido #${orderId} está pronto para retirada!\n\nObrigado pela preferência! 🎉`,
      [OrderStatus.DELIVERED]: `🚚 Seu pedido #${orderId} foi entregue!`,
      [OrderStatus.CANCELLED]: `❌ Seu pedido #${orderId} foi cancelado.`,
      [OrderStatus.PENDING]: `⏳ Seu pedido #${orderId} está pendente.`, // Mantido para compatibilidade
    };

    const message = statusMessages[newStatus] || `Seu pedido #${orderId} mudou de status.`;

    await this.notifyCustomer(order.getCustomerId(), message);
  }

  async notifyOrderCancelled(order: Order): Promise<void> {
    const orderId = MessageFormatter.formatOrderNumber(order);

    // Notifica cliente
    await this.notifyOrderStatusChanged(order, OrderStatus.CANCELLED);

    // Notifica restaurante
    const message = `❌ Pedido #${orderId} foi cancelado pelo cliente.`;
    await this.notifyRestaurant(order.getRestaurantId(), message);
  }
}

