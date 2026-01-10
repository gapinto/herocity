# Implementação de Idempotência no Fluxo de Pagamento

## 📋 Resumo

Foi implementada idempotência completa em todo o fluxo do sistema, especialmente no fluxo de pagamento, para evitar duplicidade de processamento. As melhorias garantem que operações idempotentes possam ser executadas múltiplas vezes sem efeitos colaterais indesejados.

## ✅ Melhorias Implementadas

### 1. **Serviço de Idempotência (IIdempotencyService)**

- ✅ Interface expandida com método `getResult<T>()` para cachear resultados
- ✅ Implementação Redis (`RedisIdempotencyService`) com TTL configurável
- ✅ Implementação In-Memory (`InMemoryIdempotencyService`) para desenvolvimento/testes
- ✅ Factory pattern (`IdempotencyServiceFactory`) para escolher implementação via env var

**Novos métodos:**
- `getResult<T>(key)`: Obtém resultado armazenado de operação já processada
- `markAsProcessed(key, ttl?, result?)`: Permite armazenar resultado junto com a marcação

### 2. **Pagamentos (PaymentService)**

#### AsaasPaymentService:
- ✅ Idempotência nativa via header `idempotency-key` no Asaas API
- ✅ Verificação prévia antes de criar pagamento (`payment:create:${orderId}`)
- ✅ Cache de resultado em `confirmPayment` para evitar múltiplas chamadas à API
- ✅ Marcação DEPOIS de processar com sucesso

#### StripePaymentService:
- ✅ Idempotência nativa via header `Idempotency-Key` no Stripe API
- ✅ Verificação prévia antes de criar pagamento
- ✅ Cache de resultado em `confirmPayment`
- ✅ Marcação DEPOIS de processar com sucesso

### 3. **Webhooks de Pagamento**

#### Asaas Webhook (`/webhooks/asaas`):
- ✅ Idempotência por `eventId` (`webhook:asaas:${eventId}`)
- ✅ Idempotência adicional por `paymentId` (`payment:confirm:${paymentId}`)
- ✅ Verificação de status no banco ANTES de atualizar (evita race conditions)
- ✅ Marcação DEPOIS de processar com sucesso
- ✅ Retorna status 200 mesmo para duplicatas (best practice para webhooks)

#### Stripe Webhook (`/webhooks/stripe`):
- ✅ Idempotência por `eventId` (`webhook:stripe:${eventId}`)
- ✅ Idempotência adicional por `paymentId`
- ✅ Verificação de status no banco ANTES de atualizar
- ✅ Marcação DEPOIS de processar com sucesso

**Melhoria crítica:** Webhooks agora marcam como processado DEPOIS de confirmar pagamento, não antes. Isso evita:
- Marcar como processado mas falhar ao atualizar banco
- Perder eventos em caso de erro durante processamento

### 4. **Criação de Pedidos (CreateOrder)**

- ✅ Idempotência via chave única (`order:create:${idempotencyKey}`)
- ✅ Busca de pedido existente por chave idempotente
- ✅ Fallback: busca pedido DRAFT/AWAITING_PAYMENT para mesmo cliente/restaurante
- ✅ Armazenamento de `orderId` para retorno rápido em chamadas subsequentes
- ✅ Marcação DEPOIS de criar com sucesso

**Chave idempotente gerada em `CustomerOrdersHandler`:**
```typescript
const itemsHash = JSON.stringify(orderData.items.map(i => ({ id: i.menuItemId, qty: i.quantity })));
const idempotencyKey = `${data.customerId}:${orderData.restaurantId}:${Buffer.from(itemsHash).toString('base64').slice(0, 16)}`;
```

### 5. **Seleção de Método de Pagamento (handlePaymentMethodSelection)**

- ✅ Verificação se pedido já tem `paymentLink` ou `paymentMethod`
- ✅ Verificação se pedido já está em `AWAITING_PAYMENT`
- ✅ Verificação se pedido já tem `paymentId` (após gerar pagamento)
- ✅ Re-busca do pedido antes de salvar para evitar race conditions
- ✅ PaymentService já é idempotente (chave baseada em `orderId`)

### 6. **Mensagens (OrchestrationService)**

- ✅ Idempotência por `messageId` (`message:${messageId}`)
- ✅ Verificação antes de processar mensagem
- ✅ Marcação DEPOIS de processar com sucesso (no final do try block)
- ✅ Suporte opcional (WhatsApp geralmente garante delivery único)

### 7. **Banco de Dados**

- ✅ Campo `paymentId` com constraint `@unique` no schema Prisma
- ✅ `findByPaymentId` verifica se `paymentId` é null antes de buscar
- ✅ Uso de `findFirst` em vez de `findUnique` para maior compatibilidade

