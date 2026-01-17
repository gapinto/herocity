import { Intent } from '../../domain/enums/Intent';
import { MessageData } from '../services/OrchestrationService';
import { EvolutionApiService } from '../../infrastructure/messaging/EvolutionApiService';
import { IOrderRepository } from '../../domain/repositories/IOrderRepository';
import { IOrderItemRepository } from '../../domain/repositories/IOrderItemRepository';
import { IMenuItemRepository } from '../../domain/repositories/IMenuItemRepository';
import { IRestaurantRepository } from '../../domain/repositories/IRestaurantRepository';
import { ICustomerRepository } from '../../domain/repositories/ICustomerRepository';
import { OrderStatus } from '../../domain/enums/OrderStatus';
import { OrderCreationState } from '../services/OrderStateService';
import { IOrderStateService } from '../../domain/services/IOrderStateService';
import { IPaymentService } from '../../domain/services/IPaymentService';
import { CreateOrder } from '../../domain/usecases/CreateOrder';
import { NotificationService } from '../services/NotificationService';
import { MessageFormatter } from '../services/MessageFormatter';
import { MenuItem } from '../../domain/entities/MenuItem';
import { Customer } from '../../domain/entities/Customer';
import { Phone } from '../../domain/value-objects/Phone';
import { logger } from '../../shared/utils/logger';

export class CustomerOrdersHandler {
  constructor(
    private readonly evolutionApi: EvolutionApiService,
    private readonly orderRepository: IOrderRepository,
    private readonly menuItemRepository: IMenuItemRepository,
    private readonly restaurantRepository: IRestaurantRepository,
    private readonly orderItemRepository: IOrderItemRepository,
    private readonly customerRepository: ICustomerRepository,
    private readonly createOrder: CreateOrder,
    private readonly notificationService: NotificationService,
    private readonly orderState: IOrderStateService,
    private readonly paymentService: IPaymentService
  ) {}

  async handle(intent: Intent, data: MessageData): Promise<void> {
    try {
      // Verifica se está em processo de criação de pedido
      const orderData = await this.orderState.getOrderData(data.from);
      if (orderData && orderData.state !== OrderCreationState.IDLE) {
        await this.processOrderCreation(data, orderData);
        return;
      }

      // Se veio de QR code E DeepSeek extraiu items, processa pedido direto
      if (
        intent === Intent.CRIAR_PEDIDO_QR_CODE &&
        data.intentResult?.items &&
        data.intentResult.items.length > 0 &&
        data.restaurantId
      ) {
        await this.handleDirectOrderFromQRCode(data);
        return;
      }

      switch (intent) {
        case Intent.CRIAR_PEDIDO:
          await this.handleCreateOrder(data);
          break;
        case Intent.CRIAR_PEDIDO_QR_CODE:
          await this.handleCreateOrderFromQRCode(data);
          break;
        case Intent.ADICIONAR_ITEM:
          await this.handleAddItem(data);
          break;
        case Intent.REMOVER_ITEM:
          await this.handleRemoveItem(data);
          break;
        case Intent.CONSULTAR_STATUS_PEDIDO:
          await this.handleGetStatus(data);
          break;
        case Intent.CANCELAR_PEDIDO:
          await this.handleCancelOrder(data);
          break;
        default:
          await this.evolutionApi.sendMessage({
            to: data.from,
            text: 'Comando não reconhecido. Digite "ajuda" para ver os comandos disponíveis.',
          });
      }
    } catch (error: any) {
      logger.error('Error in CustomerOrdersHandler', {
        error: error.message,
        intent,
        from: data.from,
      });
      throw error;
    }
  }

  private async processOrderCreation(data: MessageData, orderData: { state: OrderCreationState; restaurantId?: string; items: any[] }): Promise<void> {
    const text = data.text.trim().toLowerCase();

    // Permite cancelar a qualquer momento
    if (text === 'cancelar' || text === 'sair') {
      await this.orderState.clearOrderData(data.from);
      await this.evolutionApi.sendMessage({
        to: data.from,
        text: '❌ Criação de pedido cancelada.',
      });
      return;
    }

    switch (orderData.state) {
      case OrderCreationState.SELECTING_RESTAURANT:
        await this.handleSelectRestaurant(data, orderData);
        break;

      case OrderCreationState.VIEWING_MENU:
        await this.handleViewMenu(data, orderData);
        break;

      case OrderCreationState.ADDING_ITEMS:
        await this.handleAddItemToCart(data, orderData);
        break;

      case OrderCreationState.RESOLVING_AMBIGUITY:
        await this.handleResolvingAmbiguity(data);
        break;

      case OrderCreationState.CONFIRMING_ORDER:
        // Busca orderData atualizado antes de confirmar
        const updatedOrderDataForConfirm = await this.orderState.getOrderData(data.from);
        if (updatedOrderDataForConfirm) {
          await this.handleConfirmOrder(data, updatedOrderDataForConfirm);
        }
        break;

      case OrderCreationState.AWAITING_PAYMENT_METHOD:
        await this.handlePaymentMethodSelection(data);
        break;

      case OrderCreationState.AWAITING_PAYMENT:
        // Cliente está aguardando pagamento, pode apenas consultar status
        await this.evolutionApi.sendMessage({
          to: data.from,
          text: '⏳ Seu pedido está aguardando pagamento. Após o pagamento, será enviado para a cozinha.',
        });
        break;

      default:
        await this.handleCreateOrder(data);
    }
  }

