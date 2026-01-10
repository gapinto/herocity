import { ConversationStateService, OnboardingState } from '../../../../src/application/services/ConversationStateService';

describe('ConversationStateService', () => {
  let service: ConversationStateService;

  beforeEach(() => {
    service = new ConversationStateService();
  });

  it('should start onboarding', () => {
    service.startOnboarding('81999999999');
    const conversation = service.getConversation('81999999999');

    expect(conversation).toBeDefined();
    expect(conversation?.state).toBe(OnboardingState.WAITING_NAME);
  });

  it('should update state', () => {
    service.startOnboarding('81999999999');
    service.updateState('81999999999', OnboardingState.WAITING_ADDRESS);

    const conversation = service.getConversation('81999999999');
    expect(conversation?.state).toBe(OnboardingState.WAITING_ADDRESS);
  });

  it('should update data', () => {
    service.startOnboarding('81999999999');
    service.updateData('81999999999', { name: 'Restaurante Teste' });

    const conversation = service.getConversation('81999999999');
    expect(conversation?.name).toBe('Restaurante Teste');
  });

  it('should clear conversation', () => {
    service.startOnboarding('81999999999');
    service.clearConversation('81999999999');

    const conversation = service.getConversation('81999999999');
    expect(conversation).toBeUndefined();
  });
});

