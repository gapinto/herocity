import { createMcpHandlers } from '../../../../src/infrastructure/mcp/handlers';
import { OrderStatus } from '../../../../src/domain/enums/OrderStatus';
import { Order } from '../../../../src/domain/entities/Order';
import { Price } from '../../../../src/domain/value-objects/Price';
import { Phone } from '../../../../src/domain/value-objects/Phone';
import { Restaurant } from '../../../../src/domain/entities/Restaurant';
import { Customer } from '../../../../src/domain/entities/Customer';

const makeDeps = () => {
  const baseAddress = {
    address: 'Rua Teste, 123',
    postalCode: '50000000',
    addressNumber: '123',
    complement: 'Sala 1',
    province: 'Centro',
    city: 'Recife',
    state: 'PE',
  };
  const restaurant = Restaurant.create({
    id: 'rest-1',
    name: 'Rest',
    phone: Phone.create('5511999999999'),
    ...baseAddress,
    isActive: true,
  });

  const customer = Customer.create({
    id: 'cust-1',
    phone: Phone.create('5511888888888'),
  });

  const order = Order.create({
    id: 'order-1',
    restaurantId: restaurant.getId(),
    customerId: customer.getId(),
    total: Price.create(0),
    status: OrderStatus.DRAFT,
  });

  return {
    restaurant,
    customer,
    order,
    deps: {
      restaurantRepository: {
        findById: jest.fn().mockResolvedValue(restaurant),
        findByPhone: jest.fn().mockResolvedValue(restaurant),
        save: jest.fn().mockResolvedValue(restaurant),
      } as any,
      menuItemRepository: {
        findAvailableByRestaurantId: jest.fn().mockResolvedValue([]),
        findByRestaurantId: jest.fn().mockResolvedValue([]),
        findById: jest.fn().mockResolvedValue(null),
      } as any,
      orderRepository: {
        findById: jest.fn().mockResolvedValue(order),
        save: jest.fn().mockResolvedValue(order),
        findByRestaurantAndStatus: jest.fn().mockResolvedValue([order]),
        findByRestaurantId: jest.fn().mockResolvedValue([order]),
      } as any,
      orderItemRepository: {
        findByOrderId: jest.fn().mockResolvedValue([]),
        save: jest.fn(),
        delete: jest.fn(),
      } as any,
      customerRepository: {
        findByPhone: jest.fn().mockResolvedValue(customer),
        findById: jest.fn().mockResolvedValue(customer),
        save: jest.fn().mockResolvedValue(customer),
      } as any,
      createMenuItem: { execute: jest.fn() } as any,
      updateMenuItem: { execute: jest.fn() } as any,
      createOrder: { execute: jest.fn().mockResolvedValue(order) } as any,
    },
  };
};

