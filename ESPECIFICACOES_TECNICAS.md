# 📐 Especificações Técnicas Detalhadas - HeroCity

## 1. 🛒 Criação de Pedidos - Especificação Completa

### 1.1. Requisitos Funcionais

**RF-001**: Cliente deve poder listar restaurantes disponíveis
- **Entrada**: Comando "quero fazer pedido" ou "criar pedido"
- **Processamento**: Buscar todos os restaurantes ativos
- **Saída**: Lista numerada de restaurantes

**RF-002**: Cliente deve poder selecionar restaurante
- **Entrada**: Número do restaurante (1, 2, 3...)
- **Processamento**: Validar seleção, buscar cardápio
- **Saída**: Cardápio formatado do restaurante

**RF-003**: Cliente deve poder visualizar cardápio
- **Entrada**: Após seleção de restaurante
- **Processamento**: Buscar itens disponíveis do restaurante
- **Saída**: Lista de itens com preços formatados

**RF-004**: Cliente deve poder adicionar itens ao pedido
- **Entrada**: "adicionar [quantidade] [nome do item]" ou "2 hambúrgueres"
- **Processamento**: 
  - Identificar item no cardápio
  - Validar disponibilidade
  - Adicionar ao carrinho
  - Calcular novo total
- **Saída**: Confirmação + total atualizado

**RF-005**: Cliente deve poder remover itens do pedido
- **Entrada**: "remover [número do item]" ou "remover 1"
- **Processamento**: Remover item do carrinho, recalcular total
- **Saída**: Confirmação + total atualizado

**RF-006**: Cliente deve poder finalizar pedido
- **Entrada**: "finalizar" ou "confirmar"
- **Processamento**:
  - Validar carrinho não vazio
  - Criar Order no banco
  - Criar OrderItems no banco
  - Notificar restaurante
- **Saída**: Confirmação com ID do pedido

### 1.2. Regras de Negócio

**RN-001**: Pedido só pode ser criado se restaurante estiver ativo
**RN-002**: Apenas itens disponíveis podem ser adicionados
**RN-003**: Quantidade mínima: 1, máxima: 99
**RN-004**: Pedido deve ter pelo menos 1 item
**RN-005**: Total deve ser calculado automaticamente
**RN-006**: Pedido criado com status PENDING

### 1.3. Modelo de Dados

```typescript
// OrderCreationData
{
  state: OrderCreationState;
  restaurantId?: string;
  items: Array<{
    menuItemId: string;
    menuItemName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
  total: number;
}

// Order (criado no banco)
{
  id: string;
  restaurantId: string;
  customerId: string;
  status: OrderStatus.PENDING;
  total: Price;
  createdAt: Date;
}

// OrderItem (criado no banco)
{
  id: string;
  orderId: string;
  menuItemId: string;
  quantity: number;
  price: Price;
  modifiers?: string;
}
```

### 1.4. Fluxo de Estados

```
IDLE
  ↓ (cliente: "quero fazer pedido")
SELECTING_RESTAURANT
  ↓ (cliente seleciona restaurante)
VIEWING_MENU
  ↓ (sistema mostra cardápio)
ADDING_ITEMS
  ↓ (cliente adiciona itens)
  ↓ (cliente: "finalizar")
CONFIRMING_ORDER
  ↓ (sistema cria pedido)
COMPLETED
```

### 1.5. Exemplo de Conversa

```
Cliente: quero fazer um pedido
Sistema: 🍽️ Escolha um restaurante:

1. Restaurante A
2. Restaurante B
3. Restaurante C

Digite o número do restaurante:

Cliente: 1
Sistema: 📋 Cardápio - Restaurante A:

1. ✅ Hambúrguer - R$ 25,00
2. ✅ Pizza - R$ 30,00
3. ✅ Refrigerante - R$ 5,00

Digite "adicionar [número] [quantidade]" ou "ver carrinho"

Cliente: adicionar 1 2
Sistema: ✅ 2x Hambúrguer adicionado!
Total: R$ 50,00

Cliente: adicionar 3 1
Sistema: ✅ 1x Refrigerante adicionado!
Total: R$ 55,00

Cliente: finalizar
Sistema: ✅ Pedido criado com sucesso!

Pedido #abc12345
Total: R$ 55,00
Status: ⏳ Pendente

Aguarde confirmação do restaurante.
```

---

## 2. 📦 Gestão de Cardápio - Especificação Completa

### 2.1. Adicionar Item ao Cardápio