  private async handleCreateOrder(data: MessageData): Promise<void> {
    await this.ensureCustomerId(data);

    try {
      // Inicia processo de criação de pedido
      await this.orderState.startOrderCreation(data.from);

      // Lista restaurantes disponíveis
      const restaurants = await this.restaurantRepository.findAll();
      const activeRestaurants = restaurants.filter((r) => r.isActive());

      if (activeRestaurants.length === 0) {
        await this.orderState.clearOrderData(data.from);
        await this.evolutionApi.sendMessage({
          to: data.from,
          text: '❌ Nenhum restaurante disponível no momento.',
        });
        return;
      }

      const message = MessageFormatter.formatRestaurantList(activeRestaurants);
      await this.evolutionApi.sendMessage({
        to: data.from,
        text: message,
      });
    } catch (error: any) {
      logger.error('Error creating order', { error: error.message });
      await this.orderState.clearOrderData(data.from);
      await this.evolutionApi.sendMessage({
        to: data.from,
        text: '❌ Erro ao criar pedido. Tente novamente mais tarde.',
      });
    }
  }

  private async handleCreateOrderFromQRCode(data: MessageData): Promise<void> {
    await this.ensureCustomerId(data);

    try {
      // Extrai restaurantId da mensagem (formato: "pedido:abc123" ou "restaurant:abc123")
      const text = data.text.trim();
      const qrMatch = text.match(/(?:pedido|restaurant|restaurante)[:\s]+([a-zA-Z0-9]+)/i);
      
      if (!qrMatch || !qrMatch[1]) {
        // Se não conseguiu extrair, tenta usar o texto completo como ID
        const restaurantId = text.replace(/^(pedido|restaurant|restaurante)[:\s]+/i, '').trim();
        if (!restaurantId) {
          await this.evolutionApi.sendMessage({
            to: data.from,
            text: '❌ Código do restaurante não encontrado no QR code. Por favor, escaneie novamente.',
          });
          return;
        }
        await this.processQRCodeOrder(data, restaurantId);
        return;
      }

      const restaurantId = qrMatch[1];
      await this.processQRCodeOrder(data, restaurantId);
    } catch (error: any) {
      logger.error('Error creating order from QR code', { error: error.message });
      await this.evolutionApi.sendMessage({
        to: data.from,
        text: '❌ Erro ao processar QR code. Tente novamente ou digite "quero fazer um pedido" para escolher manualmente.',
      });
    }
  }

  private async processQRCodeOrder(data: MessageData, restaurantId: string): Promise<void> {
    // Valida restaurante existe e está ativo
    const restaurant = await this.restaurantRepository.findById(restaurantId);
    
    if (!restaurant) {
      await this.evolutionApi.sendMessage({
        to: data.from,
        text: '❌ Restaurante não encontrado. Por favor, verifique o QR code ou digite "quero fazer um pedido" para escolher manualmente.',
      });
      return;
    }

    if (!restaurant.isActive()) {
      await this.evolutionApi.sendMessage({
        to: data.from,
        text: `❌ O restaurante ${restaurant.getName()} está temporariamente fechado. Por favor, tente outro restaurante.`,
      });
      return;
    }

    // Inicia processo de criação de pedido já com restaurante selecionado
    await this.orderState.startOrderCreation(data.from);
    await this.orderState.setRestaurant(data.from, restaurantId);
    await this.orderState.updateState(data.from, OrderCreationState.ADDING_ITEMS);

    // Pergunta o que deseja em vez de mostrar cardápio
    await this.evolutionApi.sendMessage({
      to: data.from,
      text: `👋 Olá! Bem-vindo ao ${restaurant.getName()}!\n\nO que você deseja pedir hoje?\n\nVocê pode mencionar os itens diretamente, por exemplo:\n• "2 hambúrgueres e 1 refrigerante"\n• "quero 1 pizza grande"\n• "me vê 3 coxinhas"\n\nOu digite "ver cardápio" para ver todos os itens disponíveis.`,
    });
  }

  private async handleSelectRestaurant(
    data: MessageData,
    _orderData: { restaurantId?: string; items: any[] }
  ): Promise<void> {
    try {
      const selection = parseInt(data.text.trim());
      if (isNaN(selection) || selection < 1) {
        await this.evolutionApi.sendMessage({
          to: data.from,
          text: '❌ Por favor, digite um número válido.',
        });
        return;
      }

      const restaurants = await this.restaurantRepository.findAll();
      const activeRestaurants = restaurants.filter((r) => r.isActive());

      if (selection > activeRestaurants.length) {
        await this.evolutionApi.sendMessage({
          to: data.from,
          text: '❌ Número inválido. Por favor, escolha um restaurante da lista.',
        });
        return;
      }

      const selectedRestaurant = activeRestaurants[selection - 1];
      await this.orderState.setRestaurant(data.from, selectedRestaurant.getId());

      // Mostra cardápio (busca orderData atualizado)
      const updatedOrderData = await this.orderState.getOrderData(data.from);
      if (updatedOrderData) {
        await this.handleViewMenu(data, { ...updatedOrderData, restaurantId: selectedRestaurant.getId() });
      }
    } catch (error: any) {
      logger.error('Error selecting restaurant', { error: error.message });
      await this.evolutionApi.sendMessage({
        to: data.from,
        text: '❌ Erro ao selecionar restaurante. Tente novamente.',
      });
    }
  }

