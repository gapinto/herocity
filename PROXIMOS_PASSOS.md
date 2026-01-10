# 📋 Próximos Passos Detalhados - HeroCity

## 🎯 Visão Geral

Este documento detalha os próximos passos de implementação do HeroCity, com especificações técnicas, exemplos de código e plano de execução.

---

## 1. 🛒 Implementar Criação de Pedidos Completa

### 1.1. Especificação

**Objetivo**: Permitir que clientes criem pedidos completos via WhatsApp, selecionando restaurante, visualizando cardápio e adicionando itens.

### 1.2. Fluxo Proposto

```
Cliente: "quero fazer um pedido"
  → Sistema lista restaurantes disponíveis
  → Cliente escolhe restaurante
  → Sistema mostra cardápio
  → Cliente adiciona itens (quantidade)
  → Sistema calcula total
  → Cliente confirma pedido
  → Sistema cria pedido no banco
  → Sistema notifica restaurante
```

### 1.3. Implementação Técnica

#### 1.3.1. Criar OrderStateService

**Arquivo**: `src/application/services/OrderStateService.ts`

```typescript
export enum OrderCreationState {
  IDLE = 'IDLE',
  SELECTING_RESTAURANT = 'SELECTING_RESTAURANT',
  VIEWING_MENU = 'VIEWING_MENU',
  ADDING_ITEMS = 'ADDING_ITEMS',
  CONFIRMING_ORDER = 'CONFIRMING_ORDER',
}

export interface OrderCreationData {
  state: OrderCreationState;
  restaurantId?: string;
  items: Array<{
    menuItemId: string;
    quantity: number;
    price: number;
  }>;
  total?: number;
}
```

**Responsabilidades**:
- Gerenciar estado de criação de pedido
- Armazenar itens temporários
- Calcular total

#### 1.3.2. Expandir CustomerOrdersHandler

**Métodos a implementar**:

1. **`handleCreateOrder()`** - Completo
   - Lista restaurantes disponíveis
   - Permite seleção
   - Inicia fluxo de criação

2. **`handleSelectRestaurant()`** - Novo
   - Recebe número do restaurante
   - Valida seleção
   - Mostra cardápio

3. **`handleViewMenu()`** - Novo
   - Lista itens disponíveis
   - Formata com preços
   - Permite adicionar itens

4. **`handleAddItem()`** - Novo
   - Recebe item e quantidade
   - Adiciona ao carrinho
   - Atualiza total
   - Permite continuar ou finalizar

5. **`handleConfirmOrder()`** - Novo
   - Valida dados
   - Cria pedido no banco
   - Cria order_items
   - Notifica restaurante
   - Confirma para cliente

#### 1.3.3. Criar Use Case: CreateOrder

**Arquivo**: `src/domain/usecases/CreateOrder.ts`

```typescript
export interface CreateOrderInput {
  restaurantId: string;
  customerId: string;
  items: Array<{
    menuItemId: string;
    quantity: number;
    modifiers?: string;
  }>;
}

export class CreateOrder {
  constructor(
    private readonly orderRepository: IOrderRepository,
    private readonly menuItemRepository: IMenuItemRepository
  ) {}

  async execute(input: CreateOrderInput): Promise<Order> {
    // Validações
    // Calcula total
    // Cria order e order_items
    // Retorna order criado
  }
}
```

#### 1.3.4. Criar OrderItem Entity

**Arquivo**: `src/domain/entities/OrderItem.ts`

```typescript
export class OrderItem {
  private id: string;
  private orderId: string;
  private menuItemId: string;
  private quantity: number;
  private price: Price;
  private modifiers?: string;

  // Métodos: create, fromPersistence, etc.
}
```

### 1.4. Testes a Criar

- `tests/unit/application/services/OrderStateService.test.ts`
- `tests/unit/domain/usecases/CreateOrder.test.ts`
- `tests/unit/domain/entities/OrderItem.test.ts`
- `tests/integration/handlers/CustomerOrdersHandler.test.ts`

### 1.5. Ordem de Implementação