**Fluxo**:
```
Restaurante: "adicionar item"
  → Sistema: "Digite o nome do item"
  → Restaurante: "Hambúrguer Artesanal"
  → Sistema: "Digite a descrição (ou 'pular')"
  → Restaurante: "Hambúrguer com queijo e bacon"
  → Sistema: "Digite o preço (ex: 25.50)"
  → Restaurante: "25.50"
  → Sistema: "✅ Item adicionado ao cardápio!"
```

**Validações**:
- Nome: mínimo 3 caracteres, máximo 100
- Descrição: máximo 500 caracteres (opcional)
- Preço: > 0, máximo 9999.99
- Nome único por restaurante

### 2.2. Editar Item

**Fluxo**:
```
Restaurante: "editar item"
  → Sistema: Lista itens numerados
  → Restaurante: "1"
  → Sistema: "O que deseja editar? 1-Nome, 2-Descrição, 3-Preço"
  → Restaurante: "3"
  → Sistema: "Digite o novo preço"
  → Restaurante: "30.00"
  → Sistema: "✅ Preço atualizado!"
```

### 2.3. Bloquear/Desbloquear Item

**Fluxo**:
```
Restaurante: "bloquear item"
  → Sistema: Lista itens disponíveis
  → Restaurante: "1"
  → Sistema: "✅ Item bloqueado (indisponível)"
```

---

## 3. 🔔 Sistema de Notificações - Especificação

### 3.1. Eventos de Notificação

| Evento | Destinatário | Quando | Template |
|--------|-------------|--------|----------|
| OrderCreated | Restaurante | Pedido criado | "📦 Novo pedido #ID - Total: R$ X" |
| OrderPaid | Restaurante | Cliente pagou | "💳 Pedido #ID foi pago" |
| OrderPreparing | Cliente | Restaurante iniciou preparo | "👨‍🍳 Pedido #ID em preparo" |
| OrderReady | Cliente | Pedido pronto | "✅ Pedido #ID pronto para retirada" |
| OrderCancelled | Ambos | Pedido cancelado | "❌ Pedido #ID cancelado" |

### 3.2. Implementação

```typescript
// NotificationService
class NotificationService {
  async notifyOrderCreated(order: Order): Promise<void> {
    const restaurant = await this.restaurantRepository.findById(
      order.getRestaurantId()
    );
    
    const message = this.formatOrderCreatedMessage(order);
    
    // Notifica todos os usuários do restaurante
    const users = await this.getRestaurantUsers(order.getRestaurantId());
    for (const user of users) {
      await this.evolutionApi.sendMessage({
        to: user.phone,
        text: message,
      });
    }
  }
  
  async notifyOrderStatusChanged(
    order: Order,
    newStatus: OrderStatus
  ): Promise<void> {
    const customer = await this.customerRepository.findById(
      order.getCustomerId()
    );
    
    const message = this.formatStatusChangedMessage(order, newStatus);
    
    await this.evolutionApi.sendMessage({
      to: customer.getPhone().getValue(),
      text: message,
    });
  }
}
```

---

## 4. 🧪 Estrutura de Testes Detalhada

### 4.1. Testes de Integração - Handlers

**Arquivo**: `tests/integration/handlers/CustomerOrdersHandler.test.ts`

```typescript
describe('CustomerOrdersHandler Integration', () => {
  let handler: CustomerOrdersHandler;
  let prisma: PrismaClient;
  let restaurant: Restaurant;
  let customer: Customer;
  let menuItem: MenuItem;

  beforeEach(async () => {
    prisma = new PrismaClient();
    // Setup: criar restaurante, cliente, item no banco
  });

  it('should create order with items', async () => {
    // Arrange
    const data: MessageData = {
      from: customer.getPhone().getValue(),
      text: 'quero fazer um pedido',
      customerId: customer.getId(),
    };

    // Act
    await handler.handle(Intent.CRIAR_PEDIDO, data);

    // Assert
    const orders = await prisma.order.findMany({
      where: { customerId: customer.getId() },
    });
    expect(orders.length).toBeGreaterThan(0);
  });
});
```

### 4.2. Testes E2E

**Arquivo**: `tests/e2e/webhook-flow.test.ts`

```typescript
describe('Webhook Flow E2E', () => {
  it('should handle complete order creation flow', async () => {
    // 1. Cliente envia "quero fazer pedido"
    // 2. Sistema lista restaurantes
    // 3. Cliente seleciona restaurante
    // 4. Sistema mostra cardápio
    // 5. Cliente adiciona itens
    // 6. Cliente finaliza
    // 7. Verifica pedido criado no banco
    // 8. Verifica notificação ao restaurante
  });
});
```

