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
      const customerId = await this.resolveCustomerId(request);
      const resolvedRequest = { ...request, customerId };
      
      if (resolvedRequest.method === 'pix') {
        result = await this.createPixPayment(resolvedRequest);
      } else {
        result = await this.createCardPayment(resolvedRequest);
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

  private async resolveCustomerId(request: PaymentRequest): Promise<string> {
    if (request.customerId && request.customerId.startsWith('cus_')) {
      return request.customerId;
    }

    if (!request.customerPhone) {
      throw new Error('Customer phone is required for payment');
    }

    return this.getOrCreateCustomer({
      name: request.customerName,
      phone: request.customerPhone,
      email: request.customerEmail,
      cpfCnpj: request.customerCpfCnpj,
    });
  }

  private async getOrCreateCustomer(input: { name?: string; phone: string; email?: string; cpfCnpj?: string }): Promise<string> {
    const phone = input.phone.replace(/\D/g, '');
    const payload: any = {
      name: input.name?.trim() || `Cliente ${phone}`,
      phone,
      mobilePhone: phone,
      email: input.email,
      cpfCnpj: input.cpfCnpj,
    };

    Object.keys(payload).forEach((key) => {
      if (payload[key] === undefined) {
        delete payload[key];
      }
    });

    const response = await fetch(`${this.baseUrl}/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access_token': this.apiKey,
        'User-Agent': 'HeroCity/1.0',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let errorMessage = 'Failed to create customer';
      try {
        const errorData = await response.json() as any;
        errorMessage = errorData.errors?.[0]?.description || errorData.message || errorMessage;
      } catch (parseError) {
        errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      }

      if (this.isDuplicateCustomerError(errorMessage)) {
        const existing = await this.findCustomerByPhone(phone);
        if (existing) {
          return existing.id;
        }
      }

      logger.error('Asaas Pix payment request failed', { error: errorMessage, payload });
      throw new Error(errorMessage);
    }

    const data = await response.json() as any;
    return data.id;
  }

  private isDuplicateCustomerError(message: string): boolean {
    const normalized = message.toLowerCase();
    return normalized.includes('já está em uso') || normalized.includes('already registered');
  }

  private async findCustomerByPhone(phone: string): Promise<any | null> {
    try {
      const response = await fetch(`${this.baseUrl}/customers?phone=${phone}&limit=1`, {
        headers: {
          'access_token': this.apiKey,
          'User-Agent': 'HeroCity/1.0',
        },
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json() as any;
      const customer = data?.data?.[0];
      return customer || null;
    } catch (error: any) {
      logger.warn('Error fetching Asaas customer by phone', { error: error.message, phone });
      return null;
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
          walletId: request.splitConfig.restaurantWalletId,
          fixedValue: request.splitConfig.restaurantAmount / 100,
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
      let errorMessage = 'Failed to create Pix payment';
      const errorBody = await response.text();
      try {
        const error = JSON.parse(errorBody) as any;
        errorMessage = error.errors?.[0]?.description || error.message || errorMessage;
      } catch (parseError) {
        errorMessage = errorBody || `HTTP ${response.status}: ${response.statusText}`;
      }
      logger.error('Asaas card payment request failed', { error: errorMessage, payload });
      throw new Error(errorMessage);
    }

    const data = await response.json() as any;

    let qrCode: string | undefined;
    try {
      const qrCodeResponse = await fetch(`${this.baseUrl}/payments/${data.id}/pixQrCode`, {
        headers: {
          'access_token': this.apiKey,
        },
      });

      if (qrCodeResponse.ok) {
        const qrData = await qrCodeResponse.json() as any;
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
          walletId: request.splitConfig.restaurantWalletId,
          fixedValue: request.splitConfig.restaurantAmount / 100,
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
      let errorMessage = 'Failed to create card payment';
      const errorBody = await response.text();
      try {
        const error = JSON.parse(errorBody) as any;
        errorMessage = error.errors?.[0]?.description || error.message || errorMessage;
      } catch (parseError) {
        errorMessage = errorBody || `HTTP ${response.status}: ${response.statusText}`;
      }
      throw new Error(errorMessage);
    }

    const data = await response.json() as any;

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

      const data = await response.json() as any;
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

    const data = await response.json() as any;

    if (data.status !== 'CONFIRMED' && data.status !== 'RECEIVED') {
      throw new Error(`Payment not confirmed. Status: ${data.status}`);
    }

    let platformFee: number | undefined;
    let restaurantAmount: number | undefined;

    if (data.split) {
      const platformSplit = (data.split as any[]).find((s: any) => s.walletId === this.platformWalletId);
      const restaurantSplit = (data.split as any[]).find((s: any) => s.walletId !== this.platformWalletId);

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
