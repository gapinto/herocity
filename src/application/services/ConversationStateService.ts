import { BankAccountData } from '../../domain/types/BankAccount';

export enum OnboardingState {
  IDLE = 'IDLE',
  WAITING_NAME = 'WAITING_NAME', // Nome fantasia
  WAITING_ADDRESS = 'WAITING_ADDRESS',
  WAITING_PHONE = 'WAITING_PHONE',
  WAITING_LEGAL_NAME = 'WAITING_LEGAL_NAME', // Razão social / Nome completo (PF)
  WAITING_CPF_CNPJ = 'WAITING_CPF_CNPJ', // CPF (PF) ou CNPJ (PJ)
  WAITING_EMAIL = 'WAITING_EMAIL',
  WAITING_BANK_ACCOUNT = 'WAITING_BANK_ACCOUNT', // Dados bancários
  WAITING_DOCUMENT = 'WAITING_DOCUMENT', // Documento do responsável (opcional, pode pular)
  WAITING_KITCHEN_RULE = 'WAITING_KITCHEN_RULE', // Regra de notificar cozinha antes do pagamento
  CREATING_PAYMENT_ACCOUNT = 'CREATING_PAYMENT_ACCOUNT', // Criando subconta no provedor
  COMPLETED = 'COMPLETED',
}

export interface OnboardingData {
  state: OnboardingState;
  name?: string; // Nome fantasia
  address?: string;
  phone?: string;
  legalName?: string; // Razão social / Nome completo (PF)
  cpfCnpj?: string; // CPF (PF) ou CNPJ (PJ)
  email?: string;
  bankAccount?: BankAccountData;
  documentUrl?: string;
  allowKitchenNotifyBeforePayment?: boolean;
}

export class ConversationStateService {
  private conversations: Map<string, OnboardingData> = new Map();

  getConversation(phone: string): OnboardingData | undefined {
    return this.conversations.get(phone);
  }

  setConversation(phone: string, data: OnboardingData): void {
    this.conversations.set(phone, data);
  }

  clearConversation(phone: string): void {
    this.conversations.delete(phone);
  }

  startOnboarding(phone: string): void {
    this.conversations.set(phone, {
      state: OnboardingState.WAITING_NAME,
    });
  }

  updateState(phone: string, state: OnboardingState): void {
    const conversation = this.conversations.get(phone);
    if (conversation) {
      conversation.state = state;
      this.conversations.set(phone, conversation);
    }
  }

  updateData(phone: string, data: Partial<OnboardingData>): void {
    const conversation = this.conversations.get(phone);
    if (conversation) {
      Object.assign(conversation, data);
      this.conversations.set(phone, conversation);
    }
  }
}

