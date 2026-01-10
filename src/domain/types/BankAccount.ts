/**
 * Dados bancários para criação de subconta no provedor de pagamento
 */
export interface BankAccountData {
  bankCode: string; // Código do banco (ex: "001" para Banco do Brasil)
  agency: string; // Agência (sem dígito verificador)
  agencyDigit?: string; // Dígito verificador da agência (opcional)
  account: string; // Número da conta (sem dígito verificador)
  accountDigit: string; // Dígito verificador da conta
  accountType: 'CHECKING' | 'SAVINGS'; // Tipo de conta: Corrente ou Poupança
  accountHolderName: string; // Nome do titular da conta (deve ser igual ao CPF/CNPJ cadastrado)
}
