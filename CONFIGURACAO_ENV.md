# 📝 Guia de Configuração do `.env`

## 🚀 Início Rápido

1. **Arquivo `.env` já foi criado!** ✅
2. Abra o arquivo `.env` na raiz do projeto
3. Preencha as variáveis **OBRIGATÓRIAS** abaixo
4. Execute `npm run check-config` para verificar

## ✅ Variáveis OBRIGATÓRIAS (Preencha estas!)

### 1. Evolution API (WhatsApp)

```env
EVOLUTION_API_URL=https://sua-evolution-api.com
EVOLUTION_API_KEY=sua-api-key-aqui
EVOLUTION_INSTANCE_NAME=restaurantes
```

**Como obter:**
- Acesse seu painel da Evolution API
- Copie a URL base (ex: `https://evolution-api-production-fb6f.up.railway.app`)
- Copie a API Key da sua instância
- Use o nome da sua instância (ou deixe `restaurantes`)

### 2. Banco de Dados (PostgreSQL)

```env
DATABASE_URL=postgresql://user:password@localhost:5432/herocity?schema=public
```

**Opções:**

**A) PostgreSQL Local:**
```env
DATABASE_URL=postgresql://postgres:senha@localhost:5432/herocity?schema=public
```

**B) Supabase (Recomendado para desenvolvimento):**
1. Acesse https://supabase.com
2. Crie um projeto
3. Vá em Settings > Database
4. Copie a connection string (URI mode)
5. Exemplo: `postgresql://postgres:senha@db.xxxxx.supabase.co:5432/postgres`

### 3. DeepSeek AI

```env
DEEPSEEK_API_KEY=sua-deepseek-api-key-aqui
```

**Como obter:**
1. Acesse https://platform.deepseek.com
2. Crie uma conta
3. Vá em API Keys
4. Crie uma nova API Key
5. Cole no `.env`

## ⚙️ Variáveis OPCIONAIS (Já estão com valores padrão)

Essas variáveis já têm valores padrão, mas você pode ajustar:

```env
PORT=3000
NODE_ENV=development
```

## 🔒 Variáveis OPCIONAIS (Deixe vazio por enquanto)

Essas são para funcionalidades futuras (pagamentos, Redis, etc.):

```env
# Pagamentos - Deixe vazio por enquanto
# ASAAS_API_KEY=
# STRIPE_SECRET_KEY=

# Redis - Para produção, use Redis (desenvolvimento pode usar memory)
# REDIS_URL=redis://localhost:6379
# REDIS_PASSWORD=senha-do-redis (opcional)
# ORDER_STATE_STORAGE=memory  # ou 'redis' para produção
# CONVERSATION_STORAGE=memory  # ou 'redis' para produção (conversas ativas)
# ONBOARDING_STORAGE=memory    # ou 'redis' para produção (estado de onboarding)
# ACTIVE_CONVERSATION_TTL=1800  # TTL em segundos para conversas ativas (padrão: 30min)
# ONBOARDING_STATE_TTL=86400    # TTL em segundos para estado de onboarding (padrão: 24h)

# WhatsApp Number - Deixe vazio por enquanto
# WHATSAPP_NUMBER=
```

## ✅ Verificar Configuração

Após preencher o `.env`, execute:

```bash
npm run check-config
```

O script vai verificar se todas as variáveis obrigatórias estão preenchidas.

## 🐛 Problemas Comuns

### Erro: "Cannot find module 'dotenv'"
```bash
npm install
```

### Erro: "Database connection failed"
- Verifique se o PostgreSQL está rodando
- Verifique se a `DATABASE_URL` está correta
- Teste a conexão: `npm run db:studio`

### Erro: "Evolution API key invalid"
- Verifique se `EVOLUTION_API_KEY` está correto
- Verifique se `EVOLUTION_INSTANCE_NAME` está correto
- Confirme que a instância está ativa no painel

### Erro: "DeepSeek API key invalid"
- Verifique se `DEEPSEEK_API_KEY` está correto
- Confirme que a API Key está ativa
- Verifique se tem créditos na conta DeepSeek

## 📋 Checklist Final

Antes de iniciar a aplicação, verifique:

- [ ] `EVOLUTION_API_URL` preenchido
- [ ] `EVOLUTION_API_KEY` preenchido  
- [ ] `EVOLUTION_INSTANCE_NAME` preenchido
- [ ] `DATABASE_URL` preenchido e válido
- [ ] `DEEPSEEK_API_KEY` preenchido
- [ ] Executei `npm run check-config` ✅
- [ ] Executei `npm run db:generate` (gerar Prisma Client)
- [ ] Executei `npm run db:migrate` (criar tabelas)

## 🚀 Próximos Passos

Após configurar:

1. **Gerar Prisma Client:**
   ```bash
   npm run db:generate
   ```

2. **Executar Migrações:**
   ```bash
   npm run db:migrate
   ```

3. **Verificar Configuração:**
   ```bash
   npm run check-config
   ```

4. **Iniciar Aplicação:**
   ```bash
   npm run dev
   ```

5. **Configurar Webhook (quando aplicação estiver rodando):**
   - Use ngrok para desenvolvimento local
   - Configure webhook na Evolution API apontando para: `https://sua-url-ngrok.ngrok.io/api/webhook/whatsapp`

## 📚 Mais Informações

- Ver [SETUP.md](SETUP.md) para instruções detalhadas
- Ver [README.md](README.md) para visão geral do projeto
