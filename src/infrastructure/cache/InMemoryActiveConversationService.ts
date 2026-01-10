import { IActiveConversationService } from '../../domain/services/IActiveConversationService';

/**
 * Implementação in-memory de IActiveConversationService
 * Usada para desenvolvimento local e testes
 */
export class InMemoryActiveConversationService implements IActiveConversationService {
  private activeConversations: Map<string, number> = new Map(); // phone -> timestamp
  private readonly ttl = 30 * 60 * 1000; // 30 minutos de inatividade

  async hasActiveConversation(phone: string): Promise<boolean> {
    const timestamp = this.activeConversations.get(phone);
    if (!timestamp) {
      return false;
    }

    // Verifica se não expirou
    if (Date.now() - timestamp > this.ttl) {
      this.activeConversations.delete(phone);
      return false;
    }

    return true;
  }

  async markAsActive(phone: string): Promise<void> {
    this.activeConversations.set(phone, Date.now());
  }

  async clear(phone: string): Promise<void> {
    this.activeConversations.delete(phone);
  }

  async cleanup(): Promise<void> {
    const now = Date.now();
    for (const [phone, timestamp] of this.activeConversations.entries()) {
      if (now - timestamp > this.ttl) {
        this.activeConversations.delete(phone);
      }
    }
  }
}