import { PaymentAccountServiceFactory } from '../../../../src/infrastructure/payment/PaymentAccountServiceFactory';
import { AsaasPaymentAccountService } from '../../../../src/infrastructure/payment/AsaasPaymentAccountService';

describe('PaymentAccountServiceFactory', () => {
  beforeEach(() => {
    delete process.env.PAYMENT_PROVIDER;
  });

  afterEach(() => {
    delete process.env.PAYMENT_PROVIDER;
  });

  it('should create AsaasPaymentAccountService by default', () => {
    const service = PaymentAccountServiceFactory.create();

    expect(service).toBeInstanceOf(AsaasPaymentAccountService);
  });

  it('should create AsaasPaymentAccountService when provider is asaas', () => {
    process.env.PAYMENT_PROVIDER = 'asaas';
    const service = PaymentAccountServiceFactory.create('asaas');

    expect(service).toBeInstanceOf(AsaasPaymentAccountService);
  });

  it('should fallback to Asaas when provider is stripe (not implemented)', () => {
    process.env.PAYMENT_PROVIDER = 'stripe';
    const service = PaymentAccountServiceFactory.create('stripe');

    // Stripe ainda não implementado, então deve fallback para Asaas
    expect(service).toBeInstanceOf(AsaasPaymentAccountService);
  });

  it('should fallback to Asaas when provider is unknown', () => {
    process.env.PAYMENT_PROVIDER = 'unknown';
    const service = PaymentAccountServiceFactory.create('unknown' as any);

    expect(service).toBeInstanceOf(AsaasPaymentAccountService);
  });
});