**Schema:**
```prisma
model Order {
  paymentId String? @unique  // ✅ Constraint única previne duplicatas
  // ...
}
```

## 🔒 Proteções em Múltiplas Camadas

O sistema agora tem proteções idempotentes em **4 camadas**:

1. **Cache/Redis** (IIdempotencyService): Verifica se operação já foi processada
2. **Gateway de Pagamento** (Asaas/Stripe): Idempotência nativa via headers
3. **Banco de Dados** (Prisma): Constraint única em `paymentId`
4. **Lógica de Negócio** (Entidades): Verificação de status antes de atualizar

## 📊 Fluxo de Pagamento com Idempotência

```
1. Cliente confirma pedido
   └─> CreateOrder verifica idempotência por chave única
   └─> Retorna pedido existente se já processado

2. Cliente escolhe método de pagamento
   └─> Verifica se já tem paymentLink/paymentId
   └─> PaymentService.createPayment verifica idempotência (Redis + Gateway)
   └─> Gateway retorna mesmo pagamento se chave idempotente já usada

3. Webhook de confirmação de pagamento
   └─> Verifica idempotência por eventId
   └─> Verifica idempotência por paymentId
   └─> Verifica status no banco (se já está PAID)
   └─> PaymentService.confirmPayment verifica idempotência (cache)
   └─> Atualiza pedido apenas se status ainda não é PAID
   └─> Marca como processado DEPOIS de sucesso
```

## ⚠️ Pontos de Atenção

### Race Conditions
- ✅ Webhooks marcam DEPOIS de processar, não antes
- ✅ Re-busca do pedido antes de atualizar para verificar status atual
- ✅ Constraint única no banco previne duplicatas mesmo em race conditions

### Retries e Timeouts
- ✅ Chaves idempotentes têm TTL configurável (padrão: 24 horas para pagamentos, 1 hora para pedidos)
- ✅ Resultados são cacheados para evitar múltiplas chamadas à API externa
- ✅ Webhooks retornam 200 mesmo para duplicatas (evita retries desnecessários)

### Falhas Parciais
- ✅ Se processo falhar após marcar como processado, chave expira automaticamente (TTL)
- ✅ Verificação de status no banco garante idempotência mesmo se cache expirar
- ✅ Logs detalhados para debug de casos edge

## 🧪 Como Testar

1. **Teste de Duplicidade de Pedido:**
   - Crie pedido com mesma chave idempotente 2x
   - Esperado: Retorna mesmo pedido na 2ª chamada

2. **Teste de Duplicidade de Pagamento:**
   - Gere link de pagamento 2x para mesmo pedido
   - Esperado: Retorna mesmo link na 2ª chamada

3. **Teste de Webhook Duplicado:**
   - Envie mesmo webhook 2x
   - Esperado: 1ª vez processa, 2ª vez retorna 200 com `duplicate: true`

4. **Teste de Race Condition:**
   - Envie webhooks simultâneos para mesmo paymentId
   - Esperado: Apenas 1 processa, outros retornam como duplicatas

## 📝 Variáveis de Ambiente

```env
# Storage de idempotência (redis ou memory)
ORDER_STATE_STORAGE=redis

# Redis (se usando redis)
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=
ORDER_STATE_TTL=3600

# Gateway de pagamento (determina qual usar)
PAYMENT_PROVIDER=asaas  # ou stripe

# Asaas
ASAAS_API_KEY=
ASAAS_PLATFORM_WALLET_ID=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_PLATFORM_ACCOUNT_ID=
```

## ✅ Melhorias Adicionais Implementadas (Revisão Final)

### 1. **updatePaymentInfo() - Melhorias de Idempotência**
   - ✅ Verifica se já tem `paymentId` antes de atualizar (evita sobrescrever com ID diferente)
   - ✅ Verifica se já tem `paymentLink` antes de atualizar (evita sobrescrever link)
   - ✅ Retorna silenciosamente se já está em `AWAITING_PAYMENT` ou `PAID` com mesmos dados
   - ✅ Agora aceita `paymentId` como parâmetro opcional para salvar imediatamente após criar pagamento

**Motivo**: Permite buscar order por `paymentId` no webhook ANTES de confirmar pagamento.

### 2. **confirmPayment() - Melhorias de Idempotência**
   - ✅ Verifica se já tem `paymentId` e se é o mesmo antes de confirmar
   - ✅ Retorna silenciosamente se já está `PAID` com mesmo `paymentId`
   - ✅ Atualiza status apenas se `paymentId` existe mas status não é `PAID` (recuperação)