1. Criar `OrderItem` entity (TDD)
2. Criar `CreateOrder` use case (TDD)
3. Criar `OrderStateService` (TDD)
4. Implementar métodos no `CustomerOrdersHandler`
5. Integrar com `OrchestrationService`
6. Testes de integração

---

## 2. 📦 Implementar Gestão Completa de Cardápio

### 2.1. Especificação

**Objetivo**: Permitir que restaurantes gerenciem seu cardápio via WhatsApp (adicionar, editar, bloquear/desbloquear itens).

### 2.2. Funcionalidades

1. **Adicionar Item ao Cardápio**
   - Nome do item
   - Descrição (opcional)
   - Preço
   - Disponibilidade inicial

2. **Editar Item**
   - Alterar nome
   - Alterar descrição
   - Alterar preço
   - Alterar disponibilidade

3. **Bloquear/Desbloquear Item**
   - Marcar como indisponível
   - Marcar como disponível

4. **Listar Cardápio Completo**
   - Todos os itens
   - Status de disponibilidade
   - Preços formatados

### 2.3. Implementação Técnica

#### 2.3.1. Criar Use Cases

**Arquivo**: `src/domain/usecases/CreateMenuItem.ts`

```typescript
export interface CreateMenuItemInput {
  restaurantId: string;
  name: string;
  description?: string;
  price: number;
  isAvailable?: boolean;
}

export class CreateMenuItem {
  constructor(
    private readonly menuItemRepository: IMenuItemRepository,
    private readonly restaurantRepository: IRestaurantRepository
  ) {}

  async execute(input: CreateMenuItemInput): Promise<MenuItem> {
    // Valida restaurante existe
    // Valida preço > 0
    // Cria menu item
    // Salva no banco
  }
}
```

**Arquivo**: `src/domain/usecases/UpdateMenuItem.ts`

```typescript
export interface UpdateMenuItemInput {
  id: string;
  name?: string;
  description?: string;
  price?: number;
  isAvailable?: boolean;
}

export class UpdateMenuItem {
  constructor(private readonly menuItemRepository: IMenuItemRepository) {}

  async execute(input: UpdateMenuItemInput): Promise<MenuItem> {
    // Busca item
    // Atualiza campos
    // Salva
  }
}
```

#### 2.3.2. Expandir RestaurantManagementHandler

**Novos métodos**:

1. **`handleAddMenuItem()`**
   - Fluxo de cadastro de item
   - State machine similar ao onboarding
   - Estados: WAITING_NAME → WAITING_DESCRIPTION → WAITING_PRICE

2. **`handleEditMenuItem()`**
   - Lista itens
   - Permite seleção
   - Permite edição de campos

3. **`handleBlockItem()`** - Completar
   - Recebe ID do item
   - Marca como indisponível
   - Confirma ação

4. **`handleUnblockItem()`** - Completar
   - Recebe ID do item
   - Marca como disponível
   - Confirma ação

#### 2.3.3. Criar MenuItemStateService

**Arquivo**: `src/application/services/MenuItemStateService.ts`

```typescript
export enum MenuItemCreationState {
  IDLE = 'IDLE',
  WAITING_NAME = 'WAITING_NAME',
  WAITING_DESCRIPTION = 'WAITING_DESCRIPTION',
  WAITING_PRICE = 'WAITING_PRICE',
}

export interface MenuItemCreationData {
  state: MenuItemCreationState;
  name?: string;
  description?: string;
  price?: number;
}
```

### 2.4. Testes a Criar

- `tests/unit/domain/usecases/CreateMenuItem.test.ts`
- `tests/unit/domain/usecases/UpdateMenuItem.test.ts`
- `tests/unit/application/services/MenuItemStateService.test.ts`

### 2.5. Ordem de Implementação

1. Criar use cases (TDD)
2. Criar MenuItemStateService (TDD)
3. Implementar métodos no handler
4. Testes de integração

---

## 3. 🔔 Implementar Sistema de Notificações

### 3.1. Especificação

**Objetivo**: Notificar automaticamente clientes e restaurantes sobre mudanças de status de pedidos.

### 3.2. Cenários de Notificação

