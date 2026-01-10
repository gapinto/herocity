import { OnboardingState, OnboardingData } from '../../application/services/ConversationStateService';

/**
 * Interface para gerenciar o estado de conversas multi-etapa
 * Especialmente usado para onboarding de restaurantes
 */
export interface IConversationStateService {
  /**
   * Obtém os dados da conversa de um telefone
   */
  getConversation(phone: string): Promise<OnboardingData | undefined>;

  /**
   * Define ou atualiza os dados da conversa
   */
  setConversation(phone: string, data: OnboardingData): Promise<void>;

  /**
   * Remove uma conversa (quando cancelada ou completada)
   */
  clearConversation(phone: string): Promise<void>;

  /**
   * Inicia o processo de onboarding
   */
  startOnboarding(phone: string): Promise<void>;

  /**
   * Atualiza apenas o estado da conversa
   */
  updateState(phone: string, state: OnboardingState): Promise<void>;

  /**
   * Atualiza dados parciais da conversa
   */
  updateData(phone: string, data: Partial<OnboardingData>): Promise<void>;
}