### 3. **updateStatus() - Idempotência Adicionada**
   - ✅ Verifica se já está no status desejado antes de atualizar
   - ✅ Retorna silenciosamente se já está no status desejado (operação idempotente)

### 4. **cancel() - Idempotência Adicionada**
   - ✅ Verifica se já está cancelado antes de cancelar
   - ✅ Retorna silenciosamente se já está cancelado (operação idempotente)
   - ✅ Mensagem de erro mais clara para pedidos PAID (deve contatar restaurante)

### 5. **handleCancelOrder() - Correções**
   - ✅ Corrigido filtro: agora usa `canBeCancelled()` da entidade (só DRAFT ou AWAITING_PAYMENT)
   - ✅ Verifica se já está cancelado antes de tentar cancelar
   - ✅ Mensagem atualizada para refletir status corretos

### 6. **Salvamento de paymentId Imediato**
   - ✅ `paymentId` agora é salvo logo após criar pagamento (não apenas na confirmação)
   - ✅ Permite buscar order por `paymentId` no webhook mesmo antes de confirmar
   - ✅ Webhook pode encontrar order corretamente na primeira tentativa

## 🔒 Proteções Finais em Múltiplas Camadas

O sistema agora tem proteções idempotentes em **5 camadas**:

1. **Cache/Redis** (IIdempotencyService): Verifica se operação já foi processada
2. **Gateway de Pagamento** (Asaas/Stripe): Idempotência nativa via headers
3. **Banco de Dados** (Prisma): Constraint única em `paymentId` + verificação de status antes de atualizar
4. **Lógica de Negócio** (Entidades): Verificação de status/dados antes de atualizar (retorna silenciosamente se já processado)
5. **Handlers** (Application): Verificações adicionais antes de chamar métodos da entidade

## 📊 Fluxo de Pagamento com Idempotência Completa

```
1. Cliente confirma pedido
   └─> CreateOrder verifica idempotência por chave única
   └─> Retorna pedido existente se já processado

2. Cliente escolhe método de pagamento
   └─> Verifica se já tem paymentLink/paymentId/status AWAITING_PAYMENT
   └─> PaymentService.createPayment verifica idempotência (Redis + Gateway)
   └─> Salva paymentId IMEDIATAMENTE no order (para buscar no webhook)
   └─> Re-busca order antes de salvar (evita race condition)
   └─> Retorna link existente se já gerado

3. Webhook de confirmação de pagamento
   └─> Verifica idempotência por eventId
   └─> Verifica idempotência por paymentId (mais confiável)
   └─> Busca order por paymentId (agora funciona pois foi salvo antes!)
   └─> Verifica status no banco (se já está PAID)
   └─> PaymentService.confirmPayment verifica idempotência (cache)
   └─> Order.confirmPayment verifica idempotência (se já tem paymentId/status)
   └─> Atualiza apenas se status não é PAID
   └─> Marca como processado DEPOIS de sucesso
```

## ⚠️ Pontos Críticos Protegidos

### Race Conditions
- ✅ Webhooks marcam DEPOIS de processar, não antes
- ✅ Re-busca do order antes de atualizar para verificar status atual
- ✅ Constraint única no banco previne duplicatas mesmo em race conditions
- ✅ Verificações na entidade antes de atualizar (retorna se já processado)

### Operações Idempotentes
- ✅ `updatePaymentInfo()` - Retorna silenciosamente se dados são os mesmos
- ✅ `confirmPayment()` - Retorna silenciosamente se já está PAID com mesmo paymentId
- ✅ `updateStatus()` - Retorna silenciosamente se já está no status desejado
- ✅ `cancel()` - Retorna silenciosamente se já está cancelado

### Retries e Timeouts
- ✅ Chaves idempotentes têm TTL configurável (padrão: 24 horas para pagamentos, 1 hora para pedidos)
- ✅ Resultados são cacheados para evitar múltiplas chamadas à API externa
- ✅ Webhooks retornam 200 mesmo para duplicatas (evita retries desnecessários)

### Falhas Parciais
- ✅ Se processo falhar após marcar como processado, chave expira automaticamente (TTL)
- ✅ Verificação de status no banco garante idempotência mesmo se cache expirar
- ✅ Verificações na entidade garantem idempotência mesmo sem cache
- ✅ Logs detalhados para debug de casos edge

## 🔄 Próximos Passos (Opcional)

- [ ] Adicionar métricas de idempotência (quantas vezes evitou duplicatas)
- [ ] Dashboard para visualizar chaves idempotentes em uso
- [ ] Alertas para TTLs expirando em pagamentos críticos
- [ ] Suporte a idempotência distribuída via Redis Cluster
- [ ] Transações de banco de dados para operações críticas (se necessário)