describe('MCP handlers', () => {
  it('get_qr_code returns QR payload', async () => {
    const { deps } = makeDeps();
    const handlers = createMcpHandlers(deps as any);
    const result = await handlers.get_qr_code({ restaurant_id: 'rest-1' });

    expect(result.qr_code_text).toBe('pedido:rest-1');
    expect(result.whatsapp_link).toContain('https://wa.me/');
  });

  it('create_order returns order payload', async () => {
    const { deps, order } = makeDeps();
    const handlers = createMcpHandlers(deps as any);
    const result = await handlers.create_order({
      restaurant_id: 'rest-1',
      customer_phone: '5511888888888',
    });

    expect(result.order_id).toBe(order.getId());
    expect(result.status).toBe('BUILDING');
  });

  it('update_restaurant_payment_data stores birth date', async () => {
    const { deps, restaurant } = makeDeps();
    const handlers = createMcpHandlers(deps as any);
    deps.restaurantRepository.findById = jest.fn().mockResolvedValue(restaurant);
    deps.restaurantRepository.save = jest.fn().mockImplementation((savedRestaurant) => Promise.resolve(savedRestaurant));

    const result = await handlers.update_restaurant_payment_data({
      restaurant_id: restaurant.getId(),
      birth_date: '1992-05-06',
    });

    expect(deps.restaurantRepository.save).toHaveBeenCalled();
    expect(result.restaurant.birth_date).toBe('1992-05-06');
  });

  it('update_restaurant_payment_data stores income value', async () => {
    const { deps, restaurant } = makeDeps();
    const handlers = createMcpHandlers(deps as any);
    deps.restaurantRepository.findById = jest.fn().mockResolvedValue(restaurant);
    deps.restaurantRepository.save = jest.fn().mockImplementation((savedRestaurant) => Promise.resolve(savedRestaurant));

    const result = await handlers.update_restaurant_payment_data({
      restaurant_id: restaurant.getId(),
      income_value: 25000,
    });

    expect(deps.restaurantRepository.save).toHaveBeenCalled();
    expect(result.restaurant.income_value).toBe(25000);
  });

  it('create_payment_account returns activation guidance when pending', async () => {
    process.env.ASAAS_WEBHOOK_BASE_URL = 'https://example.com';
    const { deps, restaurant } = makeDeps();
    restaurant.updatePaymentData({
      legalName: 'Restaurante Teste LTDA',
      cpfCnpj: '12345678000190',
      email: 'contato@restaurante.com.br',
      birthDate: '1992-05-06',
      incomeValue: 25000,
      bankAccount: {
        bankCode: '001',
        agency: '1234',
        account: '567890',
        accountDigit: '1',
        accountType: 'CHECKING',
        accountHolderName: 'Restaurante Teste LTDA',
      },
    });
    const handlers = createMcpHandlers({
      ...deps,
      paymentAccountService: {
        createSubAccount: jest.fn().mockResolvedValue({
          accountId: 'acc_123',
          walletId: 'wallet_123',
          status: 'pending',
        }),
        getAccountStatus: jest.fn(),
        updateBankAccount: jest.fn(),
      },
    } as any);

    deps.restaurantRepository.findById = jest.fn().mockResolvedValue(restaurant);
    deps.restaurantRepository.save = jest.fn().mockResolvedValue(restaurant);

    const result = await handlers.create_payment_account({
      restaurant_id: restaurant.getId(),
    });

    expect(result.activation_required).toBe(true);
    expect(result.activation_message).toContain('ativação');
    delete process.env.ASAAS_WEBHOOK_BASE_URL;
  });

  it('kitchen_queue returns preparing then top 5 ready', async () => {
    const { deps } = makeDeps();
    const handlers = createMcpHandlers(deps as any);

    const makeOrder = (id: string, status: OrderStatus, createdAt: Date) =>
      Order.create({
        id,
        restaurantId: 'rest-1',
        customerId: 'cust-1',
        total: Price.create(12),
        status,
        createdAt,
      });

    const preparingOrders = [
      makeOrder('prep-2', OrderStatus.PREPARING, new Date('2024-01-02')),
      makeOrder('prep-1', OrderStatus.PREPARING, new Date('2024-01-01')),
    ];
    const readyOrders = [
      makeOrder('ready-3', OrderStatus.READY, new Date('2024-01-03')),
      makeOrder('ready-1', OrderStatus.READY, new Date('2024-01-01')),
      makeOrder('ready-2', OrderStatus.READY, new Date('2024-01-02')),
      makeOrder('ready-4', OrderStatus.READY, new Date('2024-01-04')),
      makeOrder('ready-5', OrderStatus.READY, new Date('2024-01-05')),
      makeOrder('ready-6', OrderStatus.READY, new Date('2024-01-06')),
    ];

    deps.orderRepository.findByRestaurantAndStatus = jest
      .fn()
      .mockImplementation((_, status: OrderStatus) => {
        if (status === OrderStatus.PREPARING) return Promise.resolve(preparingOrders);
        if (status === OrderStatus.READY) return Promise.resolve(readyOrders);
        return Promise.resolve([]);
      });

    const result = await handlers.kitchen_queue({ restaurant_id: 'rest-1' });
    expect(result.orders.map((item: any) => item.order_id)).toEqual([
      'prep-1',
      'prep-2',
      'ready-1',
      'ready-2',
      'ready-3',
      'ready-4',
      'ready-5',
    ]);
  });

  it('kitchen_order_details resolves by short id', async () => {
    const { deps, order } = makeDeps();
    const handlers = createMcpHandlers(deps as any);

    deps.orderRepository.findByRestaurantId = jest.fn().mockResolvedValue([order]);

    const result = await handlers.kitchen_order_details({
      restaurant_id: 'rest-1',
      order_short_id: order.getId().slice(0, 6),
    });

    expect(result.order_id).toBe(order.getId());
  });
});
