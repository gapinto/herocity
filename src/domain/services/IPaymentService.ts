export type PaymentMethod = 'pix' | 'card';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'cancelled';

export interface SplitConfig {
  restaurantId: string;
  restaurantAmount: number; // em centavos
  platformFee: number; // em centavos
}

export interface PaymentRequest {
  orderId: string;
  amount: number; // em centavos
  method: PaymentMethod;
  customerId: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  description?: string;
  splitConfig?: SplitConfig;
}

export interface PaymentResponse {
  paymentId: string;
  paymentLink: string;
  qrCode?: string; // Para Pix
  expiresAt?: Date;
  status: PaymentStatus;
}

export interface PaymentConfirmation {
  paymentId: string;
  status: PaymentStatus;
  paidAt: Date;
  amount: number;
  platformFee?: number;
  restaurantAmount?: number;
}

export interface IPaymentService {
  /**
   * Gera link de pagamento (Pix ou Cartão)
   */
  createPayment(request: PaymentRequest): Promise<PaymentResponse>;

  /**
   * Consulta status do pagamento
   */
  getPaymentStatus(paymentId: string): Promise<PaymentStatus>;

  /**
   * Confirma pagamento (chamado via webhook)
   */
  confirmPayment(paymentId: string): Promise<PaymentConfirmation>;

  /**
   * Cancela pagamento pendente
   */
  cancelPayment(paymentId: string): Promise<boolean>;
}
