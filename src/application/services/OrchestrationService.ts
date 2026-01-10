import { UserContextService } from './UserContextService';
import { IntentService } from './IntentService';
import { EvolutionApiService } from '../../infrastructure/messaging/EvolutionApiService';
import { Phone } from '../../domain/value-objects/Phone';
import { UserContext } from '../../domain/enums/UserContext';
import { Intent } from '../../domain/enums/Intent';
import { IntentResult } from '../../infrastructure/ai/DeepSeekService';
import { RestaurantOnboardingHandler } from '../handlers/RestaurantOnboardingHandler';
import { RestaurantManagementHandler } from '../handlers/RestaurantManagementHandler';
import { CustomerOrdersHandler } from '../handlers/CustomerOrdersHandler';
import { IIdempotencyService } from '../../domain/services/IIdempotencyService';
import { IActiveConversationService } from '../../domain/services/IActiveConversationService';
import { metricsService } from './MetricsService';
import { structuredLogger } from '../../shared/utils/structuredLogger';
import { logger } from '../../shared/utils/logger';

export interface EvolutionWebhook {
  event?: string;
  data?: {
    key?: {
      remoteJid?: string;
      fromMe?: boolean;
      pushName?: string;
      id?: string;
    };
    message?: {
      conversation?: string;
      extendedTextMessage?: {
        text?: string;
      };
      imageMessage?: {
        url?: string;
        caption?: string;
      };
    };
  };
  body?: {
    data?: any;
    sender?: string;
    messageId?: string;
    key?: {
      id?: string;
    };
  };
}

export interface MessageData {
  from: string;
  text: string;
  pushName?: string;
  mediaUrl?: string;
  userContext: UserContext;
  restaurantId?: string;
  customerId?: string;
  intent?: Intent;
  intentResult?: IntentResult; // NOVO: resultado completo do DeepSeek com items extraídos
}

export class OrchestrationService {
  constructor(
    private readonly userContextService: UserContextService,
    private readonly intentService: IntentService,
    private readonly evolutionApi: EvolutionApiService,
    private readonly restaurantOnboardingHandler: RestaurantOnboardingHandler,
    private readonly restaurantManagementHandler: RestaurantManagementHandler,
    private readonly customerOrdersHandler: CustomerOrdersHandler,
    private readonly activeConversationService: IActiveConversationService,
    private readonly idempotencyService?: IIdempotencyService
  ) {}