---

## 5. 📊 Modelo de Dados Expandido

### 5.1. OrderItem Entity

```typescript
export class OrderItem {
  private id: string;
  private orderId: string;
  private menuItemId: string;
  private quantity: number;
  private price: Price;
  private modifiers?: string; // JSON: {"sem_cebola": true, "bacon_extra": true}

  static create(props: {
    orderId: string;
    menuItemId: string;
    quantity: number;
    price: Price;
    modifiers?: string;
  }): OrderItem {
    if (props.quantity < 1 || props.quantity > 99) {
      throw new Error('Quantity must be between 1 and 99');
    }
    // ...
  }

  getSubtotal(): Price {
    return this.price.multiply(this.quantity);
  }
}
```

### 5.2. CreateOrder Use Case

```typescript
export class CreateOrder {
  async execute(input: CreateOrderInput): Promise<Order> {
    // 1. Validar restaurante existe e está ativo
    const restaurant = await this.restaurantRepository.findById(
      input.restaurantId
    );
    if (!restaurant || !restaurant.isActive()) {
      throw new Error('Restaurant not found or inactive');
    }

    // 2. Validar itens existem e estão disponíveis
    for (const item of input.items) {
      const menuItem = await this.menuItemRepository.findById(
        item.menuItemId
      );
      if (!menuItem || !menuItem.isAvailable()) {
        throw new Error(`Item ${item.menuItemId} not available`);
      }
    }

    // 3. Calcular total
    let total = Price.create(0);
    for (const item of input.items) {
      const menuItem = await this.menuItemRepository.findById(
        item.menuItemId
      );
      const itemTotal = menuItem.getPrice().multiply(item.quantity);
      total = total.add(itemTotal);
    }

    // 4. Criar Order
    const order = Order.create({
      restaurantId: input.restaurantId,
      customerId: input.customerId,
      total,
      status: OrderStatus.PENDING,
    });

    const savedOrder = await this.orderRepository.save(order);

    // 5. Criar OrderItems
    for (const item of input.items) {
      const menuItem = await this.menuItemRepository.findById(
        item.menuItemId
      );
      const orderItem = OrderItem.create({
        orderId: savedOrder.getId(),
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        price: menuItem.getPrice(),
        modifiers: item.modifiers,
      });
      await this.orderItemRepository.save(orderItem);
    }

    return savedOrder;
  }
}
```

---

## 6. 🔍 Validações Detalhadas

### 6.1. OrderValidator

```typescript
export class OrderValidator {
  static validateCreateOrder(input: CreateOrderInput): ValidationResult {
    const errors: string[] = [];

    // Validar restaurante
    if (!input.restaurantId) {
      errors.push('Restaurant ID is required');
    }

    // Validar itens
    if (!input.items || input.items.length === 0) {
      errors.push('Order must have at least one item');
    }

    // Validar cada item
    input.items?.forEach((item, index) => {
      if (!item.menuItemId) {
        errors.push(`Item ${index + 1}: Menu item ID is required`);
      }
      if (!item.quantity || item.quantity < 1) {
        errors.push(`Item ${index + 1}: Quantity must be at least 1`);
      }
      if (item.quantity > 99) {
        errors.push(`Item ${index + 1}: Quantity cannot exceed 99`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
```

### 6.2. MenuItemValidator

```typescript
export class MenuItemValidator {
  static validateCreate(input: CreateMenuItemInput): ValidationResult {
    const errors: string[] = [];

    if (!input.name || input.name.trim().length < 3) {
      errors.push('Name must have at least 3 characters');
    }

    if (input.name && input.name.length > 100) {
      errors.push('Name cannot exceed 100 characters');
    }

    if (input.description && input.description.length > 500) {
      errors.push('Description cannot exceed 500 characters');
    }

    if (!input.price || input.price <= 0) {
      errors.push('Price must be greater than 0');
    }

    if (input.price && input.price > 9999.99) {
      errors.push('Price cannot exceed 9999.99');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
```

---

## 7. 📱 Templates de Mensagens

### 7.1. MessageTemplates Service

```typescript
export class MessageTemplates {
  static orderCreated(orderId: string, total: string): string {
    return `✅ Pedido criado com sucesso!

Pedido #${orderId.slice(0, 8)}
Total: ${total}

