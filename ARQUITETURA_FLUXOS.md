# 🏗️ Arquitetura e Fluxos - HeroCity

## 📊 Diagrama de Fluxo Principal

```mermaid
flowchart TD
    A[Evolution API Webhook] --> B[WhatsAppController]
    B --> C[OrchestrationService]
    C --> D[UserContextService]
    D --> E{User Type?}
    E -->|New User| F[Welcome Message]
    E -->|Restaurant| G[IntentService]
    E -->|Customer| G
    G --> H[DeepSeekService]
    H --> I{Intent?}
    I -->|restaurant_onboarding| J[RestaurantOnboardingHandler]
    I -->|restaurant_management| K[RestaurantManagementHandler]
    I -->|customer_orders| L[CustomerOrdersHandler]
    I -->|help| M[Help Message]
    J --> N[EvolutionApiService]
    K --> N
    L --> N
    M --> N
    F --> N
```

## 🔄 Fluxo de Onboarding de Restaurante

```mermaid
stateDiagram-v2
    [*] --> IDLE
    IDLE --> WAITING_NAME: "quero cadastrar restaurante"
    WAITING_NAME --> WAITING_ADDRESS: "Nome válido"
    WAITING_NAME --> WAITING_NAME: "Nome inválido"
    WAITING_ADDRESS --> WAITING_PHONE: "Endereço válido"
    WAITING_ADDRESS --> WAITING_ADDRESS: "Endereço inválido"
    WAITING_PHONE --> COMPLETED: "Telefone válido"
    WAITING_PHONE --> WAITING_PHONE: "Telefone inválido"
    WAITING_NAME --> [*]: "cancelar"
    WAITING_ADDRESS --> [*]: "cancelar"
    WAITING_PHONE --> [*]: "cancelar"
    COMPLETED --> [*]: "Restaurante salvo"
```

## 🛒 Fluxo de Criação de Pedido (Proposto)

```mermaid
stateDiagram-v2
    [*] --> IDLE
    IDLE --> SELECTING_RESTAURANT: "quero fazer pedido"
    SELECTING_RESTAURANT --> VIEWING_MENU: "Restaurante selecionado"
    VIEWING_MENU --> ADDING_ITEMS: "Ver cardápio"
    ADDING_ITEMS --> ADDING_ITEMS: "Adicionar mais itens"
    ADDING_ITEMS --> CONFIRMING_ORDER: "Finalizar pedido"
    CONFIRMING_ORDER --> [*]: "Pedido confirmado"
    SELECTING_RESTAURANT --> [*]: "cancelar"
    VIEWING_MENU --> [*]: "cancelar"
    ADDING_ITEMS --> [*]: "cancelar"
    CONFIRMING_ORDER --> [*]: "cancelar"
```

## 🏪 Fluxo de Gestão de Pedidos (Restaurante)

```mermaid
sequenceDiagram
    participant R as Restaurante
    participant H as RestaurantManagementHandler
    participant O as OrderRepository
    participant N as NotificationService
    participant C as Cliente

    R->>H: "consultar pedidos pendentes"
    H->>O: findByRestaurantAndStatus(PAID)
    O-->>H: Lista de pedidos
    H-->>R: Lista formatada

    R->>H: "marcar pedido em preparo"
    H->>O: findById + updateStatus(PREPARING)
    O-->>H: Order atualizado
    H->>N: notifyOrderStatusChanged
    N-->>C: "Pedido em preparo"

    R->>H: "marcar pedido pronto"
    H->>O: findById + updateStatus(READY)
    O-->>H: Order atualizado
    H->>N: notifyOrderStatusChanged
    N-->>C: "Pedido pronto"
```

## 📦 Estrutura de Dados

### Order Creation Flow

```typescript
// Estado inicial
{
  state: 'SELECTING_RESTAURANT',
  restaurantId: undefined,
  items: []
}

// Após selecionar restaurante
{
  state: 'VIEWING_MENU',
  restaurantId: 'rest-123',
  items: []
}

// Adicionando itens
{
  state: 'ADDING_ITEMS',
  restaurantId: 'rest-123',
  items: [
    { menuItemId: 'item-1', quantity: 2, price: 25.50 },
    { menuItemId: 'item-2', quantity: 1, price: 15.00 }
  ],
  total: 66.00
}

// Confirmando
{
  state: 'CONFIRMING_ORDER',
  restaurantId: 'rest-123',
  items: [...],
  total: 66.00
}
```

