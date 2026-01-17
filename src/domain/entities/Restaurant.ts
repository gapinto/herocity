import { Phone } from '../value-objects/Phone';
import { MenuRulesConfig } from '../types/MenuRules';
import { BankAccountData } from '../types/BankAccount';

export interface RestaurantProps {
  id?: string;
  name: string; // Nome fantasia (exibição)
  phone: Phone;
  address: string;
  postalCode: string;
  addressNumber: string;
  complement: string;
  province: string;
  city: string;
  state: string;
  isActive?: boolean;
  menuRules?: MenuRulesConfig;
  // Dados para criação de subconta no provedor de pagamento
  legalName?: string; // Razão social / Nome completo (PF)
  cpfCnpj?: string; // CPF (PF) ou CNPJ (PJ)
  email?: string; // E-mail para conta
  bankAccount?: BankAccountData; // Dados bancários
  documentUrl?: string; // URL do documento do responsável (upload)
  birthDate?: string; // Data de nascimento (YYYY-MM-DD)
  paymentAccountId?: string; // ID da subconta criada no provedor (ex: "acct_29384")
  paymentWalletId?: string; // ID da carteira (walletId) para split
  paymentWebhookUrl?: string; // URL do webhook da subconta
  paymentWebhookToken?: string; // Token de autenticação do webhook
  createdAt?: Date;
  updatedAt?: Date;
}

export class Restaurant {
  private id: string;
  private name: string; // Nome fantasia
  private phone: Phone;
  private address: string;
  private postalCode: string;
  private addressNumber: string;
  private complement: string;
  private province: string;
  private city: string;
  private state: string;
  private _isActive: boolean;
  private menuRules?: MenuRulesConfig;
  // Dados para criação de subconta no provedor de pagamento
  private legalName?: string; // Razão social / Nome completo (PF)
  private cpfCnpj?: string; // CPF (PF) ou CNPJ (PJ)
  private email?: string; // E-mail para conta
  private bankAccount?: BankAccountData; // Dados bancários
  private documentUrl?: string; // URL do documento do responsável
  private birthDate?: string; // Data de nascimento (YYYY-MM-DD)
  private paymentAccountId?: string; // ID da subconta criada no provedor
  private paymentWalletId?: string; // ID da carteira (walletId)
  private paymentWebhookUrl?: string; // URL do webhook da subconta
  private paymentWebhookToken?: string; // Token do webhook
  private createdAt: Date;
  private updatedAt: Date;

