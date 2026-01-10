import { IPaymentAccountService } from '../../domain/services/IPaymentAccountService';
import { AsaasPaymentAccountService } from './AsaasPaymentAccountService';
import { logger } from '../../shared/utils/logger';

export type PaymentAccountProvider = 'asaas' | 'stripe';

export class PaymentAccountServiceFactory {
  static create(provider?: PaymentAccountProvider): IPaymentAccountService {
    const selectedProvider = provider || (process.env.PAYMENT_PROVIDER as PaymentAccountProvider) || 'asaas';

    switch (selectedProvider) {
      case 'asaas':
        logger.info('Using AsaasPaymentAccountService');
        return new AsaasPaymentAccountService();

      case 'stripe':
        // TODO: Implementar StripePaymentAccountService quando necessário
        logger.warn('StripePaymentAccountService not yet implemented. Falling back to Asaas.');
        return new AsaasPaymentAccountService();

      default:
        logger.warn(`Unknown payment account provider: ${selectedProvider}. Falling back to Asaas.`);
        return new AsaasPaymentAccountService();
    }
  }
}
