import { OrderStatus } from '../enums/OrderStatus';
import { Price } from '../value-objects/Price';

export interface OrderProps {
  id?: string;
  restaurantId: string;
  customerId: string;
  status?: OrderStatus;
  total: Price;
  paymentMethod?: string;
  paymentLink?: string;
  paymentId?: string;
  platformFee?: Price;
  restaurantAmount?: Price;
  paidAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Order {
  private id: string;
  private restaurantId: string;
  private customerId: string;
  private status: OrderStatus;
  private total: Price;
  private paymentMethod?: string;
  private paymentLink?: string;
  private paymentId?: string;
  private platformFee?: Price;
  private restaurantAmount?: Price;
  private paidAt?: Date;
  private createdAt: Date;
  private updatedAt: Date;

  private constructor(props: OrderProps) {
    this.id = props.id || '';
    this.restaurantId = props.restaurantId;
    this.customerId = props.customerId;
    this.status = props.status || OrderStatus.DRAFT;
    this.total = props.total;
    this.paymentMethod = props.paymentMethod;
    this.paymentLink = props.paymentLink;
    this.paymentId = props.paymentId;
    this.platformFee = props.platformFee;
    this.restaurantAmount = props.restaurantAmount;
    this.paidAt = props.paidAt;
    this.createdAt = props.createdAt || new Date();
    this.updatedAt = props.updatedAt || new Date();
  }

  static create(props: OrderProps): Order {
    if (!props.restaurantId || props.restaurantId.trim().length === 0) {
      throw new Error('Restaurant ID cannot be empty');
    }

    if (!props.customerId || props.customerId.trim().length === 0) {
      throw new Error('Customer ID cannot be empty');
    }

    return new Order(props);
  }

  static fromPersistence(props: Required<Omit<OrderProps, 'paymentMethod' | 'paymentLink' | 'paymentId' | 'platformFee' | 'restaurantAmount' | 'paidAt'>> & Partial<Pick<OrderProps, 'paymentMethod' | 'paymentLink' | 'paymentId' | 'platformFee' | 'restaurantAmount' | 'paidAt'>>): Order {
    return new Order(props);
  }

  getId(): string {
    return this.id;
  }

  getRestaurantId(): string {
    return this.restaurantId;
  }

  getCustomerId(): string {
    return this.customerId;
  }

  getStatus(): OrderStatus {
    return this.status;
  }

  getTotal(): Price {
    return this.total;
  }

  updateTotal(total: Price): void {
    // Idempotência: se o total já é o mesmo, não altera
    if (this.total.getValue() === total.getValue()) {
      return;
    }
    this.total = total;
    this.updatedAt = new Date();
  }

  updateStatus(newStatus: OrderStatus): void {
    // Idempotência: se já está no status desejado, não faz nada
    if (this.status === newStatus) {
      return; // Operação idempotente - já está no status desejado
    }

    if (this.status === OrderStatus.CANCELLED) {
      throw new Error('Cannot update status of cancelled order');
    }

    if (this.status === OrderStatus.DELIVERED && newStatus !== OrderStatus.DELIVERED) {
      throw new Error('Cannot update status of delivered order');
    }

    this.status = newStatus;
    this.updatedAt = new Date();
  }

  updatePaymentInfo(method: string, link: string, paymentId?: string): void {
    // Idempotência: verifica se já tem paymentId e paymentLink (evita sobrescrever)
    if (paymentId && this.paymentId && this.paymentId !== paymentId) {
      throw new Error('Payment ID already set. Cannot update payment info with different payment ID.');
    }

    if (this.paymentLink && this.paymentLink !== link) {
      throw new Error('Payment link already set. Cannot update payment info.');
    }

    // Idempotência: verifica se já está em AWAITING_PAYMENT ou PAID
    if (this.status === OrderStatus.AWAITING_PAYMENT || this.status === OrderStatus.PAID) {
      if (this.paymentLink === link && (!paymentId || this.paymentId === paymentId)) {
        // Mesmos dados, operação idempotente - não faz nada
        return;
      }
      throw new Error('Cannot update payment info for orders already awaiting payment or paid');
    }

    if (this.status !== OrderStatus.DRAFT) {
      throw new Error('Can only update payment info for draft orders');
    }

    this.paymentMethod = method;
    this.paymentLink = link;
    if (paymentId) {
      this.paymentId = paymentId; // Salva paymentId logo após criar pagamento (para buscar no webhook)
    }
    this.status = OrderStatus.AWAITING_PAYMENT;
    this.updatedAt = new Date();
  }

  confirmPayment(paymentId: string, platformFee: Price, restaurantAmount: Price): void {
    // Idempotência: verifica se já tem paymentId (evita confirmação duplicada)
    if (this.paymentId) {
      if (this.paymentId === paymentId) {
        // Mesmo paymentId, operação idempotente - não faz nada
        if (this.status === OrderStatus.PAID) {
          return;
        }
        // Tem paymentId mas status não é PAID - atualiza status apenas
        this.status = OrderStatus.PAID;
        this.updatedAt = new Date();
        return;
      }
      throw new Error('Payment already confirmed with different payment ID');
    }

    // Idempotência: verifica se já está pago
    if (this.status === OrderStatus.PAID) {
      throw new Error('Order already paid. Cannot confirm payment again.');
    }

    if (this.status !== OrderStatus.AWAITING_PAYMENT) {
      throw new Error(`Can only confirm payment for orders awaiting payment. Current status: ${this.status}`);
    }

    this.paymentId = paymentId;
    this.platformFee = platformFee;
    this.restaurantAmount = restaurantAmount;
    this.paidAt = new Date();
    this.status = OrderStatus.PAID;
    this.updatedAt = new Date();
  }

  canBeModified(): boolean {
    return this.status === OrderStatus.DRAFT || this.status === OrderStatus.AWAITING_PAYMENT;
  }

  canBeCancelled(): boolean {
    return this.status === OrderStatus.DRAFT || this.status === OrderStatus.AWAITING_PAYMENT;
  }

  cancel(): void {
    // Idempotência: se já está cancelado, não faz nada
    if (this.status === OrderStatus.CANCELLED) {
      return; // Operação idempotente - já está cancelado
    }

    if (!this.canBeCancelled()) {
      if (this.status === OrderStatus.PREPARING || this.status === OrderStatus.READY) {
        throw new Error('Cannot cancel order that is being prepared or ready');
      }
      if (this.status === OrderStatus.PAID) {
        throw new Error('Cannot cancel paid order. Contact restaurant for refund.');
      }
      throw new Error(`Cannot cancel order in current status: ${this.status}`);
    }

    this.status = OrderStatus.CANCELLED;
    this.updatedAt = new Date();
  }

  getPaymentMethod(): string | undefined {
    return this.paymentMethod;
  }

  getPaymentLink(): string | undefined {
    return this.paymentLink;
  }

  getPaymentId(): string | undefined {
    return this.paymentId;
  }

  getPlatformFee(): Price | undefined {
    return this.platformFee;
  }

  getRestaurantAmount(): Price | undefined {
    return this.restaurantAmount;
  }

  getPaidAt(): Date | undefined {
    return this.paidAt;
  }

  getCreatedAt(): Date {
    return this.createdAt;
  }

  getUpdatedAt(): Date {
    return this.updatedAt;
  }
}

