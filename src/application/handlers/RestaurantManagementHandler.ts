import { Intent } from '../../domain/enums/Intent';
import { MessageData } from '../services/OrchestrationService';
import { EvolutionApiService } from '../../infrastructure/messaging/EvolutionApiService';
import { IOrderRepository } from '../../domain/repositories/IOrderRepository';
import { IMenuItemRepository } from '../../domain/repositories/IMenuItemRepository';
import { IOrderItemRepository } from '../../domain/repositories/IOrderItemRepository';
import { IRestaurantRepository } from '../../domain/repositories/IRestaurantRepository';
import { OrderStatus } from '../../domain/enums/OrderStatus';
import { NotificationService } from '../services/NotificationService';
import { UpdateMenuItem } from '../../domain/usecases/UpdateMenuItem';
import { CreateMenuItem } from '../../domain/usecases/CreateMenuItem';
import { MessageFormatter } from '../services/MessageFormatter';
import { OrderStateMachine } from '../../domain/state/OrderStateMachine';
import { logger } from '../../shared/utils/logger';
import { OpeningHour } from '../../domain/entities/Restaurant';

export class RestaurantManagementHandler {
  constructor(
    private readonly evolutionApi: EvolutionApiService,
    private readonly orderRepository: IOrderRepository,
    private readonly menuItemRepository: IMenuItemRepository,
    private readonly orderItemRepository: IOrderItemRepository,
    private readonly restaurantRepository: IRestaurantRepository,
    private readonly notificationService: NotificationService,
    private readonly updateMenuItem: UpdateMenuItem,
    private readonly createMenuItem: CreateMenuItem
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
        case Intent.CONSULTAR_FILA_COZINHA:
          await this.handleKitchenQueue(data);
          break;
        case Intent.DETALHAR_PEDIDO_COZINHA:
          await this.handleKitchenOrderDetail(data);
          break;
        case Intent.CONSULTAR_HORARIO_FUNCIONAMENTO:
          await this.handleShowOperatingHours(data);
          break;
        case Intent.ATUALIZAR_HORARIO_FUNCIONAMENTO:
          await this.handleUpdateOperatingHours(data);
          break;
        case Intent.BLOQUEAR_ITEM_CARDAPIO:
          await this.handleBlockItem(data);
          break;
      case Intent.DESBLOQUEAR_ITEM_CARDAPIO:
        await this.handleUnblockItem(data);
        break;
      case Intent.CADASTRAR_ITEM_CARDAPIO:
        await this.handleCreateMenuItem(data);
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
      const orderItems = await this.orderItemRepository.findByOrderId(order.getId());
      if (orderItems.length === 0) {
        await this.evolutionApi.sendMessage({
          to: data.from,
          text: '❌ Não é possível iniciar preparo: pedido sem itens.',
        });
        return;
      }
      const orderNumber = MessageFormatter.formatOrderNumber(order);
      order.updateStatus(OrderStatus.PREPARING);
      await this.orderRepository.save(order);

      // Notifica cliente
      await this.notificationService.notifyOrderStatusChanged(order, OrderStatus.PREPARING);

      await this.evolutionApi.sendMessage({
        to: data.from,
        text: `✅ Pedido #${orderNumber} marcado como em preparo!\n\nCliente foi notificado.`,
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
      const orderItems = await this.orderItemRepository.findByOrderId(order.getId());
      if (orderItems.length === 0) {
        await this.evolutionApi.sendMessage({
          to: data.from,
          text: '❌ Não é possível marcar como pronto: pedido sem itens.',
        });
        return;
      }
      const orderNumber = MessageFormatter.formatOrderNumber(order);
      order.updateStatus(OrderStatus.READY);
      await this.orderRepository.save(order);

      // Notifica cliente
      await this.notificationService.notifyOrderStatusChanged(order, OrderStatus.READY);

      await this.evolutionApi.sendMessage({
        to: data.from,
        text: `✅ Pedido #${orderNumber} marcado como pronto!\n\nCliente foi notificado.`,
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
          const orderNumber = MessageFormatter.formatOrderNumber(order);
          return `${index + 1}. Pedido #${orderNumber} - ${order.getTotal().getFormatted()}`;
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

  private async handleKitchenQueue(data: MessageData): Promise<void> {
    if (!data.restaurantId) {
      await this.evolutionApi.sendMessage({
        to: data.from,
        text: '❌ Erro: Restaurante não identificado.',
      });
      return;
    }

    try {
      const newOrders = await this.orderRepository.findByRestaurantAndStatus(
        data.restaurantId,
        OrderStatus.NEW
      );
      const preparingOrders = await this.orderRepository.findByRestaurantAndStatus(
        data.restaurantId,
        OrderStatus.PREPARING
      );
      const readyOrders = await this.orderRepository.findByRestaurantAndStatus(
        data.restaurantId,
        OrderStatus.READY
      );

      const queue = OrderStateMachine.buildKitchenQueue(newOrders, preparingOrders, readyOrders, 5);

      if (queue.length === 0) {
        await this.evolutionApi.sendMessage({
          to: data.from,
          text: '✅ Não há pedidos em preparo ou prontos.',
        });
        return;
      }

      const lines = queue.map((order, index) => {
        const orderNumber = MessageFormatter.formatOrderNumber(order);
        const statusIcon =
          order.getStatus() === OrderStatus.NEW
            ? '🆕'
            : order.getStatus() === OrderStatus.PREPARING
              ? '👨‍🍳'
              : '✅';
        return `${index + 1}. ${statusIcon} Pedido #${orderNumber} - ${order.getTotal().getFormatted()}`;
      });

      await this.evolutionApi.sendMessage({
        to: data.from,
        text: `📋 Fila da cozinha:\n\n${lines.join('\n')}\n\nPara ver detalhes, envie: detalhe <id>`,
      });
    } catch (error: any) {
      logger.error('Error listing kitchen queue', { error: error.message });
      await this.evolutionApi.sendMessage({
        to: data.from,
        text: '❌ Erro ao consultar fila da cozinha.',
      });
    }
  }

  private async handleKitchenOrderDetail(data: MessageData): Promise<void> {
    if (!data.restaurantId) {
      await this.evolutionApi.sendMessage({
        to: data.from,
        text: '❌ Erro: Restaurante não identificado.',
      });
      return;
    }

    const orderIdPrefix = this.extractOrderIdPrefix(data.text);
    if (!orderIdPrefix) {
      await this.evolutionApi.sendMessage({
        to: data.from,
        text: '❓ Informe o ID do pedido. Exemplo: detalhe abc12345',
      });
      return;
    }

    try {
      const orders = await this.orderRepository.findByRestaurantId(data.restaurantId);
      const matches = orders.filter((order) =>
        order.getId().toLowerCase().startsWith(orderIdPrefix.toLowerCase())
      );

      if (matches.length === 0) {
        await this.evolutionApi.sendMessage({
          to: data.from,
          text: '❌ Pedido não encontrado. Verifique o ID e tente novamente.',
        });
        return;
      }

      if (matches.length > 1) {
        const options = matches
          .map((order) => `#${MessageFormatter.formatOrderNumber(order)}`)
          .join(', ');
        await this.evolutionApi.sendMessage({
          to: data.from,
          text: `🔎 Encontramos mais de um pedido: ${options}\n\nEnvie um ID mais específico.`,
        });
        return;
      }

      const order = matches[0];
      const items = await this.orderItemRepository.findByOrderId(order.getId());
      const itemsWithNames = await Promise.all(
        items.map(async (item) => {
          const menuItem = await this.menuItemRepository.findById(item.getMenuItemId());
          return {
            name: menuItem?.getName() || 'Item',
            quantity: item.getQuantity(),
            price: item.getPrice().getFormatted(),
            subtotal: item.getSubtotal().getFormatted(),
          };
        })
      );

      const itemsText =
        itemsWithNames.length === 0
          ? 'Nenhum item encontrado.'
          : itemsWithNames
              .map(
                (item, index) =>
                  `${index + 1}. ${item.quantity}x ${item.name} - ${item.price} (Subtotal: ${item.subtotal})`
              )
              .join('\n');

      const statusLabel =
        order.getStatus() === OrderStatus.DRAFT
          ? '🛠️ Montando'
          : order.getStatus() === OrderStatus.NEW
            ? '🆕 Novo'
            : order.getStatus() === OrderStatus.PREPARING
              ? '👨‍🍳 Em preparo'
              : order.getStatus() === OrderStatus.READY
                ? '✅ Pronto'
                : order.getStatus();

      const orderNumber = MessageFormatter.formatOrderNumber(order);
      await this.evolutionApi.sendMessage({
        to: data.from,
        text: `📦 Pedido #${orderNumber}\n\nStatus: ${statusLabel}\n\nItens:\n${itemsText}\n\nTotal: ${order.getTotal().getFormatted()}`,
      });
    } catch (error: any) {
      logger.error('Error fetching kitchen order details', { error: error.message });
      await this.evolutionApi.sendMessage({
        to: data.from,
        text: '❌ Erro ao buscar detalhes do pedido.',
      });
    }
  }

  private extractOrderIdPrefix(text: string): string | null {
    const directMatch = text.match(/(?:detalhe|detalhar)\s+([a-z0-9-]{6,})/i);
    if (directMatch?.[1]) {
      return directMatch[1];
    }

    const tokenWithNumber = text.match(/[a-z0-9-]*\d[a-z0-9-]{4,}/i);
    if (tokenWithNumber?.[0]) {
      return tokenWithNumber[0];
    }

    const fallback = text.match(/[a-z0-9]{6,}/i);
    return fallback ? fallback[0] : null;
  }

  private async handleShowOperatingHours(data: MessageData): Promise<void> {
    if (!data.restaurantId) {
      await this.evolutionApi.sendMessage({
        to: data.from,
        text: '❌ Erro: Restaurante não identificado.',
      });
      return;
    }

    try {
      const restaurant = await this.restaurantRepository.findById(data.restaurantId);
      if (!restaurant) {
        await this.evolutionApi.sendMessage({
          to: data.from,
          text: '❌ Restaurante não encontrado.',
        });
        return;
      }

      const openingHours = restaurant.getOpeningHours() || [];
      const timezone = restaurant.getTimezone() || 'America/Recife';
      if (openingHours.length === 0) {
        await this.evolutionApi.sendMessage({
          to: data.from,
          text: `⏰ Horários não configurados.\nTimezone: ${timezone}\n\nPara definir: "horario set seg-sex 09:00-18:00; sab 10:00-14:00"`,
        });
        return;
      }

      const formatted = this.formatOpeningHours(openingHours);
      await this.evolutionApi.sendMessage({
        to: data.from,
        text: `⏰ Horários de funcionamento (timezone: ${timezone}):\n\n${formatted}`,
      });
    } catch (error: any) {
      logger.error('Error showing operating hours', { error: error.message });
      await this.evolutionApi.sendMessage({
        to: data.from,
        text: '❌ Erro ao consultar horários de funcionamento.',
      });
    }
  }

  private async handleUpdateOperatingHours(data: MessageData): Promise<void> {
    if (!data.restaurantId) {
      await this.evolutionApi.sendMessage({
        to: data.from,
        text: '❌ Erro: Restaurante não identificado.',
      });
      return;
    }

    const parsed = this.parseOperatingHoursInput(data.text);
    if (!parsed) {
      await this.evolutionApi.sendMessage({
        to: data.from,
        text:
          '❌ Formato inválido.\nExemplo: "horario set seg-sex 09:00-18:00; sab 10:00-14:00"\nOpcional: "tz=America/Recife"',
      });
      return;
    }

    try {
      const restaurant = await this.restaurantRepository.findById(data.restaurantId);
      if (!restaurant) {
        await this.evolutionApi.sendMessage({
          to: data.from,
          text: '❌ Restaurante não encontrado.',
        });
        return;
      }

      restaurant.updateOperatingHours({
        timezone: parsed.timezone,
        openingHours: parsed.openingHours,
      });
      const saved = await this.restaurantRepository.save(restaurant);

      const formatted = this.formatOpeningHours(saved.getOpeningHours() || []);
      await this.evolutionApi.sendMessage({
        to: data.from,
        text: `✅ Horários atualizados.\nTimezone: ${saved.getTimezone() || 'America/Recife'}\n\n${formatted}`,
      });
    } catch (error: any) {
      logger.error('Error updating operating hours', { error: error.message });
      await this.evolutionApi.sendMessage({
        to: data.from,
        text: '❌ Erro ao atualizar horários de funcionamento.',
      });
    }
  }

  private parseOperatingHoursInput(
    text: string
  ): { timezone?: string; openingHours: OpeningHour[] } | null {
    const normalized = text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    const timezoneMatch = normalized.match(/(?:tz|timezone)\s*=?\s*([a-z_\/]+)/i);
    const timezone = timezoneMatch?.[1];

    const segments = normalized
      .replace(/horario|horario de funcionamento|horario set|definir horario|ajustar horario/g, '')
      .split(';')
      .map((segment) => segment.trim())
      .filter(Boolean);

    if (segments.length === 0) {
      return null;
    }

    const openingHours: OpeningHour[] = [];

    for (const segment of segments) {
      if (segment.includes('fechado')) {
        continue;
      }

      const timeMatch = segment.match(/(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})/);
      if (!timeMatch) {
        return null;
      }
      const open = timeMatch[1];
      const close = timeMatch[2];

      const dayToken = segment.replace(timeMatch[0], '').trim().split(/\s+/)[0];
      const days = this.parseDaysToken(dayToken);
      if (!days || days.length === 0) {
        return null;
      }

      for (const day of days) {
        openingHours.push({ day, open, close });
      }
    }

    return { timezone, openingHours };
  }

  private parseDaysToken(token: string): number[] | null {
    const map: Record<string, number> = {
      dom: 0,
      domingo: 0,
      seg: 1,
      segunda: 1,
      ter: 2,
      terca: 2,
      qua: 3,
      quarta: 3,
      qui: 4,
      quinta: 4,
      sex: 5,
      sexta: 5,
      sab: 6,
      sabado: 6,
    };

    const cleaned = token
      .replace(/[^a-z0-9,\-]/g, '')
      .trim();
    if (!cleaned) {
      return null;
    }

    const resolveDay = (value: string): number | null => {
      if (/^\d$/.test(value)) {
        const day = parseInt(value, 10);
        return day >= 0 && day <= 6 ? day : null;
      }
      return map[value] ?? null;
    };

    if (cleaned.includes(',')) {
      const parts = cleaned.split(',').map((value) => value.trim());
      const days = parts.map(resolveDay).filter((day): day is number => day !== null);
      return days.length ? days : null;
    }

    if (cleaned.includes('-')) {
      const [start, end] = cleaned.split('-').map((value) => value.trim());
      const startDay = resolveDay(start);
      const endDay = resolveDay(end);
      if (startDay === null || endDay === null) return null;

      const days: number[] = [];
      for (let day = startDay; day <= endDay; day += 1) {
        days.push(day);
      }
      return days;
    }

    const single = resolveDay(cleaned);
    return single === null ? null : [single];
  }

  private formatOpeningHours(openingHours: OpeningHour[]): string {
    const dayLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
    const grouped: Record<number, OpeningHour[]> = {};

    for (const entry of openingHours) {
      grouped[entry.day] = grouped[entry.day] || [];
      grouped[entry.day].push(entry);
    }

    return dayLabels
      .map((label, day) => {
        const intervals = grouped[day] || [];
        if (intervals.length === 0) {
          return `${label}: fechado`;
        }
        const formatted = intervals
          .map((interval) => `${interval.open}-${interval.close}`)
          .join(', ');
        return `${label}: ${formatted}`;
      })
      .join('\n');
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

  private async handleCreateMenuItem(data: MessageData): Promise<void> {
    if (!data.restaurantId) {
      await this.evolutionApi.sendMessage({
        to: data.from,
        text: '❌ Erro: Restaurante não identificado. Por favor, complete o cadastro do restaurante primeiro.',
      });
      return;
    }

    try {
      const text = data.text.trim();
      
      // Tenta extrair nome e preço da mensagem usando regex
      // Formatos aceitos:
      // - "Nome do Item - R$ 35,00"
      // - "Nome do Item - R$35,00"
      // - "Nome do Item - 35,00"
      // - "Nome do Item - R$ 35"
      // - "Nome do Item - 35"
      const priceMatch = text.match(/(?:R\$\s*)?(\d+(?:[.,]\d{2})?)/);
      const priceStr = priceMatch ? priceMatch[1].replace(',', '.') : null;
      const price = priceStr ? parseFloat(priceStr) : null;

      // Se não encontrar preço, pede informações
      if (!price || isNaN(price) || price <= 0) {
        await this.evolutionApi.sendMessage({
          to: data.from,
          text: `📝 **Cadastrar Item no Cardápio**

Por favor, informe o item no seguinte formato:
**Nome do Item - R$ Preço**

Exemplos:
• Pizza Portuguesa - R$ 35,00
• Coca-Cola - R$ 5,50
• Hambúrguer Artesanal - R$ 28,90

Digite o nome e preço do item que deseja cadastrar:`,
        });
        return;
      }

      // Extrai nome (tudo antes do preço, removendo traços e espaços extras)
      const nameMatch = text.match(/(.+?)(?:\s*-\s*(?:R\$\s*)?\d)/);
      let name = nameMatch 
        ? nameMatch[1].trim().replace(/\s*-\s*$/, '').trim()
        : text.replace(/(?:R\$\s*)?\d+(?:[.,]\d{2})?.*/, '').trim();

      // Se não conseguiu extrair nome, pede novamente
      if (!name || name.length < 3) {
        await this.evolutionApi.sendMessage({
          to: data.from,
          text: '❌ Não consegui identificar o nome do item. Por favor, digite novamente no formato:\n**Nome do Item - R$ Preço**\n\nExemplo: Pizza Portuguesa - R$ 35,00',
        });
        return;
      }

      // Valida preço máximo
      if (price > 9999.99) {
        await this.evolutionApi.sendMessage({
          to: data.from,
          text: '❌ Preço muito alto. O valor máximo é R$ 9.999,99. Por favor, digite um preço válido.',
        });
        return;
      }

      // Cria o item
      const menuItem = await this.createMenuItem.execute({
        restaurantId: data.restaurantId,
        name,
        price,
        isAvailable: true,
      });

      await this.evolutionApi.sendMessage({
        to: data.from,
        text: `✅ **Item cadastrado com sucesso!**

📋 **${menuItem.getName()}** - ${menuItem.getPrice().getFormatted()}

Deseja cadastrar outro item? Digite "cadastrar cardápio" novamente ou digite outro item no formato:
**Nome - R$ Preço**`,
      });

      logger.info('Menu item created successfully', {
        menuItemId: menuItem.getId(),
        restaurantId: data.restaurantId,
        name: menuItem.getName(),
        price: menuItem.getPrice().getValue(),
      });
    } catch (error: any) {
      logger.error('Error creating menu item', { error: error.message, restaurantId: data.restaurantId });
      
      let errorMessage = '❌ Erro ao cadastrar item.';
      const errorMsg = error.message || '';
      
      if (errorMsg.includes('Restaurant not found')) {
        errorMessage = '❌ Restaurante não encontrado. Por favor, complete o cadastro do restaurante primeiro.';
      } else if (errorMsg.includes('Name must have')) {
        errorMessage = '❌ Nome do item muito curto. O nome deve ter pelo menos 3 caracteres.';
      } else if (errorMsg.includes('Price must be')) {
        errorMessage = '❌ Preço inválido. O preço deve ser maior que zero.';
      }

      await this.evolutionApi.sendMessage({
        to: data.from,
        text: errorMessage,
      });
    }
  }
}