## 🔐 Fluxo de Autenticação (Futuro)

```mermaid
flowchart LR
    A[Mensagem WhatsApp] --> B{Telefone existe?}
    B -->|Sim| C{É restaurante?}
    B -->|Não| D[Novo usuário]
    C -->|Sim| E[Verifica permissões]
    C -->|Não| F[Cliente]
    E -->|Autorizado| G[Permite ações]
    E -->|Não autorizado| H[Bloqueia ações]
```

## 📊 Estrutura de Camadas

```mermaid
graph TB
    subgraph "HTTP Layer"
        A[Express Routes]
        B[Controllers]
    end
    
    subgraph "Application Layer"
        C[Services]
        D[Handlers]
        E[State Services]
    end
    
    subgraph "Domain Layer"
        F[Entities]
        G[Value Objects]
        H[Use Cases]
        I[Repository Interfaces]
    end
    
    subgraph "Infrastructure Layer"
        J[Prisma Repositories]
        K[External APIs]
        L[Database]
    end
    
    A --> B
    B --> C
    C --> D
    D --> E
    D --> H
    H --> I
    I --> J
    J --> L
    D --> K
```

## 🎯 Padrões de Design Aplicados

### 1. State Machine Pattern
- `ConversationStateService` - Gerencia estados de conversação
- `OrderStateService` (futuro) - Gerencia criação de pedidos

### 2. Repository Pattern
- Interfaces no Domain Layer
- Implementações no Infrastructure Layer
- Facilita testes e troca de implementação

### 3. Strategy Pattern
- Handlers especializados por tipo de ação
- Fácil adicionar novos handlers

### 4. Dependency Injection
- Todas as dependências injetadas via construtor
- Facilita testes e manutenção

### 5. Service Layer Pattern
- Services orquestram lógica de negócio
- Handlers coordenam fluxos específicos

## 🔄 Ciclo de Vida de um Pedido

```mermaid
stateDiagram-v2
    [*] --> PENDING: Cliente cria pedido
    PENDING --> PAID: Cliente paga
    PAID --> PREPARING: Restaurante inicia preparo
    PREPARING --> READY: Restaurante finaliza
    READY --> DELIVERED: Cliente retira
    PENDING --> CANCELLED: Cliente cancela
    PAID --> CANCELLED: Cliente cancela (antes do preparo)
    PREPARING --> [*]: Não pode cancelar
    READY --> [*]: Não pode cancelar
    DELIVERED --> [*]
    CANCELLED --> [*]
```

## 📱 Fluxo de Mensagens

### Exemplo: Novo Pedido

```
1. Cliente: "quero fazer um pedido"
   → Sistema: Lista restaurantes

2. Cliente: "1"
   → Sistema: Mostra cardápio

3. Cliente: "adicionar 2 hambúrgueres"
   → Sistema: "2x Hambúrguer adicionado. Total: R$ 50,00"

4. Cliente: "finalizar"
   → Sistema: "Pedido criado! Total: R$ 50,00"
   → Sistema (notifica restaurante): "Novo pedido #abc123"
```

## 🧪 Estrutura de Testes

```
tests/
├── unit/
│   ├── domain/
│   │   ├── entities/
│   │   ├── value-objects/
│   │   └── usecases/
│   └── application/
│       ├── services/
│       └── handlers/
├── integration/
│   ├── handlers/
│   ├── repositories/
│   └── services/
└── e2e/
    └── webhook-flow/
```

## 🔍 Pontos de Extensão

### 1. Adicionar Novo Handler
```typescript
// 1. Criar handler
class NewHandler {
  async handle(data: MessageData): Promise<void> {
    // Lógica
  }
}

// 2. Adicionar intent no enum
enum Intent {
  NEW_INTENT = 'new_intent'
}

// 3. Registrar no OrchestrationService
case Intent.NEW_INTENT:
  await this.newHandler.handle(data);
  break;
```

### 2. Adicionar Novo Use Case
```typescript
// 1. Criar use case
class NewUseCase {
  async execute(input: Input): Promise<Output> {
    // Lógica
  }
}

// 2. Injetar onde necessário
const newUseCase = new NewUseCase(repository);
```

### 3. Adicionar Nova Entidade
```typescript
// 1. Criar entity
class NewEntity {
  // ...
}

// 2. Criar repository interface
interface INewRepository {
  // ...
}

// 3. Implementar repository Prisma
class PrismaNewRepository implements INewRepository {
  // ...
}
```