  async handleWebhook(webhook: EvolutionWebhook): Promise<void> {
    try {
      // Parse webhook
      const parsed = this.parseWebhook(webhook);
      if (!parsed) {
        return;
      }

      const { from, text, pushName, mediaUrl, messageId } = parsed;

      // Ignora mensagens sem texto
      if (!text || text.trim().length === 0) {
        return;
      }

      // FILTRO: Responde apenas mensagens que contenham "hero" OU se já tiver conversa ativa
      // Isso permite iniciar o fluxo com "hero" mas continuar sem precisar repetir
      const hasHero = text.toLowerCase().includes('hero');
      const hasActiveConversation = await this.activeConversationService.hasActiveConversation(from);

      // Retorna imediatamente se não passar no filtro
      if (!hasHero && !hasActiveConversation) {
        logger.info('Message filtered out (does not contain "hero" and no active conversation)', { 
          from, 
          text: text.substring(0, 50) 
        });
        return;
      }

      // Se contém "hero", marca conversa como ativa
      if (hasHero) {
        await this.activeConversationService.markAsActive(from);
      }

      // Idempotência: verifica se mensagem já foi processada
      // Nota: Esta verificação é opcional, pois o WhatsApp geralmente garante delivery único
      // Mas é importante para webhooks externos e retries
      if (messageId && this.idempotencyService) {
        const idempotencyKey = `message:${messageId}`;
        const isProcessed = await this.idempotencyService.isProcessed(idempotencyKey);
        if (isProcessed) {
          logger.info('Message already processed (idempotent)', { messageId, from });
          return;
        }
      }

      // Métricas: mensagem recebida
      metricsService.recordMessageReceived('received');

      // NOVO: Detecta QR code ANTES de identificar contexto
      let restaurantIdFromQR: string | undefined;
      const qrMatch = text.match(/(?:pedido|restaurant|restaurante)[:\s]+([a-zA-Z0-9]+)/i);
      if (qrMatch && qrMatch[1]) {
        restaurantIdFromQR = qrMatch[1];
      }

      // Identifica contexto do usuário
      const phone = Phone.create(from);
      metricsService.startTimer('user_context_identification');
      const userContextResult = await this.userContextService.identify(phone);
      metricsService.endTimer('user_context_identification');

      // Validação: garante que userContextResult não seja undefined
      if (!userContextResult) {
        logger.error('UserContextService.identify returned undefined', { from });
        throw new Error('Failed to identify user context');
      }

      // Remove "hero" do texto para processar apenas a parte relevante
      // Isso permite filtrar mensagens mas não interfere na identificação de intenção
      // Se o texto ficar vazio após remover "hero", usa o texto original
      let cleanedText = text.replace(/hero/gi, '').trim();
      if (!cleanedText) {
        cleanedText = text; // Se só tinha "hero", mantém o texto original
      }

      // IMPORTANTE: Verifica se há conversa de onboarding ativa ANTES de identificar intenção
      // Se houver, roteia diretamente para onboarding (mesmo que intenção seja SOLICITAR_AJUDA)
      // Isso evita enviar boas-vindas durante o processo de onboarding
      const hasActiveOnboarding = await this.restaurantOnboardingHandler.hasActiveConversation(from);
      if (hasActiveOnboarding) {
        // Roteia diretamente para onboarding, ignorando identificação de intenção
        const messageData: MessageData = {
          from,
          text: cleanedText,
          pushName,
          mediaUrl,
          userContext: userContextResult.type,
          restaurantId: restaurantIdFromQR || userContextResult.restaurantId,
          customerId: userContextResult.customerId,
          intent: Intent.RESTAURANT_ONBOARDING,
        };
        await this.restaurantOnboardingHandler.handle(messageData);
        // Idempotência: marca mensagem como processada
        if (messageId && this.idempotencyService) {
          const idempotencyKey = `message:${messageId}`;
          await this.idempotencyService.markAsProcessed(idempotencyKey, 86400);
        }
        return;
      }

      // Identifica intenção PRIMEIRO (antes de decidir se envia boas-vindas)
      // Isso permite processar opções como "1" mesmo sendo NEW_USER
      metricsService.startTimer('intent_identification');
      const intentResult = await this.intentService.identify(
        cleanedText,
        userContextResult.type,
        restaurantIdFromQR || userContextResult.restaurantId
      );
      metricsService.endTimer('intent_identification');
      metricsService.recordIntentIdentified(intentResult.intent);

      // Se for novo usuário e não houver intenção clara, envia mensagem de boas-vindas
      // Mas se identificar intenção (ex: "1" = RESTAURANT_ONBOARDING), processa diretamente
      if (userContextResult.type === UserContext.NEW_USER && intentResult.intent === Intent.SOLICITAR_AJUDA) {
        await this.sendWelcomeMessage(from, pushName);
        // Idempotência: marca mensagem como processada
        if (messageId && this.idempotencyService) {
          const idempotencyKey = `message:${messageId}`;
          await this.idempotencyService.markAsProcessed(idempotencyKey, 86400);
        }
        return;
      }

      // Log estruturado
      structuredLogger.info('Intent identified', {
        intent: intentResult.intent,
        confidence: intentResult.confidence,
        userContext: userContextResult.type,
        from,
      });

      // Prepara dados da mensagem (usando texto limpo, sem "hero")
      const messageData: MessageData = {
        from,
        text: cleanedText,
        pushName,
        mediaUrl,
        userContext: userContextResult.type,
        restaurantId: restaurantIdFromQR || userContextResult.restaurantId,
        customerId: userContextResult.customerId,
        intent: intentResult.intent,
        intentResult, // NOVO: passa resultado completo com items extraídos
      };

      // Roteia para handler apropriado
      await this.routeToHandler(intentResult.intent, messageData);

      // Idempotência: marca mensagem como processada DEPOIS de processar com sucesso
      if (messageId && this.idempotencyService) {
        const idempotencyKey = `message:${messageId}`;
        await this.idempotencyService.markAsProcessed(idempotencyKey, 86400); // 24 horas
      }
    } catch (error: any) {
      logger.error('Error handling webhook', { error: error.message });
      throw error;
    }
  }

