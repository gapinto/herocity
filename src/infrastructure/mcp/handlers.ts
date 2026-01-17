import { IRestaurantRepository } from '../../domain/repositories/IRestaurantRepository';
import { IMenuItemRepository } from '../../domain/repositories/IMenuItemRepository';
import { IOrderRepository } from '../../domain/repositories/IOrderRepository';
import { IOrderItemRepository } from '../../domain/repositories/IOrderItemRepository';
import { ICustomerRepository } from '../../domain/repositories/ICustomerRepository';
import { IIdempotencyService } from '../../domain/services/IIdempotencyService';
import { IPaymentService } from '../../domain/services/IPaymentService';
import { IPaymentAccountService } from '../../domain/services/IPaymentAccountService';
import { IActiveConversationService } from '../../domain/services/IActiveConversationService';
import { IConversationStateService } from '../../domain/services/IConversationStateService';
import { CreateMenuItem } from '../../domain/usecases/CreateMenuItem';
import { UpdateMenuItem } from '../../domain/usecases/UpdateMenuItem';
import { CreateOrder } from '../../domain/usecases/CreateOrder';
import { NotificationService } from '../../application/services/NotificationService';
import { OrderStatus } from '../../domain/enums/OrderStatus';
import { OrderStateMachine } from '../../domain/state/OrderStateMachine';
import { Price } from '../../domain/value-objects/Price';
import { Phone } from '../../domain/value-objects/Phone';
import { Customer } from '../../domain/entities/Customer';
import { OrderItem } from '../../domain/entities/OrderItem';
import { MenuItem } from '../../domain/entities/MenuItem';
import { Restaurant } from '../../domain/entities/Restaurant';
import { metricsService } from '../../application/services/MetricsService';
import { OnboardingData, OnboardingState } from '../../application/services/ConversationStateService';

export interface McpDependencies {
  restaurantRepository: IRestaurantRepository;
  menuItemRepository: IMenuItemRepository;
  orderRepository: IOrderRepository;
  orderItemRepository: IOrderItemRepository;
  customerRepository: ICustomerRepository;
  paymentService?: IPaymentService;
  paymentAccountService?: IPaymentAccountService;
  idempotencyService?: IIdempotencyService;
  notificationService?: NotificationService;
  activeConversationService?: IActiveConversationService;
  conversationStateService?: IConversationStateService;
  createMenuItem: CreateMenuItem;
  updateMenuItem: UpdateMenuItem;
  createOrder: CreateOrder;
}

function formatMenuItem(item: MenuItem): Record<string, any> {
  return {
    id: item.getId(),
    friendly_id: item.getFriendlyId() ?? null,
    name: item.getName(),
    description: item.getDescription(),
    price: item.getPrice().getValue(),
    is_available: item.isAvailable(),
  };
}

async function formatOrder(
  deps: McpDependencies,
  orderId: string
): Promise<Record<string, any>> {
  const order = await deps.orderRepository.findById(orderId);
  if (!order) {
    throw new Error('Order not found');
  }

  const items = await deps.orderItemRepository.findByOrderId(orderId);
  const enrichedItems = [];
  for (const item of items) {
    const menuItem = await deps.menuItemRepository.findById(item.getMenuItemId());
    enrichedItems.push({
      item_id: item.getMenuItemId(),
      name: menuItem ? menuItem.getName() : undefined,
      quantity: item.getQuantity(),
      unit_price: item.getPrice().getValue(),
      total_price: item.getSubtotal().getValue(),
    });
  }

  return {
    order_id: order.getId(),
    restaurant_id: order.getRestaurantId(),
    customer_id: order.getCustomerId(),
    status: OrderStateMachine.toMcpStatus(order.getStatus()),
    total: order.getTotal().getValue(),
    payment_method: order.getPaymentMethod(),
    payment_link: order.getPaymentLink(),
    payment_id: order.getPaymentId(),
    platform_fee: order.getPlatformFee()?.getValue(),
    restaurant_amount: order.getRestaurantAmount()?.getValue(),
    paid_at: order.getPaidAt()?.toISOString(),
    items: enrichedItems,
    created_at: order.getCreatedAt().toISOString(),
    updated_at: order.getUpdatedAt().toISOString(),
  };
}