  private async handleViewMenu(
    data: MessageData,
    orderData: { restaurantId?: string; items: any[] }
  ): Promise<void> {
    if (!orderData.restaurantId) {
      await this.evolutionApi.sendMessage({
        to: data.from,
        text: '❌ Erro: Restaurante não selecionado.',
      });
      return;
    }

    try {
      const items = await this.menuItemRepository.findAvailableByRestaurantId(
        orderData.restaurantId
      );

      if (items.length === 0) {
        await this.evolutionApi.sendMessage({
          to: data.from,
          text: '❌ Este restaurante não possui itens disponíveis no momento.',
        });
        await this.orderState.clearOrderData(data.from);
        return;
      }

      const message = MessageFormatter.formatMenu(items);
      await this.orderState.updateState(data.from, OrderCreationState.ADDING_ITEMS);

      await this.evolutionApi.sendMessage({
        to: data.from,
        text: message,
      });
    } catch (error: any) {
      logger.error('Error viewing menu', { error: error.message });
      await this.evolutionApi.sendMessage({
        to: data.from,
        text: '❌ Erro ao carregar cardápio.',
      });
    }
  }

  private async handleAddItemToCart(
    data: MessageData,
    orderData: { restaurantId?: string; items: any[] }
  ): Promise<void> {
    if (!orderData.restaurantId) {
      await this.evolutionApi.sendMessage({
        to: data.from,
        text: '❌ Erro: Restaurante não selecionado.',
      });
      return;
    }

    const text = data.text.trim().toLowerCase();

    // Verifica se quer finalizar
    if (text === 'finalizar' || text === 'confirmar') {
      // Busca orderData atualizado antes de confirmar
      const updatedOrderData = await this.orderState.getOrderData(data.from);
      if (updatedOrderData) {
        await this.handleConfirmOrder(data, updatedOrderData);
      }
      return;
    }

    // Verifica se quer ver carrinho
    if (text === 'ver carrinho' || text === 'carrinho') {
      await this.showCart(data);
      return;
    }

    // Tenta parsear: "adicionar 1 2" ou "1 2" ou "2 hambúrgueres"
    const addMatch = text.match(/adicionar\s+(\d+)\s+(\d+)/) || text.match(/^(\d+)\s+(\d+)$/);
    if (addMatch) {
      const itemNumber = parseInt(addMatch[1]);
      const quantity = parseInt(addMatch[2]);

      await this.addItemToCart(data, orderData.restaurantId, itemNumber, quantity);
      return;
    }

    // Tenta parsear: "adicionar 1" (quantidade padrão: 1)
    const singleMatch = text.match(/adicionar\s+(\d+)/) || text.match(/^(\d+)$/);
    if (singleMatch) {
      const itemNumber = parseInt(singleMatch[1]);
      await this.addItemToCart(data, orderData.restaurantId, itemNumber, 1);
      return;
    }

    await this.evolutionApi.sendMessage({
      to: data.from,
      text: '❌ Formato inválido. Use:\n• "adicionar [número] [quantidade]" (ex: "adicionar 1 2")\n• "finalizar" para confirmar\n• "ver carrinho" para ver itens',
    });
  }

  private async addItemToCart(
    data: MessageData,
    restaurantId: string,
    itemNumber: number,
    quantity: number
  ): Promise<void> {
    try {
      const items = await this.menuItemRepository.findAvailableByRestaurantId(restaurantId);

      if (itemNumber < 1 || itemNumber > items.length) {
        await this.evolutionApi.sendMessage({
          to: data.from,
          text: '❌ Número de item inválido. Por favor, escolha um item da lista.',
        });
        return;
      }

      if (quantity < 1 || quantity > 99) {
        await this.evolutionApi.sendMessage({
          to: data.from,
          text: '❌ Quantidade inválida. Use entre 1 e 99.',
        });
        return;
      }

      const menuItem = items[itemNumber - 1];
      const unitPrice = menuItem.getPrice().getValue();
      const totalPrice = unitPrice * quantity;

      await this.orderState.addItem(data.from, {
        menuItemId: menuItem.getId(),
        menuItemName: menuItem.getName(),
        quantity,
        unitPrice,
        totalPrice,
      });

      const total = await this.orderState.calculateTotal(data.from);

      await this.evolutionApi.sendMessage({
        to: data.from,
        text: `✅ ${quantity}x ${menuItem.getName()} adicionado!\n\nTotal: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total / 100)}\n\nDigite "adicionar [número] [quantidade]" para adicionar mais itens ou "finalizar" para confirmar.`,
      });
    } catch (error: any) {
      logger.error('Error adding item to cart', { error: error.message });
      await this.evolutionApi.sendMessage({
        to: data.from,
        text: '❌ Erro ao adicionar item. Tente novamente.',
      });
    }
  }

