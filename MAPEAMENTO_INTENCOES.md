# 🎯 Mapeamento de Intenções - HeroCity

## 📋 Como Funciona

O sistema identifica as intenções dos usuários usando **DeepSeek AI** através do `IntentService`. O fluxo é:

```
Mensagem do usuário
  ↓
OrchestrationService.parseWebhook()
  ↓
UserContextService.identify() → Identifica se é restaurante/cliente/novo
  ↓
IntentService.identify() → Usa DeepSeek AI para identificar intenção
  ↓
OrchestrationService.routeToHandler() → Roteia para handler apropriado
  ↓
Handler específico processa a ação
```

## 🔍 Identificação de Intenções

### DeepSeek AI

O `DeepSeekService` recebe:
- **Texto da mensagem** do usuário
- **Contexto do usuário** (RESTAURANT, CUSTOMER, NEW_USER)

E retorna:
- **Intent**: Uma das intenções do enum `Intent`
- **Confidence**: Nível de confiança (0.0-1.0)
- **Items** (opcional): Itens extraídos da mensagem
- **OrderId** (opcional): ID do pedido mencionado

### Prompt do DeepSeek

O sistema usa um prompt estruturado que lista todas as intenções possíveis:

```
INTENÇÕES DO CLIENTE:
- criar_pedido: criar novo pedido com item(s) - usuário escolhe restaurante manualmente
- criar_pedido_qr_code: criar pedido a partir de QR code na mesa (formato: "pedido:abc123")
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
- restaurant_onboarding: cadastrar novo restaurante
```

## 📱 QR Code na Mesa

### Como Funciona

Quando o cliente escaneia um QR code na mesa:

1. **QR Code contém**: `pedido:abc123` ou `restaurant:abc123`
2. **WhatsApp envia**: Mensagem com esse texto
3. **DeepSeek identifica**: `criar_pedido_qr_code`
4. **CustomerOrdersHandler**: Processa com `handleCreateOrderFromQRCode()`
5. **Sistema extrai**: ID do restaurante do texto
6. **Sistema valida**: Restaurante existe e está ativo
7. **Sistema pula**: Seleção de restaurante
8. **Sistema mostra**: Cardápio diretamente

### Formato do QR Code

**Recomendado:**
```
pedido:abc123
```

**Alternativas:**
```
restaurant:abc123
restaurante:abc123
```

### Exemplo de Fluxo

```
Cliente escaneia QR code
  → WhatsApp: "pedido:abc123"
  → DeepSeek: identifica "criar_pedido_qr_code"
  → Handler: extrai "abc123"
  → Handler: valida restaurante
  → Handler: mostra cardápio diretamente
  → Cliente: "adicionar 1 2"
  → Sistema: adiciona ao carrinho
  → Cliente: "finalizar"
  → Pedido criado!
```

## 🔄 Fluxo de Criação de Pedido

### Sem QR Code (Fluxo Manual)

```
Cliente: "quero fazer um pedido"
  → Intent: CRIAR_PEDIDO
  → Handler: lista restaurantes
  → Cliente: "1"
  → Handler: mostra cardápio
  → Cliente: "adicionar 1 2"
  → Handler: adiciona ao carrinho
  → Cliente: "finalizar"
  → Pedido criado
```

### Com QR Code (Fluxo Automático)

```
Cliente escaneia QR code: "pedido:abc123"
  → Intent: CRIAR_PEDIDO_QR_CODE
  → Handler: extrai "abc123"
  → Handler: valida restaurante
  → Handler: mostra cardápio diretamente (pula seleção)
  → Cliente: "adicionar 1 2"
  → Handler: adiciona ao carrinho
  → Cliente: "finalizar"
  → Pedido criado
```

## 🎯 Vantagens do QR Code

1. **UX Melhor**: Cliente não precisa escolher restaurante
2. **Mais Rápido**: Menos passos no fluxo
3. **Menos Erros**: Não há chance de escolher restaurante errado
4. **Experiência Moderna**: QR codes são familiares aos usuários
5. **Contexto Preservado**: Cliente já está na mesa do restaurante certo

## 📊 Estados de Criação de Pedido

O `OrderStateService` gerencia os estados:

```typescript
enum OrderCreationState {
  IDLE = 'IDLE',
  SELECTING_RESTAURANT = 'SELECTING_RESTAURANT',  // Pula com QR code
  VIEWING_MENU = 'VIEWING_MENU',                  // Vai direto aqui
  ADDING_ITEMS = 'ADDING_ITEMS',
  CONFIRMING_ORDER = 'CONFIRMING_ORDER',
}
```

## 🔐 Validações

Quando processa QR code:

1. ✅ Extrai ID do restaurante do texto
2. ✅ Valida que restaurante existe
3. ✅ Valida que restaurante está ativo
4. ✅ Valida que cliente está identificado
5. ✅ Mostra cardápio apenas se tudo estiver OK

## 📝 Exemplos de Mensagens

### QR Code Válido
```
pedido:abc123 → ✅ Identifica restaurante, mostra cardápio
```

### QR Code Inválido
```
pedido:invalid → ❌ "Restaurante não encontrado"
pedido:abc123 (restaurante inativo) → ❌ "Restaurante temporariamente fechado"
```

### Fallback
Se QR code falhar, cliente pode sempre usar:
```
"quero fazer um pedido" → Lista restaurantes manualmente
```

