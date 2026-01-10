import axios, { AxiosInstance } from 'axios';
import { env } from '../../shared/utils/env';
import { logger } from '../../shared/utils/logger';
import { Intent } from '../../domain/enums/Intent';
import { UserContext } from '../../domain/enums/UserContext';
import { MenuRulesConfig } from '../../domain/types/MenuRules';

export interface IntentResult {
  intent: Intent;
  confidence: number;
  items?: Array<{
    name: string;
    quantity: number;
    category?: string;
    modifiers?: string[];
  }>;
  validation?: {
    isValid: boolean;
    isComplete: boolean;
    missingRequired: string[];
    warnings: string[];
    errors: string[];
  };
  orderId?: string;
}

export class DeepSeekService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: 'https://api.deepseek.com',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
      },
    });
  }

  async identifyIntent(
    text: string,
    userContext: UserContext,
    menuItems?: Array<{ name: string; price: string }>,
    menuRules?: MenuRulesConfig
  ): Promise<IntentResult> {
    try {
      let systemPrompt = `Você é um assistente especializado em processar pedidos de restaurante.

FUNÇÃO:
1. Analise a mensagem do cliente
2. Extraia os itens mencionados
3. Valide conforme as regras fornecidas (se houver)
4. Retorne estrutura completa do pedido com validação

INTENÇÕES DO CLIENTE:
- criar_pedido: criar novo pedido com item(s) - usuário escolhe restaurante manualmente
- criar_pedido_qr_code: criar pedido a partir de QR code na mesa (formato: "pedido:abc123" ou "restaurant:abc123")
- adicionar_item: adicionar mais itens a pedido existente
- remover_item: remover itens de pedido antes do preparo
- alterar_item: modificar quantidade ou ingredientes antes do preparo
- consultar_status_pedido: saber status (pending, paid, preparing, ready)
- cancelar_pedido: cancelar pedido antes do preparo
- solicitar_ajuda: quando não consegue processar ou há problema

INTENÇÕES DO RESTAURANTE:
- atualizar_estoque: marcar itens como disponíveis/esgotados
- marcar_pedido_preparo: iniciar preparo de pedido pago
- marcar_pedido_pronto: notificar que pedido está pronto
- consultar_pedidos_pendentes: listar pedidos não preparados
- notificar_cliente: enviar mensagens de status manualmente
- bloquear_item_cardapio: desabilitar item temporariamente
- desbloquear_item_cardapio: habilitar item novamente
- restaurant_onboarding: cadastrar novo restaurante (quando usuário digita "1", "opção 1", "cadastrar restaurante", "quero cadastrar meu restaurante", etc.)

IMPORTANTE:
- Se o usuário for NEW_USER e digitar apenas "1" ou "opção 1", identifique como "restaurant_onboarding"
- Se o usuário for NEW_USER e digitar "2" ou "opção 2" ou "fazer pedido", identifique como "criar_pedido"

FORMATO DE RESPOSTA (JSON):
{
  "intent": "criar_pedido_qr_code",
  "confidence": 0.95,
  "items": [
    {
      "name": "Nome do item",
      "quantity": 1,
      "category": "protein|side|drink|other"
    }
  ],
  "validation": {
    "isValid": true,
    "isComplete": true,
    "missingRequired": [],
    "warnings": [],
    "errors": []
  },
  "order_id": "se mencionado"
}`;

      // Se tiver cardápio, adiciona ao prompt
      if (menuItems && menuItems.length > 0) {
        const menuText = menuItems
          .map((item, index) => `${index + 1}. ${item.name} - ${item.price}`)
          .join('\n');

        systemPrompt += `\n\nCARDÁPIO DISPONÍVEL:\n${menuText}\n\nIMPORTANTE: Se o usuário mencionar itens do cardápio na mensagem, extraia-os no campo "items" como array de objetos com "name" (nome EXATO ou similar do cardápio), "quantity" (número) e "category" (se identificável: protein, side, drink, other). Use os nomes do cardápio acima como referência.`;
      }

      // Se tiver regras, adiciona ao prompt
      if (menuRules) {
        systemPrompt += `\n\nREGRAS DO RESTAURANTE:\n${JSON.stringify(menuRules, null, 2)}\n\nIMPORTANTE SOBRE VALIDAÇÃO:
- Aplique TODAS as regras fornecidas
- Valide se o pedido está completo conforme as regras
- Se faltar item obrigatório (required/requiredItem), marque em "missingRequired" e "isComplete": false
- Se exceder limite (maxQuantity), marque em "warnings" mas "isValid": true
- Se violar regra crítica (minTotal não atingido), marque em "errors" e "isValid": false
- Se tudo estiver OK, "isValid": true, "isComplete": true
- Use as categorias fornecidas nas regras para classificar os itens`;
      } else {
        systemPrompt += `\n\nREGRAS: Nenhuma regra especial. Comportamento padrão (itens simples). Validação sempre válida e completa.`;
      }

      systemPrompt += `\n\nUse temperature 0.0 para precisão.`;

      const response = await this.client.post('/chat/completions', {
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Contexto: ${userContext}\nMensagem: ${text}` },
        ],
        temperature: 0.0,
        stream: false,
        response_format: { type: 'json_object' },
      });

      const content = response.data.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('No content in DeepSeek response');
      }

      const parsed = JSON.parse(content);

      return {
        intent: parsed.intent as Intent,
        confidence: parsed.confidence || 0.0,
        items: parsed.items,
        validation: parsed.validation,
        orderId: parsed.order_id,
      };
    } catch (error: any) {
      logger.error('Error identifying intent with DeepSeek', {
        error: error.message,
        text,
      });

      // Fallback para ajuda se der erro
      return {
        intent: Intent.SOLICITAR_AJUDA,
        confidence: 0.0,
      };
    }
  }
}