#### Para Cliente:
- ✅ Pedido criado com sucesso
- ✅ Pedido pago
- ✅ Pedido em preparo
- ✅ Pedido pronto
- ✅ Pedido cancelado

#### Para Restaurante:
- ✅ Novo pedido recebido
- ✅ Pedido cancelado pelo cliente
- ⚠️ Pedido aguardando pagamento há muito tempo

### 3.3. Implementação Técnica

#### 3.3.1. Criar NotificationService

**Arquivo**: `src/application/services/NotificationService.ts`

```typescript
export class NotificationService {
  constructor(
    private readonly evolutionApi: EvolutionApiService,
    private readonly customerRepository: ICustomerRepository,
    private readonly restaurantRepository: IRestaurantRepository
  ) {}

  async notifyCustomer(customerId: string, message: string): Promise<void> {
    const customer = await this.customerRepository.findById(customerId);
    if (!customer) return;

    await this.evolutionApi.sendMessage({
      to: customer.getPhone().getValue(),
      text: message,
    });
  }

  async notifyRestaurant(restaurantId: string, message: string): Promise<void> {
    const restaurant = await this.restaurantRepository.findById(restaurantId);
    if (!restaurant) return;

    // Busca usuários do restaurante
    // Envia para todos ou apenas gerente
  }

  async notifyOrderCreated(order: Order): Promise<void> {
    // Notifica restaurante
  }

  async notifyOrderStatusChanged(order: Order, newStatus: OrderStatus): Promise<void> {
    // Notifica cliente
  }
}
```

#### 3.3.2. Integrar nos Handlers

**CustomerOrdersHandler**:
- Após criar pedido → `notificationService.notifyOrderCreated()`
- Após cancelar → `notificationService.notifyOrderCancelled()`

**RestaurantManagementHandler**:
- Ao marcar em preparo → `notificationService.notifyOrderStatusChanged()`
- Ao marcar pronto → `notificationService.notifyOrderStatusChanged()`

### 3.4. Mensagens de Notificação

**Templates sugeridos**:

```typescript
const messages = {
  orderCreated: (orderId: string, total: string) => 
    `✅ Pedido criado com sucesso!\n\nPedido #${orderId}\nTotal: ${total}\n\nAguarde confirmação do restaurante.`,
  
  orderPreparing: (orderId: string) =>
    `👨‍🍳 Seu pedido #${orderId} está sendo preparado!\n\nEm breve estará pronto.`,
  
  orderReady: (orderId: string) =>
    `✅ Seu pedido #${orderId} está pronto para retirada!\n\nObrigado pela preferência!`,
  
  newOrder: (orderId: string, total: string) =>
    `📦 Novo pedido recebido!\n\nPedido #${orderId}\nTotal: ${total}\n\nUse "marcar preparo" para iniciar.`,
};
```

### 3.5. Testes a Criar

- `tests/unit/application/services/NotificationService.test.ts`
- `tests/integration/notifications/OrderNotifications.test.ts`

---

## 4. 🧪 Adicionar Testes de Integração

### 4.1. Estrutura de Testes

```
tests/
├── unit/              ✅ Já existe
├── integration/       ⏳ Criar
│   ├── handlers/
│   │   ├── RestaurantOnboardingHandler.test.ts
│   │   ├── RestaurantManagementHandler.test.ts
│   │   └── CustomerOrdersHandler.test.ts
│   ├── repositories/
│   │   ├── PrismaRestaurantRepository.test.ts
│   │   └── PrismaOrderRepository.test.ts
│   └── services/
│       └── OrchestrationService.test.ts
└── e2e/               ⏳ Criar
    └── webhook-flow.test.ts
