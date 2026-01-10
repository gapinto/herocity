import { IConversationStateService } from '../../domain/services/IConversationStateService';
import { OnboardingState, OnboardingData } from '../../application/services/ConversationStateService';

/**
 * Implementação in-memory de IConversationStateService
 * Usada para desenvolvimento local e testes
 */
export class InMemoryConversationStateService implements IConversationStateService {
  private conversations: Map<string, OnboardingData> = new Map();

  async getConversation(phone: string): Promise<OnboardingData | undefined> {
    return this.conversations.get(phone);
  }

  async setConversation(phone: string, data: OnboardingData): Promise<void> {
    this.conversations.set(phone, data);
  }

  async clearConversation(phone: string): Promise<void> {
    this.conversations.delete(phone);
  }

  async startOnboarding(phone: string): Promise<void> {
    this.conversations.set(phone, {
      state: OnboardingState.WAITING_NAME,
    });
  }

  async updateState(phone: string, state: OnboardingState): Promise<void> {
    const conversation = this.conversations.get(phone);
    if (conversation) {
      conversation.state = state;
      this.conversations.set(phone, conversation);
    }
  }

  async updateData(phone: string, data: Partial<OnboardingData>): Promise<void> {
    const conversation = this.conversations.get(phone);
    if (conversation) {
      Object.assign(conversation, data);
      this.conversations.set(phone, conversation);
    }
  }
}