  private async showCart(data: MessageData): Promise<void> {
    const orderData = await this.orderState.getOrderData(data.from);
    if (!orderData || orderData.items.length === 0) {
      await this.evolutionApi.sendMessage({
        to: data.from,
        text: '🛒 Seu carrinho está vazio.',
      });
      return;
    }

    const total = await this.orderState.calculateTotal(data.from);
    const cartItems = orderData.items.map((item: any) => ({
      name: item.menuItemName,
      quantity: item.quantity,
      total: item.totalPrice,
    }));

    const message = MessageFormatter.formatCart(cartItems, total / 100);
    await this.evolutionApi.sendMessage({
      to: data.from,
      text: message,
    });
  }

  private async handleConfirmOrder(
    data: MessageData,
    orderData: { restaurantId?: string; items: any[] }
  ): Promise<void> {
    if (!data.customerId) {
      await this.evolutionApi.sendMessage({
        to: data.from,
        text: '❌ Erro: Cliente não identificado.',
      });
      return;
    }

    if (!orderData.restaurantId) {
      await this.evolutionApi.sendMessage({
        to: data.from,
        text: '❌ Erro: Restaurante não selecionado.',
      });
      return;
    }

    if (orderData.items.length === 0) {
      await this.evolutionApi.sendMessage({
        to: data.from,
        text: '❌ Seu carrinho está vazio. Adicione itens antes de finalizar.',
      });
      return;
    }

    try {
      const restaurant = await this.restaurantRepository.findById(orderData.restaurantId);
      if (!restaurant) {
        throw new Error('Restaurant not found');
      }
      if (!restaurant.isOpenAt(new Date())) {
        await this.evolutionApi.sendMessage({
          to: data.from,
          text: '⏰ O restaurante está fechado no momento. Tente novamente no horário de funcionamento.',
        });
        return;
      }

      await this.orderState.updateState(data.from, OrderCreationState.CONFIRMING_ORDER);

      // Idempotência: gera chave única baseada em cliente + restaurante + hash dos itens
      const itemsHash = JSON.stringify(orderData.items.map(i => ({ id: i.menuItemId, qty: i.quantity })));
      const idempotencyKey = `${data.customerId}:${orderData.restaurantId}:${Buffer.from(itemsHash).toString('base64').slice(0, 16)}`;

      // Cria pedido com status NEW (não PAID)
      const order = await this.createOrder.execute({
        restaurantId: orderData.restaurantId,
        customerId: data.customerId,
        items: orderData.items.map((item) => ({
          menuItemId: item.menuItemId,
          quantity: item.quantity,
        })),
        status: OrderStatus.NEW,
        idempotencyKey,
      });

      // Salva orderId em memória (Redis) para próxima etapa
      await this.orderState.setCurrentOrderId(data.from, order.getId());
      await this.orderState.updateState(data.from, OrderCreationState.AWAITING_PAYMENT_METHOD);

      // NÃO notifica cozinha ainda (só depois de PAID)
      // await this.notificationService.notifyOrderCreated(order); // ❌ Removido

      // Pergunta método de pagamento
      const total = order.getTotal().getFormatted();
      await this.evolutionApi.sendMessage({
        to: data.from,
        text: `✅ Pedido criado!

Total: ${total}

💳 Como deseja pagar?

Digite:
• "pix" para pagar via Pix
• "cartão" para pagar com cartão`,
      });
    } catch (error: any) {
      logger.error('Error confirming order', { error: error.message });
      await this.orderState.clearOrderData(data.from);
      await this.evolutionApi.sendMessage({
        to: data.from,
        text: `❌ Erro ao criar pedido: ${error.message}\n\nTente novamente.`,
      });
    }
  }

