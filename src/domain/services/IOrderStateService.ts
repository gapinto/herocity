import { OrderCreationState, OrderItemData, AmbiguityData, OrderCreationData } from '../../application/services/OrderStateService';

export interface IOrderStateService {
  getOrderData(phone: string): Promise<OrderCreationData | undefined>;
  startOrderCreation(phone: string): Promise<void>;
  setRestaurant(phone: string, restaurantId: string): Promise<void>;
  updateState(phone: string, state: OrderCreationState): Promise<void>;
  addItem(phone: string, item: OrderItemData): Promise<void>;
  removeItem(phone: string, index: number): Promise<void>;
  calculateTotal(phone: string): Promise<number>;
  setPendingAmbiguity(phone: string, ambiguity: AmbiguityData): Promise<void>;
  getPendingAmbiguity(phone: string): Promise<AmbiguityData | undefined>;
  clearPendingAmbiguity(phone: string): Promise<void>;
  setCurrentOrderId(phone: string, orderId: string): Promise<void>;
  getCurrentOrderId(phone: string): Promise<string | undefined>;
  clearOrderData(phone: string): Promise<void>;
}
