/**
 * Serviço para rastrear conversas ativas
 * Usado para permitir que mensagens sem "hero" sejam processadas
 * após o usuário ter iniciado uma conversa (digitado "hero" uma vez)
 */
export class ActiveConversationService {
  private activeConversations: Map<string, number> = new Map(); // phone -> timestamp
  private readonly ttl = 30 * 60 * 1000; // 30 minutos de inatividade

  /**
   * Verifica se o usuário tem uma conversa ativa
   */
  hasActiveConversation(phone: string): boolean {
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

  /**
   * Marca uma conversa como ativa
   */
  markAsActive(phone: string): void {
    this.activeConversations.set(phone, Date.now());
  }

  /**
   * Remove uma conversa ativa (quando finalizada)
   */
  clear(phone: string): void {
    this.activeConversations.delete(phone);
  }

  /**
   * Limpa conversas expiradas
   */
  cleanup(): void {
    const now = Date.now();
    for (const [phone, timestamp] of this.activeConversations.entries()) {
      if (now - timestamp > this.ttl) {
        this.activeConversations.delete(phone);
      }
    }
  }
}
