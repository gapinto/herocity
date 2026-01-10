import { Intent } from '../../domain/enums/Intent';
import { MessageData } from '../services/OrchestrationService';
import { EvolutionApiService } from '../../infrastructure/messaging/EvolutionApiService';
import { IOrderRepository } from '../../domain/repositories/IOrderRepository';
import { IMenuItemRepository } from '../../domain/repositories/IMenuItemRepository';
import { OrderStatus } from '../../domain/enums/OrderStatus';
import { NotificationService } from '../services/NotificationService';
import { UpdateMenuItem } from '../../domain/usecases/UpdateMenuItem';
import { MessageFormatter } from '../services/MessageFormatter';
import { logger } from '../../shared/utils/logger';

export class RestaurantManagementHandler {
  constructor(
    private readonly evolutionApi: EvolutionApiService,
    private readonly orderRepository: IOrderRepository,
    private readonly menuItemRepository: IMenuItemRepository,
    private readonly notificationService: NotificationService,
    private readonly updateMenuItem: UpdateMenuItem
  ) {}

  async handle(intent: Intent, data: MessageData): Promise<void> {
    try {
      switch (intent) {
        case Intent.ATUALIZAR_ESTOQUE:
          await this.handleUpdateStock(data);
          break;
        case Intent.MARCAR_PEDIDO_PREPARO:
          await this.handleMarkPreparing(data);
          break;
        case Intent.MARCAR_PEDIDO_PRONTO:
          await this.handleMarkReady(data);
          break;
        case Intent.CONSULTAR_PEDIDOS_PENDENTES:
          await this.handleListPending(data);
          break;
        case Intent.BLOQUEAR_ITEM_CARDAPIO:
          await this.handleBlockItem(data);
          break;
        case Intent.DESBLOQUEAR_ITEM_CARDAPIO:
          await this.handleUnblockItem(data);
          break;
        default:
          await this.evolutionApi.sendMessage({
            to: data.from,
            text: 'Comando não reconhecido. Digite "ajuda" para ver os comandos disponíveis.',
          });
      }
    } catch (error: any) {
      logger.error('Error in RestaurantManagementHandler', {
        error: error.message,
        intent,
        from: data.from,
      });
      throw error;
    }
  }

  private async handleUpdateStock(data: MessageData): Promise<void> {
    if (!data.restaurantId) {
      await this.evolutionApi.sendMessage({
        to: data.from,
        text: '❌ Erro: Restaurante não identificado.',
      });
      return;
    }

    try {
      // Busca itens do cardápio
      const items = await this.menuItemRepository.findByRestaurantId(data.restaurantId);

      if (items.length === 0) {
        await this.evolutionApi.sendMessage({
          to: data.from,
          text: '📋 Você ainda não tem itens no cardápio.\n\nPara adicionar itens, use o comando "adicionar item" ou configure pelo painel administrativo.',
        });
        return;
      }

      const message = MessageFormatter.formatMenu(items);
      await this.evolutionApi.sendMessage({
        to: data.from,
        text: `${message}\n\nPara atualizar o estoque de um item, digite:\n• "bloquear [número]" - Para marcar como indisponível\n• "desbloquear [número]" - Para marcar como disponível\n\nExemplo: "bloquear 1" ou "desbloquear 2"`,
      });
    } catch (error: any) {
      logger.error('Error updating stock', { error: error.message });
      await this.evolutionApi.sendMessage({
        to: data.from,
        text: '❌ Erro ao consultar cardápio.',
      });
    }
  }

  private async handleMarkPreparing(data: MessageData): Promise<void> {
    if (!data.restaurantId) {
      await this.evolutionApi.sendMessage({
        to: data.from,
        text: '❌ Erro: Restaurante não identificado.',
      });
      return;
    }

    try {
      const orders = await this.orderRepository.findByRestaurantAndStatus(
        data.restaurantId,
        OrderStatus.PAID
      );

      if (orders.length === 0) {
        await this.evolutionApi.sendMessage({
          to: data.from,
          text: '✅ Não há pedidos pagos aguardando preparo.',
        });
        return;
      }

      // Pega o primeiro pedido pago
      const order = orders[0];
      order.updateStatus(OrderStatus.PREPARING);
      await this.orderRepository.save(order);

      // Notifica cliente
      await this.notificationService.notifyOrderStatusChanged(order, OrderStatus.PREPARING);

      await this.evolutionApi.sendMessage({
        to: data.from,
        text: `✅ Pedido #${order.getId().slice(0, 8)} marcado como em preparo!\n\nCliente foi notificado.`,
      });
    } catch (error: any) {
      logger.error('Error marking order as preparing', { error: error.message });
      await this.evolutionApi.sendMessage({
        to: data.from,
        text: '❌ Erro ao marcar pedido em preparo.',
      });
    }
  }

  private async handleMarkReady(data: MessageData): Promise<void> {
    if (!data.restaurantId) {
      await this.evolutionApi.sendMessage({
        to: data.from,
        text: '❌ Erro: Restaurante não identificado.',
      });
      return;
    }

    try {
      const orders = await this.orderRepository.findByRestaurantAndStatus(
        data.restaurantId,
        OrderStatus.PREPARING
      );

      if (orders.length === 0) {
        await this.evolutionApi.sendMessage({
          to: data.from,
          text: '✅ Não há pedidos em preparo.',
        });
        return;
      }

      // Pega o primeiro pedido em preparo
      const order = orders[0];
      order.updateStatus(OrderStatus.READY);
      await this.orderRepository.save(order);

      // Notifica cliente
      await this.notificationService.notifyOrderStatusChanged(order, OrderStatus.READY);

      await this.evolutionApi.sendMessage({
        to: data.from,
        text: `✅ Pedido #${order.getId().slice(0, 8)} marcado como pronto!\n\nCliente foi notificado.`,
      });
    } catch (error: any) {
      logger.error('Error marking order as ready', { error: error.message });
      await this.evolutionApi.sendMessage({
        to: data.from,
        text: '❌ Erro ao marcar pedido como pronto.',
      });
    }
  }

