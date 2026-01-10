# Setup HeroCity - Passo a Passo

## 1. Instalar Dependências

```bash
cd herocity
npm install
```

## 2. Configurar Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/herocity?schema=public
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-key

# WhatsApp (Evolution API)
EVOLUTION_API_URL=https://evolution-api-production-fb6f.up.railway.app
EVOLUTION_API_KEY=your-evolution-api-key
EVOLUTION_INSTANCE_NAME=restaurantes

# AI (DeepSeek)
DEEPSEEK_API_KEY=your-deepseek-api-key

# Server
PORT=3000
NODE_ENV=development
```

## 3. Configurar Banco de Dados

### Opção A: Usando Supabase (Recomendado)

1. Crie um projeto no [Supabase](https://supabase.com)
2. Copie a `DATABASE_URL` do projeto
3. Cole no arquivo `.env`

### Opção B: PostgreSQL Local

1. Instale PostgreSQL
2. Crie um banco de dados:
   ```sql
   CREATE DATABASE herocity;
   ```
3. Configure a `DATABASE_URL` no `.env`

## 4. Executar Migrações do Prisma

```bash
# Gerar Prisma Client
npm run db:generate

# Executar migrações (cria as tabelas)
npm run db:migrate
```

## 5. Verificar Instalação

```bash
# Executar testes
npm test

# Verificar se compila
npm run build
```

## 6. Iniciar Aplicação

```bash
# Modo desenvolvimento (com hot reload)
npm run dev

# Modo produção
npm run build
npm start
```

## 7. Configurar Webhook da Evolution API

1. Acesse o painel da Evolution API
2. Configure o webhook para apontar para:
   ```
   https://seu-dominio.com/api/webhook/whatsapp
   ```
3. Ou use ngrok para desenvolvimento local:
   ```bash
   ngrok http 3000
   # Use a URL do ngrok no webhook
   ```

## 8. Testar

### Health Check
```bash
curl http://localhost:3000/api/health
```

### Webhook (exemplo)
```bash
curl -X POST http://localhost:3000/api/webhook/whatsapp \
  -H "Content-Type: application/json" \
  -d '{
    "event": "messages.upsert",
    "data": {
      "key": {
        "remoteJid": "5511999999999@s.whatsapp.net",
        "fromMe": false,
        "pushName": "Teste"
      },
      "message": {
        "conversation": "Olá"
      }
    }
  }'
```

## Estrutura de Testes

Os testes estão organizados seguindo a estrutura do código:

```
tests/
└── unit/
    ├── domain/
    │   ├── entities/
    │   └── value-objects/
    └── application/
        └── services/
```

Execute os testes:
```bash
npm test
npm run test:coverage
npm run test:watch
```

## Próximos Passos

1. ✅ Estrutura base criada
2. ✅ Domain Layer implementado
3. ✅ Infrastructure Layer implementado
4. ✅ Application Layer implementado
5. ⏳ Implementar lógica completa dos handlers
6. ⏳ Adicionar testes de integração
7. ⏳ Configurar Swagger/OpenAPI
8. ⏳ Deploy em produção

## Troubleshooting

### Erro: "Cannot find module '@prisma/client'"
```bash
npm run db:generate
```

### Erro: "Database connection failed"
- Verifique se o PostgreSQL está rodando
- Verifique a `DATABASE_URL` no `.env`
- Teste a conexão: `npm run db:studio`

### Erro: "Evolution API key invalid"
- Verifique `EVOLUTION_API_KEY` no `.env`
- Verifique se a instância está ativa na Evolution API