Aguarde confirmação do restaurante.`;
  }

  static orderPreparing(orderId: string): string {
    return `👨‍🍳 Seu pedido #${orderId.slice(0, 8)} está sendo preparado!

Em breve estará pronto.`;
  }

  static orderReady(orderId: string): string {
    return `✅ Seu pedido #${orderId.slice(0, 8)} está pronto para retirada!

Obrigado pela preferência! 🎉`;
  }

  static newOrderForRestaurant(
    orderId: string,
    total: string,
    itemsCount: number
  ): string {
    return `📦 Novo pedido recebido!

Pedido #${orderId.slice(0, 8)}
${itemsCount} item(ns)
Total: ${total}

Use "marcar preparo" para iniciar.`;
  }

  static menuFormatted(items: MenuItem[]): string {
    if (items.length === 0) {
      return '📋 Cardápio vazio.';
    }

    const itemsList = items
      .map((item, index) => {
        const status = item.isAvailable() ? '✅' : '❌';
        return `${index + 1}. ${status} ${item.getName()} - ${item.getPrice().getFormatted()}`;
      })
      .join('\n');

    return `📋 Cardápio:\n\n${itemsList}\n\nDigite "adicionar [número] [quantidade]" para adicionar ao pedido.`;
  }
}
```

---

## 8. 🎯 Critérios de Aceitação

### 8.1. Criação de Pedidos

- [ ] Cliente consegue listar restaurantes
- [ ] Cliente consegue selecionar restaurante
- [ ] Cliente consegue ver cardápio
- [ ] Cliente consegue adicionar itens
- [ ] Cliente consegue remover itens
- [ ] Cliente consegue finalizar pedido
- [ ] Pedido é criado no banco corretamente
- [ ] Restaurante é notificado
- [ ] Total é calculado corretamente
- [ ] Validações funcionam (item indisponível, etc)

### 8.2. Gestão de Cardápio

- [ ] Restaurante consegue adicionar item
- [ ] Restaurante consegue editar item
- [ ] Restaurante consegue bloquear item
- [ ] Restaurante consegue desbloquear item
- [ ] Validações funcionam (preço, nome, etc)
- [ ] Item aparece no cardápio após criação

### 8.3. Notificações

- [ ] Cliente recebe notificação quando pedido está pronto
- [ ] Restaurante recebe notificação de novo pedido
- [ ] Mensagens são formatadas corretamente
- [ ] Notificações são enviadas em tempo real

---

## 9. 🔧 Configurações e Variáveis

### 9.1. Variáveis de Ambiente Adicionais

```env
# Notificações
ENABLE_NOTIFICATIONS=true
NOTIFICATION_DELAY_MS=1000

# Validações
MIN_ORDER_AMOUNT=10.00
MAX_ORDER_AMOUNT=1000.00
MAX_ITEMS_PER_ORDER=20

# Timeouts
ORDER_CREATION_TIMEOUT_MS=300000  # 5 minutos
ONBOARDING_TIMEOUT_MS=600000      # 10 minutos
```

### 9.2. Configurações de Rate Limiting

```typescript
// Limitar mensagens por minuto
const RATE_LIMIT = {
  messagesPerMinute: 10,
  ordersPerHour: 5,
};
```

---

## 10. 📈 Métricas e KPIs

### 10.1. Métricas a Rastrear

- Pedidos criados por dia
- Taxa de conversão (mensagens → pedidos)
- Tempo médio de criação de pedido
- Taxa de cancelamento
- Itens mais pedidos
- Restaurantes mais ativos
- Tempo médio de resposta do sistema

### 10.2. Implementação

```typescript
export class MetricsCollector {
  private metrics: Map<string, Metric> = new Map();

  recordOrderCreated(orderId: string, restaurantId: string): void {
    this.increment('orders.created');
    this.increment(`restaurant.${restaurantId}.orders`);
    this.recordTimestamp('order.created', orderId);
  }

  recordOrderCompleted(orderId: string, duration: number): void {
    this.recordDuration('order.completion_time', duration);
  }
}
```

---

## 📝 Notas de Implementação

1. **Sempre seguir TDD**: Escrever testes antes da implementação
2. **Manter Clean Architecture**: Não misturar camadas
3. **Documentar decisões**: Comentar escolhas importantes
4. **Validar inputs**: Sempre validar dados de entrada
5. **Tratar erros**: Mensagens amigáveis para o usuário
6. **Logar ações**: Registrar operações importantes
7. **Testar edge cases**: Itens esgotados, restaurante inativo, etc