```

### 4.2. Testes de Integração para Handlers

**Exemplo**: `tests/integration/handlers/RestaurantOnboardingHandler.test.ts`

```typescript
describe('RestaurantOnboardingHandler Integration', () => {
  let handler: RestaurantOnboardingHandler;
  let restaurantRepository: IRestaurantRepository;
  let prisma: PrismaClient;

  beforeEach(async () => {
    prisma = new PrismaClient();
    restaurantRepository = new PrismaRestaurantRepository(prisma);
    // Setup test database
  });

  afterEach(async () => {
    // Cleanup
    await prisma.$disconnect();
  });

  it('should complete full onboarding flow', async () => {
    // Testa fluxo completo
    // Verifica dados no banco
    // Verifica mensagens enviadas
  });
});
```

### 4.3. Testes E2E

**Arquivo**: `tests/e2e/webhook-flow.test.ts`

```typescript
describe('Webhook Flow E2E', () => {
  it('should handle new user welcome flow', async () => {
    // Simula webhook
    // Verifica resposta
    // Verifica mensagem enviada
  });

  it('should handle restaurant onboarding flow', async () => {
    // Simula webhook de onboarding
    // Verifica todas as etapas
    // Verifica criação no banco
  });
});
```

### 4.4. Setup de Test Database

**Arquivo**: `tests/setup/test-database.ts`

```typescript
export async function setupTestDatabase(): Promise<PrismaClient> {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.TEST_DATABASE_URL,
      },
    },
  });

  // Limpa banco antes dos testes
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.restaurantUser.deleteMany();
  await prisma.restaurant.deleteMany();
  await prisma.customer.deleteMany();

  return prisma;
}
```

---

## 5. 📊 Melhorar Logging Estruturado

### 5.1. Especificação

**Objetivo**: Implementar logging estruturado com níveis, contexto e métricas.

### 5.2. Implementação

#### 5.2.1. Criar Logger Estruturado

**Arquivo**: `src/shared/utils/structuredLogger.ts`

```typescript
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

export interface LogContext {
  userId?: string;
  restaurantId?: string;
  orderId?: string;
  intent?: string;
  [key: string]: unknown;
}

