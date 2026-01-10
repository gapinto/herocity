import { IOrderStateService } from '../../domain/services/IOrderStateService';
import { OrderCreationState, OrderItemData, AmbiguityData, OrderCreationData } from '../../application/services/OrderStateService';

export class InMemoryOrderStateService implements IOrderStateService {
  private orders: Map<string, OrderCreationData> = new Map();

  async getOrderData(phone: string): Promise<OrderCreationData | undefined> {
    return this.orders.get(phone);
  }

  async startOrderCreation(phone: string): Promise<void> {
    this.orders.set(phone, {
      state: OrderCreationState.SELECTING_RESTAURANT,
      items: [],
    });
  }

  async setRestaurant(phone: string, restaurantId: string): Promise<void> {
    const data = this.orders.get(phone);
    if (data) {
      data.restaurantId = restaurantId;
      data.state = OrderCreationState.VIEWING_MENU;
      this.orders.set(phone, data);
    }
  }

  async updateState(phone: string, state: OrderCreationState): Promise<void> {
    const data = this.orders.get(phone);
    if (data) {
      data.state = state;
      this.orders.set(phone, data);
    }
  }

  async addItem(phone: string, item: OrderItemData): Promise<void> {
    const data = this.orders.get(phone);
    if (data) {
      data.items.push(item);
      data.state = OrderCreationState.ADDING_ITEMS;
      this.orders.set(phone, data);
    }
  }

  async removeItem(phone: string, index: number): Promise<void> {
    const data = this.orders.get(phone);
    if (data && index >= 0 && index < data.items.length) {
      data.items.splice(index, 1);
      this.orders.set(phone, data);
    }
  }

  async calculateTotal(phone: string): Promise<number> {
    const data = this.orders.get(phone);
    if (!data) return 0;

    return data.items.reduce((sum, item) => sum + item.totalPrice, 0);
  }

  async setPendingAmbiguity(phone: string, ambiguity: AmbiguityData): Promise<void> {
    const data = this.orders.get(phone);
    if (data) {
      data.pendingAmbiguity = ambiguity;
      data.state = OrderCreationState.RESOLVING_AMBIGUITY;
      this.orders.set(phone, data);
    }
  }

  async getPendingAmbiguity(phone: string): Promise<AmbiguityData | undefined> {
    const data = this.orders.get(phone);
    return data?.pendingAmbiguity;
  }

  async clearPendingAmbiguity(phone: string): Promise<void> {
    const data = this.orders.get(phone);
    if (data) {
      data.pendingAmbiguity = undefined;
      this.orders.set(phone, data);
    }
  }

  async setCurrentOrderId(phone: string, orderId: string): Promise<void> {
    const data = this.orders.get(phone);
    if (data) {
      data.currentOrderId = orderId;
      this.orders.set(phone, data);
    }
  }

  async getCurrentOrderId(phone: string): Promise<string | undefined> {
    const data = this.orders.get(phone);
    return data?.currentOrderId;
  }

  async clearOrderData(phone: string): Promise<void> {
    this.orders.delete(phone);
  }
}
