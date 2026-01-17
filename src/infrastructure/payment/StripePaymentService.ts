import { IPaymentService, PaymentRequest, PaymentResponse, PaymentConfirmation, PaymentStatus } from '../../domain/services/IPaymentService';
import { IIdempotencyService } from '../../domain/services/IIdempotencyService';
import { logger } from '../../shared/utils/logger';

export class StripePaymentService implements IPaymentService {
  private readonly apiKey: string;

  constructor(private readonly idempotencyService?: IIdempotencyService) {
    this.apiKey = process.env.STRIPE_SECRET_KEY || '';
    // platformAccountId será usado no futuro para split payments (application_fee)
    // const platformAccountId = process.env.STRIPE_PLATFORM_ACCOUNT_ID || '';

    if (!this.apiKey) {
      logger.warn('StripePaymentService: STRIPE_SECRET_KEY not configured');
    }
  }

  async createPayment(request: PaymentRequest): Promise<PaymentResponse> {
    // Idempotência: verifica se já existe pagamento para este orderId
    const idempotencyKey = `payment:create:${request.orderId}`;
    
    if (this.idempotencyService) {
      const isProcessed = await this.idempotencyService.isProcessed(idempotencyKey);
      if (isProcessed) {
        logger.warn('Payment creation already processed (idempotent)', { orderId: request.orderId });
        throw new Error('Payment already created for this order');
      }
    }

    try {
      if (request.method === 'pix') {
        throw new Error('Pix not supported by Stripe directly. Use Asaas or partner integration.');
      }

      const result = await this.createCardPayment(request);

      // Marca como processado
      if (this.idempotencyService) {
        await this.idempotencyService.markAsProcessed(idempotencyKey, 3600); // 1 hora
      }

      return result;
    } catch (error: any) {
      logger.error('Error creating Stripe payment', { error: error.message, request });
      throw error;
    }
  }

  private async createCardPayment(request: PaymentRequest): Promise<PaymentResponse> {
    const params = new URLSearchParams({
      'line_items[0][price_data][currency]': 'brl',
      'line_items[0][price_data][product_data][name]': request.description || `Pedido #${request.orderId}`,
      'line_items[0][price_data][unit_amount]': request.amount.toString(),
      'line_items[0][quantity]': '1',
      'payment_method_types[]': 'card',
    });

    if (request.splitConfig) {
      params.append('payment_intent_data[application_fee_amount]', request.splitConfig.platformFee.toString());
      params.append('transfer_data[destination]', request.splitConfig.restaurantWalletId);
    }

    // Idempotência nativa do Stripe: usa Idempotency-Key header
    const idempotencyKey = `order:${request.orderId}`;

    const response = await fetch('https://api.stripe.com/v1/payment_links', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Idempotency-Key': idempotencyKey, // ✅ Idempotência nativa
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.json() as any;
      throw new Error(error.message || 'Failed to create Stripe payment');
    }

    const data = await response.json() as any;

    return {
      paymentId: data.id,
      paymentLink: data.url,
      expiresAt: undefined,
      status: 'pending' as const,
    };
  }

  async getPaymentStatus(paymentId: string): Promise<PaymentStatus> {
    const response = await fetch(`https://api.stripe.com/v1/payment_links/${paymentId}`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error('Payment not found');
    }

    const data = await response.json() as any;
    return data.payment_status === 'paid' ? 'paid' : 'pending';
  }

  async confirmPayment(paymentId: string): Promise<PaymentConfirmation> {
    // Idempotência: verifica se paymentId já foi confirmado
    const idempotencyKey = `payment:confirm:${paymentId}`;
    
    if (this.idempotencyService) {
      const cachedResult = await this.idempotencyService.getResult<PaymentConfirmation>(idempotencyKey);
      if (cachedResult) {
        logger.info('Payment confirmation already processed (idempotent)', { paymentId });
        return cachedResult;
      }
    }

    const response = await fetch(`https://api.stripe.com/v1/payment_intents/${paymentId}`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error('Payment not found');
    }

    const data = await response.json() as any;

    if (data.status !== 'succeeded') {
      throw new Error(`Payment not confirmed. Status: ${data.status}`);
    }

    const confirmation: PaymentConfirmation = {
      paymentId: data.id,
      status: 'paid' as const,
      paidAt: new Date(data.created * 1000),
      amount: data.amount,
      platformFee: data.application_fee_amount,
      restaurantAmount: data.amount - (data.application_fee_amount || 0),
    };

    // Marca como processado DEPOIS de processar com sucesso (cache resultado)
    if (this.idempotencyService) {
      await this.idempotencyService.markAsProcessed(idempotencyKey, 86400, confirmation); // 24 horas
    }

    return confirmation;
  }

  async cancelPayment(paymentId: string): Promise<boolean> {
    try {
      const response = await fetch(`https://api.stripe.com/v1/payment_links/${paymentId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'active=false',
      });

      return response.ok;
    } catch (error: any) {
      logger.error('Error cancelling Stripe payment', { error: error.message, paymentId });
      return false;
    }
  }
}
