export enum OrderCreationState {
  IDLE = 'IDLE',
  SELECTING_RESTAURANT = 'SELECTING_RESTAURANT',
  VIEWING_MENU = 'VIEWING_MENU',
  ADDING_ITEMS = 'ADDING_ITEMS',
  RESOLVING_AMBIGUITY = 'RESOLVING_AMBIGUITY',
  CONFIRMING_ORDER = 'CONFIRMING_ORDER',
  AWAITING_PAYMENT_METHOD = 'AWAITING_PAYMENT_METHOD',
  AWAITING_PAYMENT = 'AWAITING_PAYMENT',
}

export interface OrderItemData {
  menuItemId: string;
  menuItemName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface AmbiguityData {
  itemName: string;
  quantity: number;
  matches: Array<{ id: string; name: string; price: string }>;
}

export interface OrderCreationData {
  state: OrderCreationState;
  restaurantId?: string;
  items: OrderItemData[];
  pendingAmbiguity?: AmbiguityData;
  currentOrderId?: string;
}

export class OrderStateService {
  private orders: Map<string, OrderCreationData> = new Map();

  getOrderData(phone: string): OrderCreationData | undefined {
    return this.orders.get(phone);
  }

  startOrderCreation(phone: string): void {
    this.orders.set(phone, {
      state: OrderCreationState.SELECTING_RESTAURANT,
      items: [],
    });
  }

  setRestaurant(phone: string, restaurantId: string): void {
    const data = this.orders.get(phone);
    if (data) {
      data.restaurantId = restaurantId;
      data.state = OrderCreationState.VIEWING_MENU;
      this.orders.set(phone, data);
    }
  }

  updateState(phone: string, state: OrderCreationState): void {
    const data = this.orders.get(phone);
    if (data) {
      data.state = state;
      this.orders.set(phone, data);
    }
  }

  addItem(phone: string, item: OrderItemData): void {
    const data = this.orders.get(phone);
    if (data) {
      data.items.push(item);
      data.state = OrderCreationState.ADDING_ITEMS;
      this.orders.set(phone, data);
    }
  }

  removeItem(phone: string, index: number): void {
    const data = this.orders.get(phone);
    if (data && index >= 0 && index < data.items.length) {
      data.items.splice(index, 1);
      this.orders.set(phone, data);
    }
  }

  calculateTotal(phone: string): number {
    const data = this.orders.get(phone);
    if (!data) return 0;

    return data.items.reduce((sum, item) => sum + item.totalPrice, 0);
  }

  setPendingAmbiguity(phone: string, ambiguity: AmbiguityData): void {
    const data = this.orders.get(phone);
    if (data) {
      data.pendingAmbiguity = ambiguity;
      data.state = OrderCreationState.RESOLVING_AMBIGUITY;
      this.orders.set(phone, data);
    }
  }

  getPendingAmbiguity(phone: string): AmbiguityData | undefined {
    const data = this.orders.get(phone);
    return data?.pendingAmbiguity;
  }

  clearPendingAmbiguity(phone: string): void {
    const data = this.orders.get(phone);
    if (data) {
      data.pendingAmbiguity = undefined;
      this.orders.set(phone, data);
    }
  }

  clearOrderData(phone: string): void {
    this.orders.delete(phone);
  }
}

