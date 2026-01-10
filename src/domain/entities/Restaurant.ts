import { Phone } from '../value-objects/Phone';
import { MenuRulesConfig } from '../types/MenuRules';
import { BankAccountData } from '../types/BankAccount';

export interface RestaurantProps {
  id?: string;
  name: string; // Nome fantasia (exibição)
  phone: Phone;
  address?: string;
  isActive?: boolean;
  menuRules?: MenuRulesConfig;
  // Dados para criação de subconta no provedor de pagamento
  legalName?: string; // Razão social / Nome completo (PF)
  cpfCnpj?: string; // CPF (PF) ou CNPJ (PJ)
  email?: string; // E-mail para conta
  bankAccount?: BankAccountData; // Dados bancários
  documentUrl?: string; // URL do documento do responsável (upload)
  paymentAccountId?: string; // ID da subconta criada no provedor (ex: "acct_29384")
  createdAt?: Date;
  updatedAt?: Date;
}

export class Restaurant {
  private id: string;
  private name: string; // Nome fantasia
  private phone: Phone;
  private address?: string;
  private _isActive: boolean;
  private menuRules?: MenuRulesConfig;
  // Dados para criação de subconta no provedor de pagamento
  private legalName?: string; // Razão social / Nome completo (PF)
  private cpfCnpj?: string; // CPF (PF) ou CNPJ (PJ)
  private email?: string; // E-mail para conta
  private bankAccount?: BankAccountData; // Dados bancários
  private documentUrl?: string; // URL do documento do responsável
  private paymentAccountId?: string; // ID da subconta criada no provedor
  private createdAt: Date;
  private updatedAt: Date;

  private constructor(props: RestaurantProps) {
    this.id = props.id || '';
    this.name = props.name;
    this.phone = props.phone;
    this.address = props.address;
    this._isActive = props.isActive ?? true;
    this.menuRules = props.menuRules;
    this.legalName = props.legalName;
    this.cpfCnpj = props.cpfCnpj;
    this.email = props.email;
    this.bankAccount = props.bankAccount;
    this.documentUrl = props.documentUrl;
    this.paymentAccountId = props.paymentAccountId;
    this.createdAt = props.createdAt || new Date();
    this.updatedAt = props.updatedAt || new Date();
  }

  static create(props: RestaurantProps): Restaurant {
    if (!props.name || props.name.trim().length === 0) {
      throw new Error('Restaurant name cannot be empty');
    }

    return new Restaurant(props);
  }

  static fromPersistence(
    props: Required<Omit<RestaurantProps, 'address' | 'legalName' | 'cpfCnpj' | 'email' | 'bankAccount' | 'documentUrl' | 'paymentAccountId' | 'menuRules'>> & 
    Partial<Pick<RestaurantProps, 'address' | 'legalName' | 'cpfCnpj' | 'email' | 'bankAccount' | 'documentUrl' | 'paymentAccountId' | 'menuRules'>>
  ): Restaurant {
    return new Restaurant(props);
  }

  getId(): string {
    return this.id;
  }

  getName(): string {
    return this.name;
  }

  getPhone(): Phone {
    return this.phone;
  }

  getAddress(): string | undefined {
    return this.address;
  }

  isActive(): boolean {
    return this._isActive;
  }

  activate(): void {
    this._isActive = true;
    this.updatedAt = new Date();
  }

  deactivate(): void {
    this._isActive = false;
    this.updatedAt = new Date();
  }

  getCreatedAt(): Date {
    return this.createdAt;
  }

  getUpdatedAt(): Date {
    return this.updatedAt;
  }

  getMenuRules(): MenuRulesConfig | undefined {
    return this.menuRules;
  }

  // Dados para criação de subconta no provedor de pagamento
  getLegalName(): string | undefined {
    return this.legalName;
  }

  getCpfCnpj(): string | undefined {
    return this.cpfCnpj;
  }

  getEmail(): string | undefined {
    return this.email;
  }

  getBankAccount(): BankAccountData | undefined {
    return this.bankAccount;
  }

  getDocumentUrl(): string | undefined {
    return this.documentUrl;
  }

  getPaymentAccountId(): string | undefined {
    return this.paymentAccountId;
  }

  // Verifica se restaurante tem todos os dados necessários para criar subconta
  hasPaymentAccountData(): boolean {
    return !!(
      this.legalName &&
      this.cpfCnpj &&
      this.email &&
      this.bankAccount &&
      this.bankAccount.bankCode &&
      this.bankAccount.agency &&
      this.bankAccount.account &&
      this.bankAccount.accountDigit &&
      this.bankAccount.accountType &&
      this.bankAccount.accountHolderName
    );
  }

  // Atualiza paymentAccountId após criação de subconta
  setPaymentAccountId(accountId: string): void {
    this.paymentAccountId = accountId;
    this.updatedAt = new Date();
  }

  // Atualiza dados de pagamento
  updatePaymentData(data: {
    legalName?: string;
    cpfCnpj?: string;
    email?: string;
    bankAccount?: BankAccountData;
    documentUrl?: string;
  }): void {
    if (data.legalName !== undefined) this.legalName = data.legalName;
    if (data.cpfCnpj !== undefined) this.cpfCnpj = data.cpfCnpj;
    if (data.email !== undefined) this.email = data.email;
    if (data.bankAccount !== undefined) this.bankAccount = data.bankAccount;
    if (data.documentUrl !== undefined) this.documentUrl = data.documentUrl;
    this.updatedAt = new Date();
  }
}

