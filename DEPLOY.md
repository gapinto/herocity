# 🚀 Guia de Deploy - HeroCity

## Opções de Deploy

### 1. Railway (Recomendado)

Railway é uma plataforma simples para deploy de aplicações Node.js.

#### Passo a Passo

1. **Criar conta no Railway**
   - Acesse [railway.app](https://railway.app)
   - Faça login com GitHub

2. **Criar novo projeto**
   - Clique em "New Project"
   - Selecione "Deploy from GitHub repo"
   - Conecte seu repositório

3. **Configurar variáveis de ambiente**
   - Vá em "Variables"
   - Adicione todas as variáveis do `.env`:
     ```
     DATABASE_URL=postgresql://...
     EVOLUTION_API_URL=...
     EVOLUTION_API_KEY=...
     EVOLUTION_INSTANCE_NAME=restaurantes
     DEEPSEEK_API_KEY=...
     PORT=3000
     NODE_ENV=production
     ```

4. **Configurar banco de dados**
   - Railway oferece PostgreSQL como addon
   - Adicione "PostgreSQL" ao projeto
   - A `DATABASE_URL` será configurada automaticamente

5. **Configurar build**
   - Railway detecta automaticamente Node.js
   - Certifique-se de que o `package.json` tem os scripts:
     - `build`: `tsc`
     - `start`: `node dist/index.js`

6. **Deploy**
   - Railway faz deploy automaticamente a cada push
   - Ou clique em "Deploy" manualmente

7. **Configurar webhook da Evolution API**
   - Copie a URL do seu serviço no Railway
   - Configure na Evolution API:
     ```
     https://seu-projeto.railway.app/api/webhook/whatsapp
     ```

### 2. Heroku

1. **Instalar Heroku CLI**
   ```bash
   npm install -g heroku
   ```

2. **Login**
   ```bash
   heroku login
   ```

3. **Criar app**
   ```bash
   heroku create herocity-app
   ```

4. **Adicionar PostgreSQL**
   ```bash
   heroku addons:create heroku-postgresql:hobby-dev
   ```

5. **Configurar variáveis**
   ```bash
   heroku config:set EVOLUTION_API_URL=...
   heroku config:set EVOLUTION_API_KEY=...
   heroku config:set DEEPSEEK_API_KEY=...
   heroku config:set NODE_ENV=production
   ```

6. **Deploy**
   ```bash
   git push heroku main
   ```

7. **Executar migrações**
   ```bash
   heroku run npm run db:migrate
   ```

### 3. Docker

1. **Criar Dockerfile** (já existe)
   ```dockerfile
   FROM node:20-alpine
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci --only=production
   COPY . .
   RUN npm run build
   CMD ["npm", "start"]
   ```

2. **Criar docker-compose.yml**
   ```yaml
   version: '3.8'
   services:
     app:
       build: .
       ports:
         - "3000:3000"
       environment:
         - DATABASE_URL=postgresql://user:pass@db:5432/herocity
         - EVOLUTION_API_URL=...
         - EVOLUTION_API_KEY=...
         - DEEPSEEK_API_KEY=...
       depends_on:
         - db
     
     db:
       image: postgres:15-alpine
       environment:
         - POSTGRES_USER=user
         - POSTGRES_PASSWORD=pass
         - POSTGRES_DB=herocity
       volumes:
         - postgres_data:/var/lib/postgresql/data

   volumes:
     postgres_data:
   ```

3. **Executar**
   ```bash
   docker-compose up -d
   ```

### 4. VPS (DigitalOcean, AWS EC2, etc)

1. **Instalar Node.js e PostgreSQL**
   ```bash
   # Ubuntu/Debian
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs postgresql
   ```

2. **Clonar repositório**
   ```bash
   git clone https://github.com/seu-usuario/herocity.git
   cd herocity
   ```

3. **Instalar dependências**
   ```bash
   npm install
   ```

4. **Configurar banco**
   ```bash
   npm run db:generate
   npm run db:migrate
   ```

5. **Configurar PM2**
   ```bash
   npm install -g pm2
   pm2 start dist/index.js --name herocity
   pm2 save
   pm2 startup
   ```

6. **Configurar Nginx (opcional)**
   ```nginx
   server {
       listen 80;
       server_name seu-dominio.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

## Checklist de Deploy

- [ ] Variáveis de ambiente configuradas
- [ ] Banco de dados configurado e migrações executadas
- [ ] Build executado com sucesso (`npm run build`)
- [ ] Testes passando (`npm test`)
- [ ] Webhook da Evolution API configurado
- [ ] Health check funcionando (`/api/health`)
- [ ] Swagger acessível (`/api-docs`)
- [ ] Logs configurados
- [ ] Monitoramento configurado (opcional)

## Variáveis de Ambiente Obrigatórias

```env
DATABASE_URL=postgresql://user:password@host:5432/herocity
EVOLUTION_API_URL=https://evolution-api-production-fb6f.up.railway.app
EVOLUTION_API_KEY=your-api-key
EVOLUTION_INSTANCE_NAME=restaurantes
DEEPSEEK_API_KEY=your-deepseek-key
PORT=3000
NODE_ENV=production
```

## Troubleshooting

### Erro: "Cannot connect to database"
- Verifique se o PostgreSQL está rodando
- Verifique a `DATABASE_URL`
- Teste a conexão: `psql $DATABASE_URL`

### Erro: "Prisma Client not generated"
```bash
npm run db:generate
```

### Erro: "Migration failed"
```bash
npm run db:migrate
```

### Erro: "Port already in use"
- Altere a porta no `.env` ou variável de ambiente
- Ou pare o processo que está usando a porta

## Monitoramento

### Logs
- Railway: Dashboard → Logs
- Heroku: `heroku logs --tail`
- PM2: `pm2 logs herocity`

### Health Check
```bash
curl https://seu-dominio.com/api/health
```

### Swagger
Acesse: `https://seu-dominio.com/api-docs`

