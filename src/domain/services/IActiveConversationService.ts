/**
 * Interface para gerenciar conversas ativas
 * Usado para permitir que mensagens sem "hero" sejam processadas
 * após o usuário ter iniciado uma conversa
 */
export interface IActiveConversationService {
  /**
   * Verifica se o usuário tem uma conversa ativa
   */
  hasActiveConversation(phone: string): Promise<boolean>;

  /**
   * Marca uma conversa como ativa
   */
  markAsActive(phone: string): Promise<void>;

  /**
   * Remove uma conversa ativa (quando finalizada)
   */
  clear(phone: string): Promise<void>;

  /**
   * Limpa conversas expiradas (opcional, pode ser chamado periodicamente)
   */
  cleanup(): Promise<void>;
}