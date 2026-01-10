import { IPaymentService, PaymentRequest, PaymentResponse, PaymentConfirmation, PaymentStatus } from '../../domain/services/IPaymentService';
import { IIdempotencyService } from '../../domain/services/IIdempotencyService';
import { logger } from '../../shared/utils/logger';

export class AsaasPaymentService implements IPaymentService {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly platformWalletId: string;

  constructor(private readonly idempotencyService?: IIdempotencyService) {
    this.apiKey = process.env.ASAAS_API_KEY || '';
    this.baseUrl = process.env.ASAAS_BASE_URL || 'https://api.asaas.com/v3';
    this.platformWalletId = process.env.ASAAS_PLATFORM_WALLET_ID || '';

    if (!this.apiKey) {
      logger.warn('AsaasPaymentService: ASAAS_API_KEY not configured');
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
      let result: PaymentResponse;
      
      if (request.method === 'pix') {
        result = await this.createPixPayment(request);
      } else {
        result = await this.createCardPayment(request);
      }

      // Marca como processado
      if (this.idempotencyService) {
        await this.idempotencyService.markAsProcessed(idempotencyKey, 3600); // 1 hora
      }

      return result;
    } catch (error: any) {
      logger.error('Error creating Asaas payment', { error: error.message, request });
      throw new Error(`Failed to create payment: ${error.message}`);
    }
  }

  private async createPixPayment(request: PaymentRequest): Promise<PaymentResponse> {
    const payload: any = {
      customer: request.customerId,
      billingType: 'PIX',
      value: request.amount / 100,
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      description: request.description || `Pedido #${request.orderId}`,
    };

    if (request.splitConfig) {
      payload.split = [
        {
          walletId: this.platformWalletId,
          fixedValue: request.splitConfig.platformFee / 100,
        },
        {
          walletId: request.splitConfig.restaurantId,
          totalValue: request.splitConfig.restaurantAmount / 100,
        },
      ];
    }

    // Idempotência nativa do Asaas: usa orderId como chave idempotente
    const idempotencyKey = `order:${request.orderId}`;

    const response = await fetch(`${this.baseUrl}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access_token': this.apiKey,
        'idempotency-key': idempotencyKey, // ✅ Idempotência nativa
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create Pix payment');
    }

    const data = await response.json();

    let qrCode: string | undefined;
    try {
      const qrCodeResponse = await fetch(`${this.baseUrl}/payments/${data.id}/pixQrCode`, {
        headers: {
          'access_token': this.apiKey,
        },
      });

      if (qrCodeResponse.ok) {
        const qrData = await qrCodeResponse.json();
        qrCode = qrData.encodedImage || qrData.payload;
      }
    } catch (error: any) {
      logger.warn('Error fetching Pix QR Code', { error: error.message, paymentId: data.id });
    }

    return {
      paymentId: data.id,
      paymentLink: data.invoiceUrl || data.bankSlipUrl,
      qrCode,
      expiresAt: data.dueDate ? new Date(data.dueDate) : undefined,
      status: this.mapAsaasStatus(data.status),
    };
  }

  private async createCardPayment(request: PaymentRequest): Promise<PaymentResponse> {
    const payload: any = {
      customer: request.customerId,
      billingType: 'CREDIT_CARD',
      value: request.amount / 100,
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      description: request.description || `Pedido #${request.orderId}`,
    };

    if (request.splitConfig) {
      payload.split = [
        {
          walletId: this.platformWalletId,
          fixedValue: request.splitConfig.platformFee / 100,
        },
        {
          walletId: request.splitConfig.restaurantId,
          totalValue: request.splitConfig.restaurantAmount / 100,
        },
      ];
    }

    // Idempotência nativa do Asaas: usa orderId como chave idempotente
    const idempotencyKey = `order:${request.orderId}`;

    const response = await fetch(`${this.baseUrl}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access_token': this.apiKey,
        'idempotency-key': idempotencyKey, // ✅ Idempotência nativa
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create card payment');
    }

    const data = await response.json();

    return {
      paymentId: data.id,
      paymentLink: data.invoiceUrl || `https://www.asaas.com/c/${data.id}`,
      expiresAt: data.dueDate ? new Date(data.dueDate) : undefined,
      status: this.mapAsaasStatus(data.status),
    };
  }

  async getPaymentStatus(paymentId: string): Promise<PaymentStatus> {
    try {
      const response = await fetch(`${this.baseUrl}/payments/${paymentId}`, {
        headers: {
          'access_token': this.apiKey,
        },
      });

      if (!response.ok) {
        throw new Error('Payment not found');
      }

      const data = await response.json();
      return this.mapAsaasStatus(data.status);
    } catch (error: any) {
      logger.error('Error getting Asaas payment status', { error: error.message, paymentId });
      throw error;
    }
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

    const response = await fetch(`${this.baseUrl}/payments/${paymentId}`, {
      headers: {
        'access_token': this.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error('Payment not found');
    }

    const data = await response.json();

    if (data.status !== 'CONFIRMED' && data.status !== 'RECEIVED') {
      throw new Error(`Payment not confirmed. Status: ${data.status}`);
    }

    let platformFee: number | undefined;
    let restaurantAmount: number | undefined;

    if (data.split) {
      const platformSplit = data.split.find((s: any) => s.walletId === this.platformWalletId);
      const restaurantSplit = data.split.find((s: any) => s.walletId !== this.platformWalletId);

      platformFee = platformSplit ? platformSplit.value * 100 : undefined;
      restaurantAmount = restaurantSplit ? restaurantSplit.value * 100 : undefined;
    }

    const confirmation: PaymentConfirmation = {
      paymentId: data.id,
      status: 'paid',
      paidAt: new Date(data.confirmationDate || data.dateCreated),
      amount: data.value * 100,
      platformFee,
      restaurantAmount,
    };

    // Marca como processado DEPOIS de processar com sucesso (cache resultado)
    if (this.idempotencyService) {
      await this.idempotencyService.markAsProcessed(idempotencyKey, 86400, confirmation); // 24 horas
    }

    return confirmation;
  }

  async cancelPayment(paymentId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/payments/${paymentId}`, {
        method: 'DELETE',
        headers: {
          'access_token': this.apiKey,
        },
      });

      return response.ok;
    } catch (error: any) {
      logger.error('Error cancelling Asaas payment', { error: error.message, paymentId });
      return false;
    }
  }

  private mapAsaasStatus(status: string): PaymentStatus {
    const statusMap: Record<string, PaymentStatus> = {
      'PENDING': 'pending',
      'CONFIRMED': 'paid',
      'RECEIVED': 'paid',
      'OVERDUE': 'failed',
      'REFUNDED': 'cancelled',
      'CANCELLED': 'cancelled',
    };

    return statusMap[status] || 'pending';
  }
}
