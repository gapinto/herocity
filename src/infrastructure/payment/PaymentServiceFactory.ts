import { IPaymentService } from '../../domain/services/IPaymentService';
import { IIdempotencyService } from '../../domain/services/IIdempotencyService';
import { AsaasPaymentService } from './AsaasPaymentService';
import { StripePaymentService } from './StripePaymentService';
import { logger } from '../../shared/utils/logger';

export type PaymentProvider = 'asaas' | 'stripe';

export class PaymentServiceFactory {
  static create(provider?: PaymentProvider, idempotencyService?: IIdempotencyService): IPaymentService {
    const selectedProvider = provider || (process.env.PAYMENT_PROVIDER as PaymentProvider) || 'asaas';

    switch (selectedProvider) {
      case 'asaas':
        logger.info('Using AsaasPaymentService');
        return new AsaasPaymentService(idempotencyService);

      case 'stripe':
        logger.info('Using StripePaymentService');
        return new StripePaymentService(idempotencyService);

      default:
        logger.warn(`Unknown payment provider: ${selectedProvider}. Falling back to Asaas.`);
        return new AsaasPaymentService(idempotencyService);
    }
  }
}
