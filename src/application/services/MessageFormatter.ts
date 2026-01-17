import { MenuItem } from '../../domain/entities/MenuItem';
import { Order } from '../../domain/entities/Order';
import { OrderItem } from '../../domain/entities/OrderItem';
import { Restaurant } from '../../domain/entities/Restaurant';
import { OrderStatus } from '../../domain/enums/OrderStatus';

export class MessageFormatter {
  static formatOrderNumber(order: Order): string {
    const sequence = order.getDailySequence();
    return sequence ? sequence.toString().padStart(3, '0') : order.getId().slice(0, 8);
  }

  static formatMenu(items: MenuItem[]): string {
    if (items.length === 0) {
      return '📋 Cardápio vazio.\n\nAdicione itens ao cardápio para começar a receber pedidos.';
    }

    const itemsList = items
      .map((item, index) => {
        const status = item.isAvailable() ? '✅' : '❌';
        return `${index + 1}. ${status} ${item.getName()} - ${item.getPrice().getFormatted()}`;
      })
      .join('\n');

    return `📋 Cardápio:\n\n${itemsList}\n\nDigite "adicionar [número] [quantidade]" para adicionar ao pedido.\nExemplo: "adicionar 1 2" (2 unidades do item 1)`;
  }

  static formatRestaurantList(restaurants: Restaurant[]): string {
    if (restaurants.length === 0) {
      return '❌ Nenhum restaurante disponível no momento.';
    }

    const list = restaurants
      .map((restaurant, index) => {
        return `${index + 1}. ${restaurant.getName()}`;
      })
      .join('\n');

    return `🍽️ Escolha um restaurante:\n\n${list}\n\nDigite o número do restaurante:`;
  }

  static formatOrder(order: Order, items: OrderItem[]): string {
    const orderId = MessageFormatter.formatOrderNumber(order);
    const statusMap: Record<OrderStatus, string> = {
      [OrderStatus.DRAFT]: '🛠️ Montando',
      [OrderStatus.NEW]: '🆕 Novo',
      [OrderStatus.AWAITING_PAYMENT]: '⏳ Aguardando pagamento',
      [OrderStatus.PAID]: '💳 Pago',
      [OrderStatus.PREPARING]: '👨‍🍳 Em preparo',
      [OrderStatus.READY]: '✅ Pronto',
      [OrderStatus.DELIVERED]: '🚚 Entregue',
      [OrderStatus.CANCELLED]: '❌ Cancelado',
      [OrderStatus.PENDING]: '⏳ Pendente', // Mantido para compatibilidade
    };

    const itemsList = items
      .map((item, index) => {
        return `${index + 1}. ${item.getQuantity()}x - ${item.getPrice().getFormatted()} cada`;
      })
      .join('\n');

    return `📦 Pedido #${orderId}\n\nStatus: ${statusMap[order.getStatus()]}\n\nItens:\n${itemsList}\n\nTotal: ${order.getTotal().getFormatted()}`;
  }

  static formatOrderList(orders: Order[]): string {
    if (orders.length === 0) {
      return '📦 Você não possui pedidos.';
    }

    const statusMap: Record<OrderStatus, string> = {
      [OrderStatus.DRAFT]: '🛠️',
      [OrderStatus.NEW]: '🆕',
      [OrderStatus.AWAITING_PAYMENT]: '⏳',
      [OrderStatus.PAID]: '💳',
      [OrderStatus.PREPARING]: '👨‍🍳',
      [OrderStatus.READY]: '✅',
      [OrderStatus.DELIVERED]: '🚚',
      [OrderStatus.CANCELLED]: '❌',
      [OrderStatus.PENDING]: '⏳', // Mantido para compatibilidade
    };

    const ordersList = orders
      .map((order) => {
        const orderId = MessageFormatter.formatOrderNumber(order);
        return `${statusMap[order.getStatus()]} Pedido #${orderId} - ${order.getTotal().getFormatted()}`;
      })
      .join('\n');

    return `📦 Seus pedidos:\n\n${ordersList}`;
  }

  static formatCart(items: Array<{ name: string; quantity: number; total: number }>, total: number): string {
    if (items.length === 0) {
      return '🛒 Seu carrinho está vazio.';
    }

    const itemsList = items
      .map((item, index) => {
        return `${index + 1}. ${item.quantity}x ${item.name} - ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.total)}`;
      })
      .join('\n');

    return `🛒 Seu carrinho:\n\n${itemsList}\n\nTotal: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total)}\n\nDigite "finalizar" para confirmar o pedido ou "remover [número]" para remover um item.`;
  }
}