  private async handlePaymentMethodSelection(data: MessageData): Promise<void> {
    const orderId = await this.orderState.getCurrentOrderId(data.from);
    
    if (!orderId) {
      await this.evolutionApi.sendMessage({
        to: data.from,
        text: '❌ Pedido não encontrado. Por favor, crie um novo pedido.',
      });
      return;
    }

    const method = data.text.toLowerCase().trim();
    
    if (method !== 'pix' && method !== 'cartão' && method !== 'cartao') {
      await this.evolutionApi.sendMessage({
        to: data.from,
        text: '❌ Por favor, escolha "pix" ou "cartão"',
      });
      return;
    }

    try {
      // Busca pedido
      const order = await this.orderRepository.findById(orderId);
      if (!order) {
        throw new Error('Order not found');
      }

      const orderItems = await this.orderItemRepository.findByOrderId(orderId);
      if (orderItems.length === 0) {
        await this.evolutionApi.sendMessage({
          to: data.from,
          text: '❌ Seu pedido está sem itens. Adicione itens antes de pagar.',
        });
        return;
      }

      // Idempotência: verifica se já tem pagamento gerado
      if (order.getPaymentLink() || order.getPaymentMethod()) {
        const paymentLink = order.getPaymentLink() || 'Link já foi gerado anteriormente';
        await this.evolutionApi.sendMessage({
          to: data.from,
          text: `🔗 Link de pagamento já gerado!\n\n${paymentLink}\n\nApós o pagamento, seu pedido será enviado para a cozinha.`,
        });
        return;
      }

      // Idempotência adicional: verifica se pedido já está em AWAITING_PAYMENT
      if (order.getStatus() === OrderStatus.AWAITING_PAYMENT) {
        logger.warn('Payment link already generated for order (idempotent)', { orderId });
        await this.evolutionApi.sendMessage({
          to: data.from,
          text: '⚠️ Este pedido já está aguardando pagamento. Verifique seu link anterior ou entre em contato com suporte.',
        });
        return;
      }

      // Busca restaurante para pegar paymentAccountId
      const restaurant = await this.restaurantRepository.findById(order.getRestaurantId());
      if (!restaurant) {
        throw new Error('Restaurant not found');
      }

      if (!restaurant.isOpenAt(new Date())) {
        await this.evolutionApi.sendMessage({
          to: data.from,
          text: '⏰ O restaurante está fechado no momento. Tente novamente no horário de funcionamento.',
        });
        return;
      }

      // Verifica se restaurante tem walletId configurado para split
      const restaurantWalletId = restaurant.getPaymentWalletId();
      if (!restaurantWalletId) {
        throw new Error('Restaurant payment wallet not configured. Please complete onboarding with payment provider registration.');
      }

      // Calcula split (exemplo: 10% plataforma, 90% restaurante)
      const platformFeePercent = parseFloat(process.env.PLATFORM_FEE_PERCENT || '10');
      const totalInCents = Math.round(order.getTotal().getValue() * 100);
      const platformFee = Math.round(totalInCents * (platformFeePercent / 100));
      const restaurantAmount = totalInCents - platformFee;

      // Idempotência: verifica se já existe paymentId para este order
      // Isso evita criar múltiplos pagamentos se houver retry
      if (order.getPaymentId()) {
        logger.warn('Order already has paymentId (idempotent)', { orderId: order.getId(), paymentId: order.getPaymentId() });
        await this.evolutionApi.sendMessage({
          to: data.from,
          text: `⚠️ Este pedido já possui um pagamento associado. Verifique seu link anterior ou entre em contato com suporte.`,
        });
        return;
      }

      // Gera link de pagamento (idempotente internamente)
      const orderNumber = MessageFormatter.formatOrderNumber(order);
      const paymentResponse = await this.paymentService.createPayment({
        orderId: order.getId(),
        amount: totalInCents,
        method: method === 'pix' ? 'pix' : 'card',
        customerId: order.getCustomerId(),
        description: `Pedido #${orderNumber}`,
        splitConfig: {
          restaurantWalletId,
          restaurantAmount,
          platformFee,
        },
      });

      // Verifica novamente se não foi atualizado por outra thread (race condition)
      const currentOrder = await this.orderRepository.findById(orderId);
      if (currentOrder && (currentOrder.getPaymentLink() || currentOrder.getPaymentId())) {
        logger.warn('Order updated by another process (idempotent)', { orderId });
        await this.evolutionApi.sendMessage({
          to: data.from,
          text: `🔗 Link de pagamento já gerado!\n\n${currentOrder.getPaymentLink() || 'Link disponível'}\n\nApós o pagamento, seu pedido será enviado para a cozinha.`,
        });
        return;
      }

      // Atualiza Order com método, link E paymentId (importante para idempotência no webhook)
      // paymentId é salvo logo após criar pagamento para permitir busca no webhook
      order.updatePaymentInfo(
        method === 'pix' ? 'pix' : 'card', 
        paymentResponse.paymentLink,
        paymentResponse.paymentId // Salva paymentId imediatamente para buscar no webhook
      );
      await this.orderRepository.save(order);

      // Atualiza estado
      await this.orderState.updateState(data.from, OrderCreationState.AWAITING_PAYMENT);

      // Envia link para cliente
      let message = `🔗 Link de pagamento gerado!\n\n${paymentResponse.paymentLink}\n\n`;
      
      if (method === 'pix' && paymentResponse.qrCode) {
        message += `📱 Ou escaneie o QR Code:\n${paymentResponse.qrCode}\n\n`;
      }

      message += 'Após o pagamento, seu pedido será enviado para a cozinha.';

      await this.evolutionApi.sendMessage({
        to: data.from,
        text: message,
      });
      
    } catch (error: any) {
      logger.error('Error generating payment link', { error: error.message, orderId });
      await this.evolutionApi.sendMessage({
        to: data.from,
        text: '❌ Erro ao gerar link de pagamento. Tente novamente.',
      });
    }
  }