export class StructuredLogger {
  log(level: LogLevel, message: string, context?: LogContext): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...context,
    };

    // Em produção, enviar para serviço de logs (Datadog, CloudWatch, etc)
    // Em desenvolvimento, console
    if (process.env.NODE_ENV === 'production') {
      // Enviar para serviço externo
    } else {
      console.log(JSON.stringify(logEntry));
    }
  }

  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, context);
  }

  error(message: string, context?: LogContext): void {
    this.log(LogLevel.ERROR, message, context);
  }
}
```

#### 5.2.2. Adicionar Logging nos Handlers

**Exemplo**:

```typescript
logger.info('Order created', {
  orderId: order.getId(),
  customerId: data.customerId,
  restaurantId: data.restaurantId,
  total: order.getTotal().getValue(),
});
```

### 5.3. Métricas a Implementar

- Tempo de resposta de handlers
- Taxa de sucesso de intenções
- Número de pedidos criados
- Número de mensagens enviadas
- Erros por tipo

---

## 6. 🔍 Melhorar Validações

### 6.1. Validações a Adicionar

#### 6.1.1. Validação de Pedidos

- Verificar se restaurante está ativo
- Verificar se itens estão disponíveis
- Verificar estoque (se implementado)
- Validar quantidade mínima/máxima

#### 6.1.2. Validação de Cardápio

- Preço mínimo/máximo
- Nome único por restaurante
- Descrição com limite de caracteres

#### 6.1.3. Validação de Telefone

- Formato internacional
- Verificar se já existe
- Validar DDD brasileiro

### 6.2. Criar Validador Centralizado

**Arquivo**: `src/shared/validators/OrderValidator.ts`

```typescript
export class OrderValidator {
  static validateCreateOrder(input: CreateOrderInput): ValidationResult {
    const errors: string[] = [];

    if (!input.restaurantId) {
      errors.push('Restaurant ID is required');
    }

    if (!input.items || input.items.length === 0) {
      errors.push('Order must have at least one item');
    }

    // Mais validações...

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
```

---

## 7. 🎨 Melhorar UX das Mensagens

### 7.1. Formatação de Mensagens

#### 7.1.1. Criar MessageFormatter

**Arquivo**: `src/application/services/MessageFormatter.ts`

```typescript
export class MessageFormatter {
  static formatMenu(items: MenuItem[]): string {
    if (items.length === 0) {
      return '📋 Cardápio vazio.';
    }

    const itemsList = items
      .map((item, index) => {
        const status = item.isAvailable() ? '✅' : '❌';
        return `${index + 1}. ${status} ${item.getName()} - ${item.getPrice().getFormatted()}`;
      })
      .join('\n');

    return `📋 Cardápio:\n\n${itemsList}`;
  }

  static formatOrder(order: Order, items: OrderItem[]): string {
    // Formata pedido de forma legível
  }

  static formatOrderList(orders: Order[]): string {
    // Formata lista de pedidos
  }
}
```

### 7.2. Emojis e Formatação

- Usar emojis consistentes
- Formatação de preços
- Formatação de datas
- Quebras de linha adequadas

---

## 8. 📈 Adicionar Métricas e Monitoramento

### 8.1. Métricas a Implementar

- Pedidos criados por dia
- Taxa de conversão (mensagens → pedidos)
- Tempo médio de resposta
- Erros por tipo
- Usuários ativos

### 8.2. Implementação

#### 8.2.1. Criar MetricsService

**Arquivo**: `src/application/services/MetricsService.ts`

```typescript
export class MetricsService {
  private metrics: Map<string, number> = new Map();

  increment(metric: string, value: number = 1): void {
    const current = this.metrics.get(metric) || 0;
    this.metrics.set(metric, current + value);
  }

  get(metric: string): number {
    return this.metrics.get(metric) || 0;
  }

  // Em produção, enviar para serviço de métricas
  async flush(): Promise<void> {
    // Enviar para Datadog, Prometheus, etc
  }
}
```

#### 8.2.2. Endpoint de Métricas

**Arquivo**: `src/infrastructure/http/routes.ts`

```typescript
router.get('/metrics', (req, res) => {
  // Retorna métricas (formato Prometheus ou JSON)
});
```

---

## 9. 🔐 Adicionar Autenticação e Autorização

### 9.1. Especificação

**Objetivo**: Garantir que apenas usuários autorizados possam acessar certas funcionalidades.

### 9.2. Implementação

#### 9.2.1. Middleware de Autenticação

**Arquivo**: `src/infrastructure/http/middleware/auth.ts`

```typescript
export function authenticateRestaurant(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Verifica se restaurante está autenticado
  // Valida token ou sessão
}
```

#### 9.2.2. Verificação de Propriedade

- Cliente só pode ver/cancelar seus próprios pedidos
- Restaurante só pode gerenciar seus próprios pedidos
- Restaurante só pode editar seu próprio cardápio

---

## 10. 🗄️ Otimizações de Banco de Dados

### 10.1. Índices

Adicionar índices no Prisma schema:

```prisma
model Order {
  // ...
  @@index([restaurantId, status])
  @@index([customerId, status])
  @@index([createdAt])
}

model MenuItem {
  // ...
  @@index([restaurantId, isAvailable])
}
```

### 10.2. Queries Otimizadas

- Usar `select` específico ao invés de `*`
- Paginação em listas grandes
- Cache para consultas frequentes

---

## 📅 Plano de Execução Sugerido

### Fase 1 (Prioridade Alta)
1. ✅ Implementar criação de pedidos completa
2. ✅ Implementar notificações automáticas
3. ✅ Adicionar testes de integração básicos

### Fase 2 (Prioridade Média)
4. ✅ Implementar gestão completa de cardápio
5. ✅ Melhorar validações
6. ✅ Melhorar UX das mensagens

### Fase 3 (Prioridade Baixa)
7. ✅ Logging estruturado
8. ✅ Métricas e monitoramento
9. ✅ Autenticação e autorização
10. ✅ Otimizações de banco

---

## 🎯 Critérios de Sucesso

Cada funcionalidade deve:
- ✅ Ter testes unitários (cobertura > 80%)
- ✅ Ter testes de integração
- ✅ Seguir princípios SOLID
- ✅ Ter tratamento de erros robusto
- ✅ Ter logging adequado
- ✅ Ter documentação atualizada

---

## 📝 Notas de Implementação

- Sempre seguir TDD (testes primeiro)
- Manter Clean Architecture
- Documentar decisões importantes
- Revisar código antes de merge
- Atualizar este documento conforme progresso

