import { OrderItem } from '../entities/OrderItem';

export interface IOrderItemRepository {
  findByOrderId(orderId: string): Promise<OrderItem[]>;
  findById(id: string): Promise<OrderItem | null>;
  save(orderItem: OrderItem): Promise<OrderItem>;
  delete(id: string): Promise<void>;
  deleteByOrderId(orderId: string): Promise<void>;
}