  private async handleAddItem(data: MessageData): Promise<void> {
    // Redireciona para criação de pedido se não estiver em processo
    const orderData = await this.orderState.getOrderData(data.from);
    if (!orderData) {
      await this.handleCreateOrder(data);
      return;
    }

    // Busca orderData atualizado antes de adicionar item
    const updatedOrderData = await this.orderState.getOrderData(data.from);
    if (updatedOrderData) {
      await this.handleAddItemToCart(data, updatedOrderData);
    }
  }

  private async handleRemoveItem(data: MessageData): Promise<void> {
    const orderData = await this.orderState.getOrderData(data.from);
    if (!orderData || orderData.items.length === 0) {
      await this.evolutionApi.sendMessage({
        to: data.from,
        text: '🛒 Seu carrinho está vazio.',
      });
      return;
    }

    const text = data.text.trim().toLowerCase();
    const removeMatch = text.match(/remover\s+(\d+)/) || text.match(/^(\d+)$/);

    if (!removeMatch) {
      await this.evolutionApi.sendMessage({
        to: data.from,
        text: '❌ Formato inválido. Use "remover [número]" (ex: "remover 1")',
      });
      return;
    }

    const index = parseInt(removeMatch[1]) - 1;

    if (index < 0 || index >= orderData.items.length) {
      await this.evolutionApi.sendMessage({
        to: data.from,
        text: '❌ Número inválido. Escolha um item do carrinho.',
      });
      return;
    }

    await this.orderState.removeItem(data.from, index);
    const total = await this.orderState.calculateTotal(data.from);

    await this.evolutionApi.sendMessage({
      to: data.from,
      text: `✅ Item removido do carrinho!\n\nTotal: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total / 100)}\n\nDigite "ver carrinho" para ver os itens ou "finalizar" para confirmar.`,
    });
  }

  private async handleGetStatus(data: MessageData): Promise<void> {
    if (!data.customerId) {
      await this.evolutionApi.sendMessage({
        to: data.from,
        text: '❌ Erro: Cliente não identificado.',
      });
      return;
    }

    try {
      const orders = await this.orderRepository.findByCustomerId(data.customerId);
      const activeOrders = orders.filter(
        (order) =>
          order.getStatus() !== OrderStatus.DELIVERED &&
          order.getStatus() !== OrderStatus.CANCELLED
      );

      if (activeOrders.length === 0) {
        await this.evolutionApi.sendMessage({
          to: data.from,
          text: '📦 Você não possui pedidos ativos no momento.',
        });
        return;
      }

      const statusList = activeOrders
        .map((order) => {
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

          const orderNumber = MessageFormatter.formatOrderNumber(order);
          return `Pedido #${orderNumber}: ${statusMap[order.getStatus()]} - ${order.getTotal().getFormatted()}`;
        })
        .join('\n');

      await this.evolutionApi.sendMessage({
        to: data.from,
        text: `📦 Seus pedidos ativos:\n\n${statusList}`,
      });
    } catch (error: any) {
      logger.error('Error getting order status', { error: error.message });
      await this.evolutionApi.sendMessage({
        to: data.from,
        text: '❌ Erro ao consultar status do pedido.',
      });
    }
  }

  private async handleCancelOrder(data: MessageData): Promise<void> {
    if (!data.customerId) {
      await this.evolutionApi.sendMessage({
        to: data.from,
        text: '❌ Erro: Cliente não identificado.',
      });
      return;
    }

    try {
      const orders = await this.orderRepository.findByCustomerId(data.customerId);
      const cancellableOrders = orders.filter(
        (order) => order.canBeCancelled() // Usa método da entidade para verificar
      );

      if (cancellableOrders.length === 0) {
        await this.evolutionApi.sendMessage({
          to: data.from,
          text: '✅ Você não possui pedidos que podem ser cancelados.\n\nApenas pedidos em montagem, novos ou aguardando pagamento podem ser cancelados.',
        });
        return;
      }

      // Cancela o primeiro pedido cancelável
      const order = cancellableOrders[0];
      const orderNumber = MessageFormatter.formatOrderNumber(order);
      
      // Idempotência: verifica se já está cancelado antes de cancelar
      if (order.getStatus() === OrderStatus.CANCELLED) {
        await this.evolutionApi.sendMessage({
          to: data.from,
          text: `ℹ️ Pedido #${orderNumber} já está cancelado.`,
        });
        return;
      }

      order.cancel();
      await this.orderRepository.save(order);

      // Notifica restaurante
      await this.notificationService.notifyOrderCancelled(order);

      await this.evolutionApi.sendMessage({
        to: data.from,
        text: `✅ Pedido #${orderNumber} cancelado com sucesso!`,
      });
    } catch (error: any) {
      logger.error('Error canceling order', { error: error.message });
      await this.evolutionApi.sendMessage({
        to: data.from,
        text: '❌ Erro ao cancelar pedido. Tente novamente.',
      });
    }
  }

