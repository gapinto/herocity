# Expansão do Onboarding para Criação de Subconta no Provedor de Pagamento

## ✅ O que já foi implementado

1. **Schema Prisma atualizado** - Campos adicionados:
   - `legalName` - Razão social / Nome completo (PF)
   - `cpfCnpj` - CPF (PF) ou CNPJ (PJ)
   - `email` - E-mail para conta
   - `bankAccount` (JSON) - Dados bancários
   - `documentUrl` - URL do documento do responsável
   - `paymentAccountId` - ID da subconta criada (único)

2. **Entidade Restaurant atualizada** - Métodos adicionados:
   - `getLegalName()`, `getCpfCnpj()`, `getEmail()`, `getBankAccount()`, `getDocumentUrl()`
   - `getPaymentAccountId()` - Retorna ID da subconta
   - `hasPaymentAccountData()` - Verifica se tem todos os dados necessários
   - `setPaymentAccountId()` - Define ID da subconta após criação
   - `updatePaymentData()` - Atualiza dados de pagamento

3. **Tipo BankAccountData criado** - Estrutura para dados bancários:
   - `bankCode`, `agency`, `agencyDigit`, `account`, `accountDigit`
   - `accountType` ('CHECKING' | 'SAVINGS')
   - `accountHolderName`

4. **IPaymentAccountService criado** - Interface para gerenciar subcontas:
   - `createSubAccount()` - Cria subconta no provedor
   - `getAccountStatus()` - Verifica status da conta
   - `updateBankAccount()` - Atualiza dados bancários

5. **AsaasPaymentAccountService criado** - Implementação para Asaas:
   - Cria cliente (subconta) no Asaas
   - Cria conta bancária para o cliente
   - Retorna `accountId` (ex: "cus_29384")

6. **PrismaRestaurantRepository atualizado** - Persiste todos os novos campos

## 📋 O que falta implementar

### 1. Expandir RestaurantOnboardingHandler

**Estados adicionais necessários:**
- `WAITING_LEGAL_NAME` - Coletar razão social / nome completo
- `WAITING_CPF_CNPJ` - Coletar CPF ou CNPJ
- `WAITING_EMAIL` - Coletar e-mail
- `WAITING_BANK_ACCOUNT` - Coletar dados bancários (vários campos)
- `WAITING_DOCUMENT` - Coletar documento (opcional, pode pular)
- `CREATING_PAYMENT_ACCOUNT` - Criando subconta no provedor (estado interno)

**Fluxo expandido:**
```
1. Nome fantasia (WAITING_NAME) ✅
2. Endereço (WAITING_ADDRESS) ✅
3. Telefone (WAITING_PHONE) ✅
4. Razão social / Nome completo (WAITING_LEGAL_NAME) ❌
5. CPF ou CNPJ (WAITING_CPF_CNPJ) ❌
6. E-mail (WAITING_EMAIL) ❌
7. Dados bancários (WAITING_BANK_ACCOUNT) ❌
   - Código do banco
   - Agência
   - Conta
   - Tipo de conta (Corrente/Poupança)
   - Nome do titular
8. Documento do responsável (WAITING_DOCUMENT - opcional) ❌
   - Permite pular digitando "pular" ou "skip"
9. Criar subconta no provedor (CREATING_PAYMENT_ACCOUNT) ❌
   - Chama IPaymentAccountService.createSubAccount()
   - Salva paymentAccountId no restaurante
10. Completar onboarding (COMPLETED) ✅
```

### 2. Atualizar CustomerOrdersHandler

**Corrigir uso de getPaymentAccountId():**
```typescript
// ANTES (erro):
const restaurantPaymentAccountId = (restaurant as any).getPaymentAccountId?.() || restaurant.getId();

// DEPOIS (correto):
const restaurantPaymentAccountId = restaurant.getPaymentAccountId();
if (!restaurantPaymentAccountId) {
  throw new Error('Restaurant payment account not configured. Please complete onboarding.');
}
```

### 3. Factory para PaymentAccountService

Criar `PaymentAccountServiceFactory` para escolher entre Asaas/Stripe via env var.

### 4. Integrar no index.ts

Injetar `IPaymentAccountService` no `RestaurantOnboardingHandler`.

## 🔧 Próximos passos de implementação

1. Expandir `RestaurantOnboardingHandler` com novos estados e handlers
2. Integrar `IPaymentAccountService` no handler
3. Criar `PaymentAccountServiceFactory`
4. Atualizar `CustomerOrdersHandler` para usar `getPaymentAccountId()` corretamente
5. Atualizar `index.ts` para injetar dependências
6. Criar testes para o fluxo completo

## 💡 Notas importantes

- **Dados bancários**: Coletar em formato estruturado via múltiplas mensagens ou JSON
- **Documento**: Opcional, mas recomendado. Pode ser URL de upload ou base64
- **Validações**: Validar CPF/CNPJ, e-mail, dados bancários antes de criar subconta
- **Erros**: Tratar erros do provedor de pagamento (KYC pendente, dados inválidos, etc.)
- **Idempotência**: Verificar se restaurante já tem `paymentAccountId` antes de criar novamente
