import { IPaymentAccountService, CreatePaymentAccountInput, PaymentAccountResponse } from '../../domain/services/IPaymentAccountService';
import { BankAccountData } from '../../domain/types/BankAccount';
import { logger } from '../../shared/utils/logger';

export class AsaasPaymentAccountService implements IPaymentAccountService {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor() {
    this.apiKey = process.env.ASAAS_API_KEY || '';
    this.baseUrl = process.env.ASAAS_BASE_URL || 'https://api.asaas.com/v3';

    if (!this.apiKey) {
      logger.warn('AsaasPaymentAccountService: ASAAS_API_KEY not configured');
    }
  }

  async createSubAccount(input: CreatePaymentAccountInput): Promise<PaymentAccountResponse> {
    try {
      // Valida se é CPF ou CNPJ
      const isCnpj = input.cpfCnpj.replace(/\D/g, '').length === 14;
      const documentNumber = input.cpfCnpj.replace(/\D/g, '');

      // Prepara payload para Asaas
      const payload: any = {
        name: input.legalName || input.name,
        email: input.email,
        loginEmail: input.loginEmail || input.email,
        phone: input.phone.replace(/\D/g, ''),
        mobilePhone: input.phone.replace(/\D/g, ''),
        cpfCnpj: documentNumber,
        personType: isCnpj ? 'JURIDICA' : 'FISICA',
        companyType: isCnpj ? 'MEI' : undefined, // Pode ser MEI, EI, LTDA, etc. - assumindo MEI por padrão
        birthDate: input.birthDate,
        site: input.site,
        incomeValue: input.incomeValue,
        postalCode: input.postalCode,
        address: input.address,
        addressNumber: input.addressNumber,
        complement: input.complement,
        province: input.province,
        city: input.city,
        state: input.state,
      };

      if (input.bankAccount) {
        payload.bankAccount = {
          bank: input.bankAccount.bankCode,
          agency: input.bankAccount.agency,
          account: input.bankAccount.account,
          accountDigit: input.bankAccount.accountDigit,
          bankAccountType: input.bankAccount.accountType === 'SAVINGS' ? 'SAVINGS_ACCOUNT' : 'CHECKING_ACCOUNT',
          name: input.bankAccount.accountHolderName,
          cpfCnpj: documentNumber,
        };
      }

      if (input.webhookUrl && input.webhookAuthToken) {
        payload.webhooks = [
          {
            name: 'HeroCity Webhook',
            url: input.webhookUrl,
            email: input.email,
            enabled: true,
            interrupted: false,
            apiVersion: 3,
            authToken: input.webhookAuthToken,
            sendType: 'SEQUENTIALLY',
            events: input.webhookEvents || [
              'PAYMENT_CREATED',
              'PAYMENT_RECEIVED',
              'PAYMENT_CONFIRMED',
              'PAYMENT_OVERDUE',
              'PAYMENT_SPLIT_DIVERGENCE_BLOCK',
              'PAYMENT_SPLIT_DIVERGENCE_BLOCK_FINISHED',
            ],
          },
        ];
      }

      // Remove campos undefined
      Object.keys(payload).forEach((key) => {
        if (payload[key] === undefined) {
          delete payload[key];
        }
      });

      // Cria conta no Asaas (subconta)
      const response = await fetch(`${this.baseUrl}/accounts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'access_token': this.apiKey,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to create sub-account';
        try {
          const errorData = await response.json() as any;
          errorMessage = errorData.errors?.[0]?.description || errorData.message || errorMessage;
        } catch (parseError) {
          // Se não conseguir parsear JSON, usa mensagem padrão
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        logger.error('Error creating Asaas sub-account', { error: errorMessage, input });
        throw new Error(errorMessage);
      }

      const data = await response.json() as any;

      return {
        accountId: data.id,
        walletId: data.walletId,
        status: 'pending' as const, // Asaas geralmente aprova automaticamente, mas pode exigir verificação
        requiresAdditionalInfo: !data.postalCode || !data.address, // Se faltar endereço, precisa completar
      };
    } catch (error: any) {
      logger.error('Error creating Asaas sub-account', { error: error.message, input });
      throw new Error(`Failed to create sub-account: ${error.message}`);
    }
  }

  async getAccountStatus(accountId: string): Promise<'pending' | 'approved' | 'rejected'> {
    try {
      const response = await fetch(`${this.baseUrl}/accounts/${accountId}`, {
        headers: {
          'access_token': this.apiKey,
        },
      });

      if (!response.ok) {
        throw new Error('Account not found');
      }

      const data = await response.json() as any;

      // Asaas não retorna status explícito de aprovação
      // Assumimos que se existe e não tem erros, está aprovado
      if (data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
        return 'rejected';
      }

      return 'approved';
    } catch (error: any) {
      logger.error('Error getting Asaas account status', { error: error.message, accountId });
      return 'rejected';
    }
  }

  async updateBankAccount(accountId: string, bankAccount: BankAccountData, cpfCnpj?: string, isCnpj?: boolean): Promise<boolean> {
    try {
      // Asaas requer criar conta bancária separadamente
      const payload: any = {
        type: bankAccount.accountType === 'SAVINGS' ? 'CONTA_POUPANCA' : 'CONTA_CORRENTE',
        bank: bankAccount.bankCode,
        agency: bankAccount.agency,
        agencyDigit: bankAccount.agencyDigit || '',
        account: bankAccount.account,
        accountDigit: bankAccount.accountDigit,
        bankAccountHolderName: bankAccount.accountHolderName,
      };

      // Adiciona CPF/CNPJ do titular se fornecido
      if (cpfCnpj) {
        payload.bankAccountHolderCpfCnpj = cpfCnpj.replace(/\D/g, '');
        payload.bankAccountHolderType = isCnpj ? 'JURIDICA' : 'FISICA';
      }

      const response = await fetch(`${this.baseUrl}/accounts/${accountId}/bankAccounts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'access_token': this.apiKey,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to update bank account';
        try {
          const errorData = await response.json() as any;
          errorMessage = errorData.errors?.[0]?.description || errorData.message || errorMessage;
        } catch (parseError) {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        logger.error('Error updating Asaas bank account', { error: errorMessage, accountId, bankAccount });
        // Não lança erro, apenas retorna false (pode ser atualizado depois)
        return false;
      }

      return true;
    } catch (error: any) {
      logger.error('Error updating Asaas bank account', { error: error.message, accountId });
      return false;
    }
  }
}