async function recalculateTotal(
  deps: McpDependencies,
  orderId: string
): Promise<Price> {
  const items = await deps.orderItemRepository.findByOrderId(orderId);
  let total = Price.create(0);
  for (const item of items) {
    total = total.add(item.getSubtotal());
  }
  return total;
}

function parseOnboardingState(state: string): OnboardingState {
  const normalized = state.toUpperCase();
  switch (normalized) {
    case 'WAITING_NAME':
      return OnboardingState.WAITING_NAME;
    case 'WAITING_PHONE':
      return OnboardingState.WAITING_PHONE;
    case 'WAITING_ADDRESS':
      return OnboardingState.WAITING_ADDRESS;
    case 'WAITING_LEGAL_NAME':
      return OnboardingState.WAITING_LEGAL_NAME;
    case 'WAITING_CPF_CNPJ':
      return OnboardingState.WAITING_CPF_CNPJ;
    case 'WAITING_EMAIL':
      return OnboardingState.WAITING_EMAIL;
    case 'WAITING_BANK_ACCOUNT':
      return OnboardingState.WAITING_BANK_ACCOUNT;
    case 'WAITING_DOCUMENT':
      return OnboardingState.WAITING_DOCUMENT;
    case 'CREATING_PAYMENT_ACCOUNT':
      return OnboardingState.CREATING_PAYMENT_ACCOUNT;
    case 'COMPLETED':
      return OnboardingState.COMPLETED;
    default:
      throw new Error(`Unknown onboarding state: ${state}`);
  }
}