  private async handleDirectOrderFromQRCode(data: MessageData): Promise<void> {
    await this.ensureCustomerId(data);
    if (!data.customerId || !data.restaurantId || !data.intentResult?.items) {
      return;
    }

    try {
      const intentResult = data.intentResult;

      // Validação da IA (se houver regras)
      if (intentResult.validation) {
        // Erros críticos - não pode criar pedido
        if (!intentResult.validation.isValid) {
          const errors = intentResult.validation.errors.join('\n');
          await this.evolutionApi.sendMessage({
            to: data.from,
            text: `❌ Erro no pedido:\n${errors}\n\nPor favor, corrija e tente novamente.`,
          });
          return;
        }

        // Faltam itens obrigatórios - pergunta
        if (!intentResult.validation.isComplete) {
          const missing = intentResult.validation.missingRequired.join(', ');
          await this.evolutionApi.sendMessage({
            to: data.from,
            text: `⚠️ Seu pedido está incompleto.\n\nFaltam: ${missing}\n\nPor favor, adicione os itens obrigatórios.`,
          });
          return;
        }

        // Avisos (ex: excedeu limite, mas pode continuar)
        if (intentResult.validation.warnings.length > 0) {
          const warnings = intentResult.validation.warnings.join('\n');
          await this.evolutionApi.sendMessage({
            to: data.from,
            text: `⚠️ ${warnings}\n\nDeseja continuar mesmo assim? (sim/não)`,
          });
          // TODO: Implementar aguardar confirmação se necessário
          // Por enquanto, continua
        }
      }

      // Busca itens do cardápio
      const menuItems = await this.menuItemRepository.findAvailableByRestaurantId(
        data.restaurantId
      );

      const orderItems: Array<{ menuItemId: string; quantity: number }> = [];
      const ambiguities: Array<{ itemName: string; quantity: number; matches: MenuItem[] }> = [];

      // Processa cada item extraído pelo DeepSeek
      if (!intentResult.items) {
        return;
      }
      for (const extractedItem of intentResult.items) {
        // Busca itens que correspondem ao nome
        const matches = this.findAmbiguousItems(extractedItem.name, menuItems);

        if (matches.length === 0) {
          // Item não encontrado - ignora
          continue;
        } else if (matches.length === 1) {
          // Item único encontrado - adiciona diretamente
          const menuItem = matches[0];
          orderItems.push({
            menuItemId: menuItem.getId(),
            quantity: extractedItem.quantity,
          });
        } else {
          // Múltiplos itens encontrados - precisa resolver ambiguidade
          ambiguities.push({
            itemName: extractedItem.name,
            quantity: extractedItem.quantity,
            matches,
          });
        }
      }

      // Se houver ambiguidades, pergunta ao cliente
      if (ambiguities.length > 0) {
        await this.resolveAmbiguity(data, ambiguities, orderItems);
        return;
      }

      // Se não houver ambiguidades e tiver itens, cria pedido
      if (orderItems.length > 0) {
        await this.createOrderFromItems(data, orderItems);
      } else {
        // Nenhum item válido encontrado
        await this.evolutionApi.sendMessage({
          to: data.from,
          text: '❌ Não consegui identificar os itens mencionados. Por favor, digite "ver cardápio" para ver os itens disponíveis ou mencione os itens novamente.',
        });
      }
    } catch (error: any) {
      logger.error('Error creating direct order from QR code', { error: error.message });
      await this.evolutionApi.sendMessage({
        to: data.from,
        text: `❌ Erro ao criar pedido: ${error.message}\n\nDigite "ver cardápio" para ver os itens disponíveis.`,
      });
    }
  }

  private findAmbiguousItems(itemName: string, menuItems: MenuItem[]): MenuItem[] {
    const normalizedName = itemName.toLowerCase().trim();

    // Busca itens que contenham o nome mencionado
    const matches = menuItems.filter((item) => {
      const itemNameLower = item.getName().toLowerCase();
      // Busca parcial: "hambúrguer" encontra "Hambúrguer Clássico", "Hambúrguer Artesanal", etc
      return itemNameLower.includes(normalizedName) || normalizedName.includes(itemNameLower);
    });

    return matches;
  }

