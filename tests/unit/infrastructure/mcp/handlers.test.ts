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
});
