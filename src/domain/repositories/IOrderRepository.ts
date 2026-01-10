import { Order } from '../entities/Order';
import { OrderStatus } from '../enums/OrderStatus';

export interface IOrderRepository {
  findById(id: string): Promise<Order | null>;
  findByRestaurantId(restaurantId: string): Promise<Order[]>;
  findByCustomerId(customerId: string): Promise<Order[]>;
  findByStatus(status: OrderStatus): Promise<Order[]>;
  findByRestaurantAndStatus(restaurantId: string, status: OrderStatus): Promise<Order[]>;
  findByPaymentId(paymentId: string): Promise<Order | null>;
  save(order: Order): Promise<Order>;
  delete(id: string): Promise<void>;
}