export function createMcpHandlers(deps: McpDependencies): Record<string, (params: Record<string, any>) => Promise<any>> {
  return {
    async create_restaurant(params) {
      const phone = Phone.create(params.phone);
      const existing = await deps.restaurantRepository.findByPhone(phone);
      if (existing) {
        return {
          restaurant: {
            id: existing.getId(),
            name: existing.getName(),
            phone: existing.getPhone().getValue(),
            address: existing.getAddress(),
            is_active: existing.isActive(),
            payment_account_id: existing.getPaymentAccountId(),
          },
          created: false,
        };
      }

      const restaurant = Restaurant.create({
        name: params.name,
        phone,
        address: params.address,
        postalCode: params.postal_code,
        addressNumber: params.address_number,
        complement: params.complement,
        province: params.province,
        city: params.city,
        state: params.state,
        legalName: params.legal_name,
        cpfCnpj: params.cpf_cnpj,
        email: params.email,
        bankAccount: params.bank_account,
        documentUrl: params.document_url,
        isActive: true,
      });

      const saved = await deps.restaurantRepository.save(restaurant);
      return {
        restaurant: {
          id: saved.getId(),
          name: saved.getName(),
          phone: saved.getPhone().getValue(),
          address: saved.getAddress(),
          postal_code: saved.getPostalCode(),
          address_number: saved.getAddressNumber(),
          complement: saved.getComplement(),
          province: saved.getProvince(),
          city: saved.getCity(),
          state: saved.getState(),
          is_active: saved.isActive(),
          payment_account_id: saved.getPaymentAccountId(),
        },
        created: true,
      };
    },

    async update_restaurant_payment_data(params) {
      const restaurant = await deps.restaurantRepository.findById(params.restaurant_id);
      if (!restaurant) throw new Error('Restaurant not found');

      restaurant.updatePaymentData({
        legalName: params.legal_name,
        cpfCnpj: params.cpf_cnpj,
        email: params.email,
        bankAccount: params.bank_account,
        documentUrl: params.document_url,
        address: params.address,
        postalCode: params.postal_code,
        addressNumber: params.address_number,
        complement: params.complement,
        province: params.province,
        city: params.city,
        state: params.state,
      });

      const saved = await deps.restaurantRepository.save(restaurant);
      return {
        restaurant: {
          id: saved.getId(),
          name: saved.getName(),
          payment_account_id: saved.getPaymentAccountId(),
          legal_name: saved.getLegalName(),
          cpf_cnpj: saved.getCpfCnpj(),
          email: saved.getEmail(),
          bank_account: saved.getBankAccount(),
          document_url: saved.getDocumentUrl(),
          address: saved.getAddress(),
          postal_code: saved.getPostalCode(),
          address_number: saved.getAddressNumber(),
          complement: saved.getComplement(),
          province: saved.getProvince(),
          city: saved.getCity(),
          state: saved.getState(),
        },
      };
    },

    async create_payment_account(params) {
      if (!deps.paymentAccountService) throw new Error('PaymentAccountService not configured');

      const restaurant = await deps.restaurantRepository.findById(params.restaurant_id);
      if (!restaurant) throw new Error('Restaurant not found');
      if (!restaurant.hasPaymentAccountData()) {
        throw new Error('Restaurant missing payment account data');
      }

      const result = await deps.paymentAccountService.createSubAccount({
        legalName: restaurant.getLegalName() as string,
        cpfCnpj: restaurant.getCpfCnpj() as string,
        email: restaurant.getEmail() as string,
        phone: restaurant.getPhone().getValue(),
        name: restaurant.getName(),
        bankAccount: restaurant.getBankAccount() as any,
        documentUrl: restaurant.getDocumentUrl(),
        address: restaurant.getAddress(),
        postalCode: restaurant.getPostalCode(),
        addressNumber: restaurant.getAddressNumber(),
        complement: restaurant.getComplement(),
        province: restaurant.getProvince(),
        city: restaurant.getCity(),
        state: restaurant.getState(),
      });

      restaurant.setPaymentAccountId(result.accountId);
      await deps.restaurantRepository.save(restaurant);

      return {
        restaurant_id: restaurant.getId(),
        payment_account_id: result.accountId,
        status: result.status,
      };
    },

    async get_qr_code(params) {
      const restaurant = await deps.restaurantRepository.findById(params.restaurant_id);
      if (!restaurant) throw new Error('Restaurant not found');
      if (!restaurant.isActive()) throw new Error('Restaurant is not active');

      const qrCodeText = `pedido:${params.restaurant_id}`;
      const whatsappNumber = process.env.WHATSAPP_NUMBER || '5511999999999';
      const whatsappLink = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(qrCodeText)}`;

      return {
        restaurant_id: params.restaurant_id,
        restaurant_name: restaurant.getName(),
        qr_code_text: qrCodeText,
        whatsapp_link: whatsappLink,
      };
    },

    async get_customer(params) {
      const customer = await deps.customerRepository.findById(params.customer_id);
      if (!customer) return { customer: null };
      return {
        customer: {
          id: customer.getId(),
          phone: customer.getPhone().getValue(),
          name: customer.getName(),
          address: customer.getAddress(),
        },
      };
    },

    async find_customer_by_phone(params) {
      const customer = await deps.customerRepository.findByPhone(Phone.create(params.phone));
      if (!customer) return { customer: null };
      return {
        customer: {
          id: customer.getId(),
          phone: customer.getPhone().getValue(),
          name: customer.getName(),
          address: customer.getAddress(),
        },
      };
    },
    async get_menu(params) {
      const items = await deps.menuItemRepository.findAvailableByRestaurantId(params.restaurant_id);
      return { items: items.map(formatMenuItem) };
    },

    async list_menu_items(params) {
      const items = params.include_unavailable
        ? await deps.menuItemRepository.findByRestaurantId(params.restaurant_id)
        : await deps.menuItemRepository.findAvailableByRestaurantId(params.restaurant_id);
      return { items: items.map(formatMenuItem) };
    },

    async create_menu_item(params) {
      const item = await deps.createMenuItem.execute({
        restaurantId: params.restaurant_id,
        name: params.name,
        price: params.price,
        description: params.description,
        isAvailable: params.is_available,
      });
      return { item: formatMenuItem(item) };
    },

    async update_menu_item(params) {
      const item = await deps.updateMenuItem.execute({
        id: params.item_id,
        name: params.name,
        price: params.price,
        description: params.description,
        isAvailable: params.is_available,
      });
      return { item: formatMenuItem(item) };
    },

    async block_menu_item(params) {
      const item = await deps.updateMenuItem.execute({ id: params.item_id, isAvailable: false });
      return { item: formatMenuItem(item) };
    },

    async unblock_menu_item(params) {
      const item = await deps.updateMenuItem.execute({ id: params.item_id, isAvailable: true });
      return { item: formatMenuItem(item) };
    },

    async get_restaurant(params) {
      const restaurant = await deps.restaurantRepository.findById(params.restaurant_id);
      if (!restaurant) throw new Error('Restaurant not found');
      return {
        restaurant: {
          id: restaurant.getId(),
          name: restaurant.getName(),
          phone: restaurant.getPhone().getValue(),
          address: restaurant.getAddress(),
          postal_code: restaurant.getPostalCode(),
          address_number: restaurant.getAddressNumber(),
          complement: restaurant.getComplement(),
          province: restaurant.getProvince(),
          city: restaurant.getCity(),
          state: restaurant.getState(),
          is_active: restaurant.isActive(),
          menu_rules: restaurant.getMenuRules(),
          payment_account_id: restaurant.getPaymentAccountId(),
        },
      };
    },

    async find_restaurant_by_phone(params) {
      const restaurant = await deps.restaurantRepository.findByPhone(Phone.create(params.phone));
      if (!restaurant) return { restaurant: null };
      return {
        restaurant: {
          id: restaurant.getId(),
          name: restaurant.getName(),
          phone: restaurant.getPhone().getValue(),
          address: restaurant.getAddress(),
          postal_code: restaurant.getPostalCode(),
          address_number: restaurant.getAddressNumber(),
          complement: restaurant.getComplement(),
          province: restaurant.getProvince(),
          city: restaurant.getCity(),
          state: restaurant.getState(),
          is_active: restaurant.isActive(),
          menu_rules: restaurant.getMenuRules(),
          payment_account_id: restaurant.getPaymentAccountId(),
        },
      };
    },

    async create_order(params) {
      const phone = Phone.create(params.customer_phone);
      let customer = await deps.customerRepository.findByPhone(phone);
      if (!customer) {
        const newCustomer = Customer.create({ phone });
        customer = await deps.customerRepository.save(newCustomer);
      }

      const idempotencyKey = params.idempotency_key || params.idempotencyKey;
      const order = await deps.createOrder.execute({
        restaurantId: params.restaurant_id,
        customerId: customer.getId(),
        items: [],
        status: OrderStatus.DRAFT,
        idempotencyKey,
      });

      metricsService.recordOrderCreated(params.restaurant_id);
      return await formatOrder(deps, order.getId());
    },

    async add_item(params) {
      const order = await deps.orderRepository.findById(params.order_id);
      if (!order) throw new Error('Order not found');
      OrderStateMachine.assertCanModify(order.getStatus());

      if (!Number.isInteger(params.quantity) || params.quantity < 1) {
        throw new Error('Quantity must be a positive integer');
      }

      const menuItem = await deps.menuItemRepository.findById(params.item_id);
      if (!menuItem || !menuItem.isAvailable()) throw new Error('Menu item not available');

      const orderItems = await deps.orderItemRepository.findByOrderId(order.getId());
      const existing = orderItems.find((item) => item.getMenuItemId() === params.item_id);

      if (existing) {
        await deps.orderItemRepository.delete(existing.getId());
      }

      const quantity = existing ? existing.getQuantity() + params.quantity : params.quantity;
      const newItem = OrderItem.create({
        orderId: order.getId(),
        menuItemId: params.item_id,
        quantity,
        price: menuItem.getPrice(),
      });
      await deps.orderItemRepository.save(newItem);

      const total = await recalculateTotal(deps, order.getId());
      order.updateTotal(total);
      await deps.orderRepository.save(order);

      return await formatOrder(deps, order.getId());
    },

    async remove_item(params) {
      const order = await deps.orderRepository.findById(params.order_id);
      if (!order) throw new Error('Order not found');
      OrderStateMachine.assertCanModify(order.getStatus());

      const orderItems = await deps.orderItemRepository.findByOrderId(order.getId());
      const existing = orderItems.find((item) => item.getMenuItemId() === params.item_id);
      if (existing) {
        await deps.orderItemRepository.delete(existing.getId());
      }

      const total = await recalculateTotal(deps, order.getId());
      order.updateTotal(total);
      await deps.orderRepository.save(order);

      return await formatOrder(deps, order.getId());
    },

    async change_item(params) {
      const order = await deps.orderRepository.findById(params.order_id);
      if (!order) throw new Error('Order not found');
      OrderStateMachine.assertCanModify(order.getStatus());

      const orderItems = await deps.orderItemRepository.findByOrderId(order.getId());
      const existing = orderItems.find((item) => item.getMenuItemId() === params.item_id);
      if (!existing) throw new Error('Order item not found');

      const newMenuItem = await deps.menuItemRepository.findById(params.new_item_id);
      if (!newMenuItem || !newMenuItem.isAvailable()) throw new Error('New menu item not available');

      await deps.orderItemRepository.delete(existing.getId());

      const newItem = OrderItem.create({
        orderId: order.getId(),
        menuItemId: params.new_item_id,
        quantity: existing.getQuantity(),
        price: newMenuItem.getPrice(),
      });
      await deps.orderItemRepository.save(newItem);

      const total = await recalculateTotal(deps, order.getId());
      order.updateTotal(total);
      await deps.orderRepository.save(order);

      return await formatOrder(deps, order.getId());
    },

    async get_order(params) {
      return await formatOrder(deps, params.order_id);
    },

    async get_order_status(params) {
      const order = await deps.orderRepository.findById(params.order_id);
      if (!order) throw new Error('Order not found');
      return { order_id: order.getId(), status: OrderStateMachine.toMcpStatus(order.getStatus()) };
    },

    async list_orders_by_status(params) {
      const status = OrderStateMachine.toDomainStatus(params.status);
      const orders = await deps.orderRepository.findByRestaurantAndStatus(params.restaurant_id, status);
      const result = [];
      for (const order of orders) {
        result.push({
          order_id: order.getId(),
          status: OrderStateMachine.toMcpStatus(order.getStatus()),
          total: order.getTotal().getValue(),
          customer_id: order.getCustomerId(),
        });
      }
      return { orders: result };
    },

    async cancel_order(params) {
      const order = await deps.orderRepository.findById(params.order_id);
      if (!order) throw new Error('Order not found');
      OrderStateMachine.assertCanCancel(order.getStatus());
      order.cancel();
      await deps.orderRepository.save(order);
      if (deps.notificationService) {
        await deps.notificationService.notifyOrderCancelled(order);
      }
      return await formatOrder(deps, order.getId());
    },

    async request_payment(params) {
      const order = await deps.orderRepository.findById(params.order_id);
      if (!order) throw new Error('Order not found');
      OrderStateMachine.assertCanRequestPayment(order.getStatus());

      if (!deps.paymentService) throw new Error('Payment service not configured');

      const restaurant = await deps.restaurantRepository.findById(order.getRestaurantId());
      if (!restaurant) throw new Error('Restaurant not found');
      if (!restaurant.getPaymentAccountId()) {
        throw new Error('Restaurant payment account not configured');
      }

      const customer = await deps.customerRepository.findById(order.getCustomerId());

      const totalInCents = Math.round(order.getTotal().getValue() * 100);
      const platformFeePercent = parseFloat(process.env.PLATFORM_FEE_PERCENT || '10');
      const platformFee = Math.round(totalInCents * (platformFeePercent / 100));
      const restaurantAmount = totalInCents - platformFee;

      const payment = await deps.paymentService.createPayment({
        orderId: order.getId(),
        amount: totalInCents,
        method: params.method,
        customerId: order.getCustomerId(),
        customerName: customer?.getName(),
        customerPhone: customer?.getPhone().getValue(),
        description: `Pedido ${order.getId().slice(0, 8)}`,
        splitConfig: {
          restaurantId: restaurant.getPaymentAccountId() as string,
          platformFee,
          restaurantAmount,
        },
      });

      order.updatePaymentInfo(params.method, payment.paymentLink, payment.paymentId);
      await deps.orderRepository.save(order);

      return {
        order_id: order.getId(),
        status: OrderStateMachine.toMcpStatus(order.getStatus()),
        payment_id: payment.paymentId,
        payment_link: payment.paymentLink,
        qr_code: payment.qrCode,
      };
    },

    async confirm_payment(params) {
      const order = await deps.orderRepository.findById(params.order_id);
      if (!order) throw new Error('Order not found');
      OrderStateMachine.assertCanConfirmPayment(order.getStatus());

      if (!deps.paymentService) throw new Error('Payment service not configured');

      const confirmation = await deps.paymentService.confirmPayment(params.payment_id);
      order.confirmPayment(
        confirmation.paymentId,
        Price.create((confirmation.platformFee || 0) / 100),
        Price.create((confirmation.restaurantAmount || confirmation.amount) / 100)
      );
      await deps.orderRepository.save(order);

      return {
        order_id: order.getId(),
        status: OrderStateMachine.toMcpStatus(order.getStatus()),
        payment_id: confirmation.paymentId,
        paid_at: confirmation.paidAt.toISOString(),
      };
    },

    async notify_kitchen(params) {
      const order = await deps.orderRepository.findById(params.order_id);
      if (!order) throw new Error('Order not found');
      OrderStateMachine.assertCanNotifyKitchen(order.getStatus());

      if (deps.notificationService) {
        await deps.notificationService.notifyOrderCreated(order);
      }

      return { order_id: order.getId(), notified: true };
    },

    async mark_order_preparing(params) {
      const order = await deps.orderRepository.findById(params.order_id);
      if (!order) throw new Error('Order not found');
      OrderStateMachine.assertCanMarkPreparing(order.getStatus());

      order.updateStatus(OrderStatus.PREPARING);
      await deps.orderRepository.save(order);
      if (deps.notificationService) {
        await deps.notificationService.notifyOrderStatusChanged(order, OrderStatus.PREPARING);
      }

      return { order_id: order.getId(), status: OrderStateMachine.toMcpStatus(order.getStatus()) };
    },

    async mark_order_ready(params) {
      const order = await deps.orderRepository.findById(params.order_id);
      if (!order) throw new Error('Order not found');
      OrderStateMachine.assertCanMarkReady(order.getStatus());

      order.updateStatus(OrderStatus.READY);
      await deps.orderRepository.save(order);
      if (deps.notificationService) {
        await deps.notificationService.notifyOrderStatusChanged(order, OrderStatus.READY);
      }

      return { order_id: order.getId(), status: OrderStateMachine.toMcpStatus(order.getStatus()) };
    },

    async notify_customer(params) {
      const order = await deps.orderRepository.findById(params.order_id);
      if (!order) throw new Error('Order not found');
      if (deps.notificationService) {
        await deps.notificationService.notifyCustomer(order.getCustomerId(), params.message);
      }
      return { order_id: order.getId(), notified: true };
    },

    async get_active_conversation(params) {
      if (!deps.activeConversationService) throw new Error('ActiveConversationService not configured');
      const active = await deps.activeConversationService.hasActiveConversation(params.phone);
      return { phone: params.phone, active };
    },

    async set_active_conversation(params) {
      if (!deps.activeConversationService) throw new Error('ActiveConversationService not configured');
      await deps.activeConversationService.markAsActive(params.phone);
      return { phone: params.phone, active: true, ttl: params.ttl };
    },

    async clear_active_conversation(params) {
      if (!deps.activeConversationService) throw new Error('ActiveConversationService not configured');
      await deps.activeConversationService.clear(params.phone);
      return { phone: params.phone, active: false };
    },

    async get_onboarding_state(params) {
      if (!deps.conversationStateService) throw new Error('ConversationStateService not configured');
      const conversation = await deps.conversationStateService.getConversation(params.phone);
      return { phone: params.phone, conversation: conversation || null };
    },

    async set_onboarding_state(params) {
      if (!deps.conversationStateService) throw new Error('ConversationStateService not configured');
      const state = parseOnboardingState(params.state);
      const data: OnboardingData = { state, ...(params.data || {}) };
      await deps.conversationStateService.setConversation(params.phone, data);
      return { phone: params.phone, state };
    },

    async clear_onboarding_state(params) {
      if (!deps.conversationStateService) throw new Error('ConversationStateService not configured');
      await deps.conversationStateService.clearConversation(params.phone);
      return { phone: params.phone, cleared: true };
    },

    async health_check() {
      return { status: 'ok', timestamp: new Date().toISOString() };
    },

    async get_metrics() {
      return { metrics: metricsService.getAllMetrics(), timestamp: new Date().toISOString() };
    },
  };
}