  private async resolveAmbiguity(
    data: MessageData,
    ambiguities: Array<{ itemName: string; quantity: number; matches: MenuItem[] }>,
    confirmedItems: Array<{ menuItemId: string; quantity: number }>
  ): Promise<void> {
    // Salva itens já confirmados e ambiguidade pendente
    let orderData = await this.orderState.getOrderData(data.from);
    if (!orderData) {
      // Se não tiver estado, inicia
      await this.orderState.startOrderCreation(data.from);
      if (data.restaurantId) {
        await this.orderState.setRestaurant(data.from, data.restaurantId);
      }
    }

    const currentData = await this.orderState.getOrderData(data.from);
    if (currentData) {
      // Adiciona itens já confirmados ao carrinho
      for (const item of confirmedItems) {
        const menuItem = await this.menuItemRepository.findById(item.menuItemId);
        if (menuItem) {
          await this.orderState.addItem(data.from, {
            menuItemId: item.menuItemId,
            menuItemName: menuItem.getName(),
            quantity: item.quantity,
            unitPrice: menuItem.getPrice().getValue(),
            totalPrice: menuItem.getPrice().getValue() * item.quantity,
          });
        }
      }

      // Salva primeira ambiguidade para resolver
      const firstAmbiguity = ambiguities[0];
      await this.orderState.setPendingAmbiguity(data.from, {
        itemName: firstAmbiguity.itemName,
        quantity: firstAmbiguity.quantity,
        matches: firstAmbiguity.matches.map((m) => ({
          id: m.getId(),
          name: m.getName(),
          price: m.getPrice().getFormatted(),
        })),
      });
    }

    // Formata mensagem perguntando qual item
    const firstAmbiguity = ambiguities[0];
    const itemsList = firstAmbiguity.matches
      .map((item, index) => `${index + 1}. ${item.getName()} - ${item.getPrice().getFormatted()}`)
      .join('\n');

    let message = `Encontrei ${firstAmbiguity.matches.length} opções para "${firstAmbiguity.itemName}":\n\n${itemsList}\n\nQual você deseja? Digite o número (ex: "1" para ${firstAmbiguity.matches[0].getName()})`;

    // Se houver itens já confirmados, menciona
    if (confirmedItems.length > 0) {
      message = `✅ ${confirmedItems.length} item(ns) adicionado(s) ao carrinho!\n\n${message}`;
    }

    await this.evolutionApi.sendMessage({
      to: data.from,
      text: message,
    });
  }

  private async handleResolvingAmbiguity(data: MessageData): Promise<void> {
    const orderData = await this.orderState.getOrderData(data.from);
    if (!orderData) {
      return;
    }

    const pendingAmbiguity = await this.orderState.getPendingAmbiguity(data.from);
    if (!pendingAmbiguity) {
      return;
    }

    const text = data.text.trim();
    const selection = parseInt(text);

    if (isNaN(selection) || selection < 1 || selection > pendingAmbiguity.matches.length) {
      await this.evolutionApi.sendMessage({
        to: data.from,
        text: '❌ Por favor, digite um número válido da lista.',
      });
      return;
    }

    // Adiciona item selecionado
    const selectedMatch = pendingAmbiguity.matches[selection - 1];
    const menuItem = await this.menuItemRepository.findById(selectedMatch.id);

    if (menuItem) {
      await this.orderState.addItem(data.from, {
        menuItemId: menuItem.getId(),
        menuItemName: menuItem.getName(),
        quantity: pendingAmbiguity.quantity,
        unitPrice: menuItem.getPrice().getValue(),
        totalPrice: menuItem.getPrice().getValue() * pendingAmbiguity.quantity,
      });
    }

    // Limpa ambiguidade resolvida
    await this.orderState.clearPendingAmbiguity(data.from);
    await this.orderState.updateState(data.from, OrderCreationState.ADDING_ITEMS);

    const total = await this.orderState.calculateTotal(data.from);
    await this.evolutionApi.sendMessage({
      to: data.from,
      text: `✅ ${pendingAmbiguity.quantity}x ${menuItem?.getName()} adicionado!\n\nTotal: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total / 100)}\n\nDeseja adicionar mais algo? Digite os itens ou "finalizar" para confirmar.`,
    });
  }

  private async createOrderFromItems(
    data: MessageData,
    orderItems: Array<{ menuItemId: string; quantity: number }>
  ): Promise<void> {
    await this.ensureCustomerId(data);
    if (!data.customerId || !data.restaurantId) {
      return;
    }

    try {
      const restaurant = await this.restaurantRepository.findById(data.restaurantId);
      if (!restaurant) {
        throw new Error('Restaurant not found');
      }
      if (!restaurant.isOpenAt(new Date())) {
        await this.evolutionApi.sendMessage({
          to: data.from,
          text: '⏰ O restaurante está fechado no momento. Tente novamente no horário de funcionamento.',
        });
        return;
      }

      // Cria pedido diretamente
      const order = await this.createOrder.execute({
        restaurantId: data.restaurantId,
        customerId: data.customerId,
        items: orderItems,
        status: OrderStatus.NEW,
      });

      // Notifica restaurante
      await this.notificationService.notifyOrderCreated(order);

      // Confirma para cliente
      const orderId = MessageFormatter.formatOrderNumber(order);
      await this.evolutionApi.sendMessage({
        to: data.from,
        text: `✅ Pedido criado com sucesso!\n\nPedido #${orderId}\nTotal: ${order.getTotal().getFormatted()}\nStatus: 🆕 Novo\n\nAguarde confirmação do restaurante.`,
      });

      // Limpa estado
      await this.orderState.clearOrderData(data.from);
    } catch (error: any) {
      logger.error('Error creating order from items', { error: error.message });
      throw error;
    }
  }

  private async ensureCustomerId(data: MessageData): Promise<void> {
    if (data.customerId) {
      return;
    }

    const phone = Phone.create(data.from);
    const existing = await this.customerRepository.findByPhone(phone);
    if (existing) {
      data.customerId = existing.getId();
      return;
    }

    const created = Customer.create({ phone });
    const saved = await this.customerRepository.save(created);
    data.customerId = saved.getId();
  }
}