  private async handleListPending(data: MessageData): Promise<void> {
    if (!data.restaurantId) {
      await this.evolutionApi.sendMessage({
        to: data.from,
        text: '❌ Erro: Restaurante não identificado.',
      });
      return;
    }

    try {
      const orders = await this.orderRepository.findByRestaurantAndStatus(
        data.restaurantId,
        OrderStatus.PAID
      );

      if (orders.length === 0) {
        await this.evolutionApi.sendMessage({
          to: data.from,
          text: '✅ Não há pedidos pendentes no momento.',
        });
        return;
      }

      const ordersList = orders
        .map((order, index) => {
          return `${index + 1}. Pedido #${order.getId().slice(0, 8)} - ${order.getTotal().getFormatted()}`;
        })
        .join('\n');

      await this.evolutionApi.sendMessage({
        to: data.from,
        text: `📋 Pedidos pendentes (${orders.length}):\n\n${ordersList}\n\nUse "marcar preparo" para iniciar o preparo de um pedido.`,
      });
    } catch (error: any) {
      logger.error('Error listing pending orders', { error: error.message });
      await this.evolutionApi.sendMessage({
        to: data.from,
        text: '❌ Erro ao consultar pedidos pendentes.',
      });
    }
  }

  private async handleBlockItem(data: MessageData): Promise<void> {
    if (!data.restaurantId) {
      await this.evolutionApi.sendMessage({
        to: data.from,
        text: '❌ Erro: Restaurante não identificado.',
      });
      return;
    }

    try {
      const items = await this.menuItemRepository.findByRestaurantId(data.restaurantId);
      const availableItems = items.filter((item) => item.isAvailable());

      if (availableItems.length === 0) {
        await this.evolutionApi.sendMessage({
          to: data.from,
          text: '✅ Não há itens disponíveis para bloquear.',
        });
        return;
      }

      // Tenta parsear número do item
      const text = data.text.trim().toLowerCase();
      const match = text.match(/bloquear\s+(\d+)/) || text.match(/^(\d+)$/);

      if (!match) {
        const itemsList = availableItems
          .map((item, index) => `${index + 1}. ${item.getName()}`)
          .join('\n');
        await this.evolutionApi.sendMessage({
          to: data.from,
          text: `📋 Itens disponíveis para bloquear:\n\n${itemsList}\n\nDigite "bloquear [número]" (ex: "bloquear 1")`,
        });
        return;
      }

      const itemNumber = parseInt(match[1]);
      if (itemNumber < 1 || itemNumber > availableItems.length) {
        await this.evolutionApi.sendMessage({
          to: data.from,
          text: '❌ Número inválido. Escolha um item da lista.',
        });
        return;
      }

      const item = availableItems[itemNumber - 1];
      await this.updateMenuItem.execute({
        id: item.getId(),
        isAvailable: false,
      });

      await this.evolutionApi.sendMessage({
        to: data.from,
        text: `✅ ${item.getName()} foi bloqueado (indisponível).`,
      });
    } catch (error: any) {
      logger.error('Error blocking item', { error: error.message });
      await this.evolutionApi.sendMessage({
        to: data.from,
        text: '❌ Erro ao bloquear item.',
      });
    }
  }

  private async handleUnblockItem(data: MessageData): Promise<void> {
    if (!data.restaurantId) {
      await this.evolutionApi.sendMessage({
        to: data.from,
        text: '❌ Erro: Restaurante não identificado.',
      });
      return;
    }

    try {
      const items = await this.menuItemRepository.findByRestaurantId(data.restaurantId);
      const unavailableItems = items.filter((item) => !item.isAvailable());

      if (unavailableItems.length === 0) {
        await this.evolutionApi.sendMessage({
          to: data.from,
          text: '✅ Não há itens bloqueados para desbloquear.',
        });
        return;
      }

      // Tenta parsear número do item
      const text = data.text.trim().toLowerCase();
      const match = text.match(/desbloquear\s+(\d+)/) || text.match(/^(\d+)$/);

      if (!match) {
        const itemsList = unavailableItems
          .map((item, index) => `${index + 1}. ${item.getName()}`)
          .join('\n');
        await this.evolutionApi.sendMessage({
          to: data.from,
          text: `📋 Itens bloqueados:\n\n${itemsList}\n\nDigite "desbloquear [número]" (ex: "desbloquear 1")`,
        });
        return;
      }

      const itemNumber = parseInt(match[1]);
      if (itemNumber < 1 || itemNumber > unavailableItems.length) {
        await this.evolutionApi.sendMessage({
          to: data.from,
          text: '❌ Número inválido. Escolha um item da lista.',
        });
        return;
      }

      const item = unavailableItems[itemNumber - 1];
      await this.updateMenuItem.execute({
        id: item.getId(),
        isAvailable: true,
      });

      await this.evolutionApi.sendMessage({
        to: data.from,
        text: `✅ ${item.getName()} foi desbloqueado (disponível).`,
      });
    } catch (error: any) {
      logger.error('Error unblocking item', { error: error.message });
      await this.evolutionApi.sendMessage({
        to: data.from,
        text: '❌ Erro ao desbloquear item.',
      });
    }
  }
}
