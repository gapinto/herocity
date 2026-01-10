import { BankAccountData } from '../types/BankAccount';

/**
 * Dados necessários para criar subconta no provedor de pagamento
 */
export interface CreatePaymentAccountInput {
  legalName: string; // Razão social / Nome completo (PF)
  cpfCnpj: string; // CPF (PF) ou CNPJ (PJ)
  email: string; // E-mail para conta
  phone: string; // Telefone de contato
  name: string; // Nome fantasia (exibição)
  bankAccount: BankAccountData; // Dados bancários
  documentUrl?: string; // URL do documento do responsável (upload)
}

/**
 * Resposta da criação de subconta
 */
export interface PaymentAccountResponse {
  accountId: string; // ID da subconta criada (ex: "acct_29384")
  status: 'pending' | 'approved' | 'rejected'; // Status da conta
  requiresAdditionalInfo?: boolean; // Se precisa de informações adicionais
}

/**
 * Serviço para gerenciar subcontas no provedor de pagamento
 * Permite criar subcontas para restaurantes no Asaas/Stripe
 */
export interface IPaymentAccountService {
  /**
   * Cria uma subconta no provedor de pagamento
   * @param input Dados do restaurante
   * @returns ID da subconta criada
   */
  createSubAccount(input: CreatePaymentAccountInput): Promise<PaymentAccountResponse>;

  /**
   * Obtém status da subconta
   * @param accountId ID da subconta
   * @returns Status atual da conta
   */
  getAccountStatus(accountId: string): Promise<'pending' | 'approved' | 'rejected'>;

  /**
   * Atualiza dados bancários da subconta
   * @param accountId ID da subconta
   * @param bankAccount Novos dados bancários
   * @param cpfCnpj CPF/CNPJ do titular (opcional, para validação)
   * @param isCnpj Se é CNPJ (opcional, para validação)
   */
  updateBankAccount(accountId: string, bankAccount: BankAccountData, cpfCnpj?: string, isCnpj?: boolean): Promise<boolean>;
}