  private constructor(props: RestaurantProps) {
    this.id = props.id || '';
    this.name = props.name;
    this.phone = props.phone;
    this.address = props.address;
    this.postalCode = props.postalCode;
    this.addressNumber = props.addressNumber;
    this.complement = props.complement;
    this.province = props.province;
    this.city = props.city;
    this.state = props.state;
    this._isActive = props.isActive ?? true;
    this.menuRules = props.menuRules;
    this.legalName = props.legalName;
    this.cpfCnpj = props.cpfCnpj;
    this.email = props.email;
    this.bankAccount = props.bankAccount;
    this.documentUrl = props.documentUrl;
    this.birthDate = props.birthDate;
    this.paymentAccountId = props.paymentAccountId;
    this.paymentWalletId = props.paymentWalletId;
    this.paymentWebhookUrl = props.paymentWebhookUrl;
    this.paymentWebhookToken = props.paymentWebhookToken;
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
    props: Required<
      Omit<
        RestaurantProps,
        'legalName' | 'cpfCnpj' | 'email' | 'bankAccount' | 'documentUrl' | 'birthDate' | 'paymentAccountId' | 'paymentWalletId' | 'paymentWebhookUrl' | 'paymentWebhookToken' | 'menuRules'
      >
    > &
      Partial<
        Pick<RestaurantProps, 'legalName' | 'cpfCnpj' | 'email' | 'bankAccount' | 'documentUrl' | 'birthDate' | 'paymentAccountId' | 'paymentWalletId' | 'paymentWebhookUrl' | 'paymentWebhookToken' | 'menuRules'>
      >
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

  getAddress(): string {
    return this.address;
  }

  getPostalCode(): string {
    return this.postalCode;
  }

  getAddressNumber(): string {
    return this.addressNumber;
  }

  getComplement(): string {
    return this.complement;
  }

  getProvince(): string {
    return this.province;
  }

  getCity(): string {
    return this.city;
  }

  getState(): string {
    return this.state;
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

  getBirthDate(): string | undefined {
    return this.birthDate;
  }

  getPaymentAccountId(): string | undefined {
    return this.paymentAccountId;
  }

  getPaymentWalletId(): string | undefined {
    return this.paymentWalletId;
  }

  getPaymentWebhookUrl(): string | undefined {
    return this.paymentWebhookUrl;
  }

  getPaymentWebhookToken(): string | undefined {
    return this.paymentWebhookToken;
  }

  // Verifica se restaurante tem todos os dados necessários para criar subconta
  hasPaymentAccountData(): boolean {
    const hasAddressData = !!(
      this.address &&
      this.address.trim().length > 0 &&
      this.postalCode &&
      this.postalCode.trim().length > 0 &&
      this.addressNumber &&
      this.addressNumber.trim().length > 0 &&
      this.complement &&
      this.complement.trim().length > 0 &&
      this.province &&
      this.province.trim().length > 0 &&
      this.city &&
      this.city.trim().length > 0 &&
      this.state &&
      this.state.trim().length > 0
    );

    return !!(
      hasAddressData &&
      this.legalName &&
      this.cpfCnpj &&
      this.birthDate &&
      this.birthDate.trim().length > 0 &&
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

  setPaymentWalletId(walletId: string): void {
    this.paymentWalletId = walletId;
    this.updatedAt = new Date();
  }

  setPaymentWebhookConfig(webhookUrl: string, webhookToken: string): void {
    this.paymentWebhookUrl = webhookUrl;
    this.paymentWebhookToken = webhookToken;
    this.updatedAt = new Date();
  }

  // Atualiza dados de pagamento
  updatePaymentData(data: {
    legalName?: string;
    cpfCnpj?: string;
    email?: string;
    bankAccount?: BankAccountData;
    documentUrl?: string;
    birthDate?: string;
    paymentAccountId?: string;
    paymentWalletId?: string;
    paymentWebhookUrl?: string;
    paymentWebhookToken?: string;
    address?: string;
    postalCode?: string;
    addressNumber?: string;
    complement?: string;
    province?: string;
    city?: string;
    state?: string;
  }): void {
    if (data.legalName !== undefined) this.legalName = data.legalName;
    if (data.cpfCnpj !== undefined) this.cpfCnpj = data.cpfCnpj;
    if (data.email !== undefined) this.email = data.email;
    if (data.bankAccount !== undefined) this.bankAccount = data.bankAccount;
    if (data.documentUrl !== undefined) this.documentUrl = data.documentUrl;
    if (data.birthDate !== undefined) this.birthDate = data.birthDate;
    if (data.paymentAccountId !== undefined) this.paymentAccountId = data.paymentAccountId;
    if (data.paymentWalletId !== undefined) this.paymentWalletId = data.paymentWalletId;
    if (data.paymentWebhookUrl !== undefined) this.paymentWebhookUrl = data.paymentWebhookUrl;
    if (data.paymentWebhookToken !== undefined) this.paymentWebhookToken = data.paymentWebhookToken;
    if (data.address !== undefined) this.address = data.address;
    if (data.postalCode !== undefined) this.postalCode = data.postalCode;
    if (data.addressNumber !== undefined) this.addressNumber = data.addressNumber;
    if (data.complement !== undefined) this.complement = data.complement;
    if (data.province !== undefined) this.province = data.province;
    if (data.city !== undefined) this.city = data.city;
    if (data.state !== undefined) this.state = data.state;
    this.updatedAt = new Date();
  }
}