  private parseWebhook(webhook: EvolutionWebhook): {
    from: string;
    text: string;
    pushName?: string;
    mediaUrl?: string;
    messageId?: string;
  } | null {
    const data = webhook.body?.data || webhook.data;

    if (!data?.key || !data.message) {
      return null;
    }

    if (data.key.fromMe === true) {
      return null; // Ignora mensagens próprias
    }

    const remoteJid = data.key?.remoteJid || webhook.body?.sender || '';
    const from = remoteJid
      .replace('@s.whatsapp.net', '')
      .replace('@c.us', '')
      .replace('@g.us', '');
    
    // Extrai messageId para idempotência
    const messageId = data.key?.id || webhook.body?.key?.id || webhook.body?.messageId;

    const message = data.message || {};
    const text =
      message.conversation ||
      message.extendedTextMessage?.text ||
      message.imageMessage?.caption ||
      '';

    const mediaUrl = message.imageMessage?.url;

    return {
      from,
      text,
      pushName: data.key?.pushName,
      mediaUrl,
      messageId,
    };
  }

  private async sendWelcomeMessage(from: string, pushName?: string): Promise<void> {
    const name = pushName || 'usuário';
    const message = `👋 Olá ${name}! Bem-vindo ao HeroCity! 🎉

Identificamos que esta é sua primeira vez aqui. Como podemos ajudar você hoje?

📋 Escolha uma opção:
1️⃣ **Cadastrar meu restaurante** - Para restaurantes que querem receber pedidos
2️⃣ **Fazer um pedido** - Para clientes que querem pedir comida

Digite o número da opção ou escreva sua escolha! 😊`;

    await this.evolutionApi.sendMessage({
      to: from,
      text: message,
    });
  }

  private async routeToHandler(intent: Intent, data: MessageData): Promise<void> {
    switch (intent) {
      case Intent.RESTAURANT_ONBOARDING:
        await this.restaurantOnboardingHandler.handle(data);
        break;

      case Intent.CADASTRAR_ITEM_CARDAPIO:
      case Intent.ATUALIZAR_ESTOQUE:
      case Intent.MARCAR_PEDIDO_PREPARO:
      case Intent.MARCAR_PEDIDO_PRONTO:
      case Intent.CONSULTAR_PEDIDOS_PENDENTES:
      case Intent.NOTIFICAR_CLIENTE:
      case Intent.BLOQUEAR_ITEM_CARDAPIO:
      case Intent.DESBLOQUEAR_ITEM_CARDAPIO:
        await this.restaurantManagementHandler.handle(intent, data);
        break;

      case Intent.CRIAR_PEDIDO:
      case Intent.CRIAR_PEDIDO_QR_CODE:
      case Intent.ADICIONAR_ITEM:
      case Intent.REMOVER_ITEM:
      case Intent.ALTERAR_ITEM:
      case Intent.CONSULTAR_STATUS_PEDIDO:
      case Intent.CANCELAR_PEDIDO:
        await this.customerOrdersHandler.handle(intent, data);
        break;

      case Intent.SOLICITAR_AJUDA:
      default:
        await this.sendHelpMessage(data.from);
        break;
    }
  }

  private async sendHelpMessage(from: string): Promise<void> {
    const message = `👋 Olá! Como posso ajudar?

📋 COMANDOS DO CLIENTE:
• Criar pedido
• Adicionar item
• Remover item
• Alterar item
• Status do pedido
• Cancelar pedido
• Ajuda

🍽️ COMANDOS DO RESTAURANTE:
• Atualizar estoque
• Marcar pedido em preparo
• Marcar pedido pronto
• Consultar pedidos pendentes
• Notificar cliente
• Bloquear/Desbloquear item

Digite o comando desejado!`;

    await this.evolutionApi.sendMessage({
      to: from,
      text: message,
    });
  }
}

