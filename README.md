# HeroCity

Sistema de pedidos de restaurante via WhatsApp usando Clean Architecture, TDD, SOLID e DRY.

## 📚 Documentação

- [README.md](README.md) - Visão geral
- [SETUP.md](SETUP.md) - Guia de setup
- [IMPLEMENTACAO.md](IMPLEMENTACAO.md) - Status da implementação
- [PROXIMOS_PASSOS.md](PROXIMOS_PASSOS.md) ⭐ - Próximos passos detalhados
- [ESPECIFICACOES_TECNICAS.md](ESPECIFICACOES_TECNICAS.md) ⭐ - Especificações técnicas
- [ARQUITETURA_FLUXOS.md](ARQUITETURA_FLUXOS.md) ⭐ - Arquitetura e diagramas
- [DEPLOY.md](DEPLOY.md) - Guia de deploy
- [INDICE.md](INDICE.md) - Índice completo

## Arquitetura

O projeto segue Clean Architecture com as seguintes camadas:

- **Domain**: Entidades, Value Objects, Enums e Interfaces de Repositórios
- **Application**: Services, Handlers e Controllers
- **Infrastructure**: Implementações de repositórios (Prisma), serviços externos (Evolution API, DeepSeek)
- **Shared**: Utilitários compartilhados (logger, env, errors)

## Estrutura do Projeto

```
herocity/
├── src/
│   ├── domain/              # Camada de domínio
│   │   ├── entities/        # Restaurant, Customer, Order, MenuItem
│   │   ├── value-objects/   # Phone, Price
│   │   ├── enums/           # UserContext, OrderStatus, Intent
│   │   └── repositories/    # Interfaces dos repositórios
│   ├── application/         # Camada de aplicação
│   │   ├── controllers/     # WhatsAppController
│   │   ├── services/        # OrchestrationService, UserContextService, IntentService
│   │   └── handlers/        # RestaurantOnboardingHandler, RestaurantManagementHandler, CustomerOrdersHandler
│   ├── infrastructure/      # Camada de infraestrutura
│   │   ├── database/        # Repositórios Prisma (TODO)
│   │   ├── messaging/       # EvolutionApiService
│   │   ├── ai/              # DeepSeekService
│   │   └── http/            # Express, rotas
│   └── shared/              # Utilitários
├── prisma/
│   └── schema.prisma        # Schema do banco
└── tests/                   # Testes unitários
```

## Funcionalidades

### Identificação de Usuário
- Identifica se o usuário é restaurante, cliente ou novo usuário
- Consulta banco de dados (Supabase) para verificar existência
- Mensagem de boas-vindas para novos usuários

### Identificação de Intenção
- Usa DeepSeek AI para identificar a intenção do usuário
- Suporta intenções de cliente e restaurante
- Fallback para ajuda quando intenção não é reconhecida

### Handlers Especializados

#### RestaurantOnboardingHandler
- ✅ Fluxo completo de cadastro com state machine
- ✅ Coleta: nome, endereço, telefone
- ✅ Validações em cada etapa
- ✅ Permite cancelar a qualquer momento
- ✅ Verifica duplicatas de telefone

#### RestaurantManagementHandler
- ✅ Consultar pedidos pendentes
- ✅ Marcar pedido em preparo
- ✅ Marcar pedido pronto
- ✅ Consultar cardápio e estoque
- ⏳ Bloquear/desbloquear itens (estrutura criada)

#### CustomerOrdersHandler
- ✅ Consultar status de pedidos
- ✅ Cancelar pedidos (pendentes ou pagos)
- ⏳ Criar pedido completo (estrutura básica)
- ⏳ Adicionar/remover itens (próximas implementações)

## Setup

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar variáveis de ambiente

Crie um arquivo `.env` baseado em `.env.example`:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/herocity
EVOLUTION_API_URL=https://evolution-api-production-fb6f.up.railway.app
EVOLUTION_API_KEY=your-api-key
EVOLUTION_INSTANCE_NAME=restaurantes
DEEPSEEK_API_KEY=your-deepseek-key
PORT=3000
```

### 3. Configurar banco de dados

```bash
# Gerar Prisma Client
npm run db:generate

# Executar migrações
npm run db:migrate
```

### 4. Executar

```bash
# Desenvolvimento
npm run dev

# Produção
npm run build
npm start
```

## Testes

```bash
# Todos os testes
npm test

# Com cobertura
npm run test:coverage

# Watch mode
npm run test:watch
```

## Endpoints

- `POST /api/webhook/whatsapp` - Webhook da Evolution API
- `GET /api/health` - Health check
- `GET /api-docs` - Documentação Swagger/OpenAPI

## Próximos Passos

> 📋 **Documentação detalhada**: Veja [PROXIMOS_PASSOS.md](PROXIMOS_PASSOS.md) para especificações técnicas completas, exemplos de código e plano de execução.

1. ✅ Implementar repositórios Prisma completos
2. ✅ Implementar fluxo completo de onboarding de restaurante
3. ⏳ Implementar criação de pedidos completa (com seleção de restaurante e itens)
4. ✅ Implementar gestão básica de pedidos
5. ✅ Adicionar Swagger/OpenAPI
6. ⏳ Adicionar mais testes de integração
7. ⏳ Implementar sistema de notificações para clientes
8. ⏳ Adicionar gestão completa de cardápio

**Documentos relacionados**:
- [PROXIMOS_PASSOS.md](PROXIMOS_PASSOS.md) - Especificações detalhadas
- [ESPECIFICACOES_TECNICAS.md](ESPECIFICACOES_TECNICAS.md) - Requisitos funcionais e técnicos
- [ARQUITETURA_FLUXOS.md](ARQUITETURA_FLUXOS.md) - Diagramas e fluxos

## Princípios Aplicados

- **TDD**: Testes escritos antes da implementação
- **DRY**: Código reutilizável, sem duplicação
- **SOLID**: Separação de responsabilidades, inversão de dependências
- **Clean Architecture**: Camadas bem definidas, domínio independente

