# 📱 Implementação de QR Code na Mesa - HeroCity

## 🎯 Objetivo

Permitir que clientes escaneiem um QR code na mesa do restaurante e sejam direcionados diretamente ao cardápio daquele restaurante, sem precisar selecionar o restaurante manualmente.

## 🔄 Fluxo Atual vs Novo Fluxo

### Fluxo Atual (Sem QR Code)
```
Cliente: "quero fazer um pedido"
  → Sistema lista restaurantes disponíveis
  → Cliente escolhe restaurante (ex: "1")
  → Sistema mostra cardápio
  → Cliente adiciona itens
```

### Novo Fluxo (Com QR Code)
```
Cliente escaneia QR code na mesa
  → Sistema identifica restaurante automaticamente
  → Sistema mostra cardápio diretamente
  → Cliente adiciona itens
```

## 📋 Formato do QR Code

O QR code deve conter uma URL ou código que identifique o restaurante:

**Opção 1: URL com parâmetro**
```
https://herocity.app/pedido?restaurant=abc123
```

**Opção 2: Código simples**
```
RESTAURANT:abc123
```

**Opção 3: Deep Link WhatsApp**
```
https://wa.me/5511999999999?text=pedido:abc123
```

## 🔧 Implementação

### 1. Detectar QR Code no Webhook

O Evolution API pode enviar mensagens com QR code. Precisamos detectar quando a mensagem contém um código de restaurante.

### 2. Nova Intenção: `CRIAR_PEDIDO_QR_CODE`

Quando detectado QR code, usar intenção específica que pula a seleção de restaurante.

### 3. Modificar CustomerOrdersHandler

Adicionar método `handleCreateOrderFromQRCode` que:
- Recebe restaurantId diretamente
- Pula estado `SELECTING_RESTAURANT`
- Vai direto para `VIEWING_MENU`

## 📝 Exemplo de Uso

```
Cliente escaneia QR code
  → WhatsApp abre com mensagem: "pedido:abc123"
  → Sistema detecta código "abc123"
  → Sistema identifica restaurante
  → Sistema mostra cardápio diretamente
  → Cliente: "adicionar 1 2"
  → Sistema adiciona ao carrinho
  → Cliente: "finalizar"
  → Pedido criado!
```

## 🎨 Formato do QR Code Recomendado

**Recomendação**: Usar URL curta com parâmetro

```
https://herocity.app/qr/abc123
```

Quando acessado, redireciona para WhatsApp:
```
https://wa.me/5511999999999?text=pedido:abc123
```

Ou diretamente envia mensagem:
```
pedido:abc123
```

## 🔐 Segurança

- Validar que o restaurante existe e está ativo
- Validar que o código do QR code é válido
- Registrar tentativas de uso de QR codes inválidos

## 📊 Vantagens

1. **UX Melhor**: Cliente não precisa escolher restaurante
2. **Mais Rápido**: Menos passos no fluxo
3. **Menos Erros**: Não há chance de escolher restaurante errado
4. **Experiência Moderna**: QR codes são familiares aos usuários

