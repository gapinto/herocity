import { MessageData } from '../services/OrchestrationService';
import { EvolutionApiService } from '../../infrastructure/messaging/EvolutionApiService';
import { IRestaurantRepository } from '../../domain/repositories/IRestaurantRepository';
import { Restaurant } from '../../domain/entities/Restaurant';
import { Phone } from '../../domain/value-objects/Phone';
import { OnboardingState, OnboardingData } from '../services/ConversationStateService';
import { IConversationStateService } from '../../domain/services/IConversationStateService';
import { IPaymentAccountService } from '../../domain/services/IPaymentAccountService';
import { BankAccountData } from '../../domain/types/BankAccount';
import { logger } from '../../shared/utils/logger';

export class RestaurantOnboardingHandler {
  private bankAccountStep: number = 0; // Para controlar múltiplas etapas de dados bancários

  constructor(
    private readonly evolutionApi: EvolutionApiService,
    private readonly restaurantRepository: IRestaurantRepository,
    private readonly conversationState: IConversationStateService,
    private readonly paymentAccountService?: IPaymentAccountService
  ) {}

  /**
   * Verifica se há uma conversa de onboarding ativa para o telefone
   */
  async hasActiveConversation(phone: string): Promise<boolean> {
    const conversation = await this.conversationState.getConversation(phone);
    return conversation !== undefined && conversation.state !== OnboardingState.COMPLETED;
  }

  async handle(data: MessageData): Promise<void> {
    try {
      const conversation = await this.conversationState.getConversation(data.from);

      if (!conversation) {
        // Inicia novo onboarding
        await this.startOnboarding(data.from, data.pushName);
        return;
      }

      // Processa resposta baseada no estado
      await this.processConversation(data, conversation);
    } catch (error: any) {
      logger.error('Error in RestaurantOnboardingHandler', {
        error: error.message,
        from: data.from,
      });
      throw error;
    }
  }

  private async startOnboarding(from: string, pushName?: string): Promise<void> {
    await this.conversationState.startOnboarding(from);
    this.bankAccountStep = 0; // Reset bank account step

    const name = pushName || 'usuário';
    await this.evolutionApi.sendMessage({
      to: from,
      text: `🍽️ Olá ${name}! Vamos cadastrar seu restaurante no HeroCity.

📋 Vamos coletar alguns dados necessários:

**1️⃣ Nome do restaurante (nome fantasia)**
Digite o nome do seu restaurante:`,
    });
  }

  private async processConversation(
    data: MessageData,
    conversation: OnboardingData
  ): Promise<void> {
    const text = data.text.trim().toLowerCase();

    // Permite cancelar a qualquer momento
    if (text === 'cancelar' || text === 'sair') {
      await this.conversationState.clearConversation(data.from);
      this.bankAccountStep = 0;
      await this.evolutionApi.sendMessage({
        to: data.from,
        text: '❌ Cadastro cancelado. Você pode iniciar novamente a qualquer momento.',
      });
      return;
    }

    // Permite pular documento (opcional)
    if (conversation.state === OnboardingState.WAITING_DOCUMENT && (text === 'pular' || text === 'skip' || text === 'pular documento')) {
      await this.handleSkipDocument(data, conversation);
      return;
    }

    switch (conversation.state) {
      case OnboardingState.WAITING_NAME:
        await this.handleName(data, conversation);
        break;

      case OnboardingState.WAITING_ADDRESS:
        await this.handleAddress(data, conversation);
        break;

      case OnboardingState.WAITING_PHONE:
        await this.handlePhone(data, conversation);
        break;

      case OnboardingState.WAITING_LEGAL_NAME:
        await this.handleLegalName(data, conversation);
        break;

      case OnboardingState.WAITING_CPF_CNPJ:
        await this.handleCpfCnpj(data, conversation);
        break;

      case OnboardingState.WAITING_EMAIL:
        await this.handleEmail(data, conversation);
        break;

      case OnboardingState.WAITING_BANK_ACCOUNT:
        await this.handleBankAccount(data, conversation);
        break;

      case OnboardingState.WAITING_DOCUMENT:
        await this.handleDocument(data, conversation);
        break;

      case OnboardingState.CREATING_PAYMENT_ACCOUNT:
        // Estado interno - aguarda criação de subconta
        await this.evolutionApi.sendMessage({
          to: data.from,
          text: '⏳ Estamos configurando sua conta de pagamento. Aguarde...',
        });
        break;

      default:
        await this.startOnboarding(data.from, data.pushName);
    }
  }

  private async handleName(
    data: MessageData,
    _conversation: { name?: string; address?: string; phone?: string }
  ): Promise<void> {
    const name = data.text.trim();

    if (name.length < 3) {
      await this.evolutionApi.sendMessage({
        to: data.from,
        text: '❌ Nome muito curto. Por favor, digite um nome válido (mínimo 3 caracteres).',
      });
      return;
    }

    await this.conversationState.updateData(data.from, { name });
    await this.conversationState.updateState(data.from, OnboardingState.WAITING_ADDRESS);

    await this.evolutionApi.sendMessage({
      to: data.from,
      text: `✅ Nome registrado: ${name}

2️⃣ **Endereço**
Agora, digite o endereço do restaurante:
Exemplo: Rua das Flores, 123 - Centro`,
    });
  }

  private async handleAddress(
    data: MessageData,
    _conversation: { name?: string; address?: string; phone?: string }
  ): Promise<void> {
    const address = data.text.trim();

    if (address.length < 10) {
      await this.evolutionApi.sendMessage({
        to: data.from,
        text: '❌ Endereço muito curto. Por favor, digite um endereço completo.',
      });
      return;
    }

    await this.conversationState.updateData(data.from, { address });
    await this.conversationState.updateState(data.from, OnboardingState.WAITING_PHONE);

    await this.evolutionApi.sendMessage({
      to: data.from,
      text: `✅ Endereço registrado: ${address}

3️⃣ **Telefone de contato**
Digite o telefone do restaurante (apenas números):
Exemplo: 81999999999`,
    });
  }

  private async handlePhone(
    data: MessageData,
    _conversation: OnboardingData
  ): Promise<void> {
    try {
      const phone = Phone.create(data.text.trim());

      // Verifica se já existe restaurante com esse telefone
      const existing = await this.restaurantRepository.findByPhone(phone);
      if (existing) {
        await this.evolutionApi.sendMessage({
          to: data.from,
          text: '❌ Já existe um restaurante cadastrado com este telefone. Por favor, use outro número.',
        });
        return;
      }

      await this.conversationState.updateData(data.from, { phone: phone.getValue() });
      await this.conversationState.updateState(data.from, OnboardingState.WAITING_LEGAL_NAME);

      await this.evolutionApi.sendMessage({
        to: data.from,
        text: `✅ Telefone registrado: ${phone.getFormatted()}

**4️⃣ Razão Social / Nome Completo**
Digite a razão social (se for empresa) ou seu nome completo (se for pessoa física):
Exemplo: João Silva ou Restaurante LTDA`,
      });
    } catch (error: any) {
      await this.evolutionApi.sendMessage({
        to: data.from,
        text: '❌ Telefone inválido. Por favor, digite apenas números (exemplo: 81999999999).',
      });
    }
  }

  private async handleLegalName(
    data: MessageData,
    _conversation: OnboardingData
  ): Promise<void> {
    const legalName = data.text.trim();

    if (legalName.length < 3) {
      await this.evolutionApi.sendMessage({
        to: data.from,
        text: '❌ Nome muito curto. Por favor, digite um nome válido (mínimo 3 caracteres).',
      });
      return;
    }

    await this.conversationState.updateData(data.from, { legalName });
    await this.conversationState.updateState(data.from, OnboardingState.WAITING_CPF_CNPJ);

    await this.evolutionApi.sendMessage({
      to: data.from,
      text: `✅ Razão social registrada: ${legalName}

**5️⃣ CPF ou CNPJ**
Digite seu CPF (11 dígitos) ou CNPJ (14 dígitos), apenas números:
Exemplo: 12345678900 (CPF) ou 12345678000190 (CNPJ)`,
    });
  }

  private async handleCpfCnpj(
    data: MessageData,
    _conversation: OnboardingData
  ): Promise<void> {
    const cpfCnpj = data.text.trim().replace(/\D/g, ''); // Remove tudo que não é dígito

    if (cpfCnpj.length !== 11 && cpfCnpj.length !== 14) {
      await this.evolutionApi.sendMessage({
        to: data.from,
        text: '❌ CPF/CNPJ inválido. Digite 11 dígitos para CPF ou 14 dígitos para CNPJ (apenas números).',
      });
      return;
    }

    await this.conversationState.updateData(data.from, { cpfCnpj });
    await this.conversationState.updateState(data.from, OnboardingState.WAITING_EMAIL);

    await this.evolutionApi.sendMessage({
      to: data.from,
      text: `✅ ${cpfCnpj.length === 11 ? 'CPF' : 'CNPJ'} registrado: ${cpfCnpj.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4').replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')}

**6️⃣ E-mail**
Digite seu e-mail para recebimento de pagamentos:
Exemplo: contato@restaurante.com.br`,
    });
  }

  private async handleEmail(
    data: MessageData,
    _conversation: OnboardingData
  ): Promise<void> {
    const email = data.text.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      await this.evolutionApi.sendMessage({
        to: data.from,
        text: '❌ E-mail inválido. Por favor, digite um e-mail válido (exemplo: contato@restaurante.com.br).',
      });
      return;
    }

    await this.conversationState.updateData(data.from, { email });
    await this.conversationState.updateState(data.from, OnboardingState.WAITING_BANK_ACCOUNT);
    this.bankAccountStep = 1; // Inicia coleta de dados bancários

    await this.evolutionApi.sendMessage({
      to: data.from,
      text: `✅ E-mail registrado: ${email}

**7️⃣ Dados Bancários**
Vamos coletar os dados da conta bancária onde você receberá os pagamentos:

**7.1 Código do Banco**
Digite o código do banco (3 dígitos):
Exemplos:
• 001 - Banco do Brasil
• 033 - Santander
• 104 - Caixa Econômica
• 237 - Bradesco
• 341 - Itaú`,
    });
  }

  private async handleBankAccount(
    data: MessageData,
    conversation: OnboardingData
  ): Promise<void> {
    const text = data.text.trim();

    if (this.bankAccountStep === 1) {
      // Código do banco
      const bankCode = text.replace(/\D/g, '');
      if (bankCode.length !== 3) {
        await this.evolutionApi.sendMessage({
          to: data.from,
          text: '❌ Código do banco inválido. Digite 3 dígitos (exemplo: 001, 341).',
        });
        return;
      }

      const bankAccount: BankAccountData = {
        bankCode,
        agency: '',
        account: '',
        accountDigit: '',
        accountType: 'CHECKING',
        accountHolderName: conversation.legalName || conversation.name || '',
      };
      await this.conversationState.updateData(data.from, { bankAccount });
      this.bankAccountStep = 2;

      await this.evolutionApi.sendMessage({
        to: data.from,
        text: `✅ Código do banco: ${bankCode}

**7.2 Agência**
Digite o número da agência (sem dígito verificador):
Exemplo: 1234`,
      });
    } else if (this.bankAccountStep === 2) {
      // Agência
      const agency = text.replace(/\D/g, '');
      if (agency.length < 2 || agency.length > 6) {
        await this.evolutionApi.sendMessage({
          to: data.from,
          text: '❌ Agência inválida. Digite entre 2 e 6 dígitos.',
        });
        return;
      }

      const bankAccount = conversation.bankAccount!;
      bankAccount.agency = agency;
      await this.conversationState.updateData(data.from, { bankAccount });
      this.bankAccountStep = 3;

      await this.evolutionApi.sendMessage({
        to: data.from,
        text: `✅ Agência: ${agency}

**7.3 Número da Conta**
Digite o número da conta (sem dígito verificador):
Exemplo: 12345678`,
      });
    } else if (this.bankAccountStep === 3) {
      // Conta
      const account = text.replace(/\D/g, '');
      if (account.length < 3 || account.length > 10) {
        await this.evolutionApi.sendMessage({
          to: data.from,
          text: '❌ Número da conta inválido. Digite entre 3 e 10 dígitos.',
        });
        return;
      }

      const bankAccount = conversation.bankAccount!;
      bankAccount.account = account;
      await this.conversationState.updateData(data.from, { bankAccount });
      this.bankAccountStep = 4;

      await this.evolutionApi.sendMessage({
        to: data.from,
        text: `✅ Conta: ${account}

**7.4 Dígito Verificador**
Digite o dígito verificador da conta (1 dígito):
Exemplo: 5`,
      });
    } else if (this.bankAccountStep === 4) {
      // Dígito verificador
      const accountDigit = text.replace(/\D/g, '').charAt(0);
      if (!accountDigit) {
        await this.evolutionApi.sendMessage({
          to: data.from,
          text: '❌ Dígito verificador inválido. Digite 1 dígito.',
        });
        return;
      }

      const bankAccount = conversation.bankAccount!;
      bankAccount.accountDigit = accountDigit;
      await this.conversationState.updateData(data.from, { bankAccount });
      this.bankAccountStep = 5;

      await this.evolutionApi.sendMessage({
        to: data.from,
        text: `✅ Dígito verificador: ${accountDigit}

**7.5 Tipo de Conta**
Escolha o tipo de conta:
Digite "1" para Conta Corrente
Digite "2" para Poupança`,
      });
    } else if (this.bankAccountStep === 5) {
      // Tipo de conta
      const type = text.replace(/\D/g, '');
      if (type !== '1' && type !== '2') {
        await this.evolutionApi.sendMessage({
          to: data.from,
          text: '❌ Tipo inválido. Digite "1" para Conta Corrente ou "2" para Poupança.',
        });
        return;
      }

      const bankAccount = conversation.bankAccount!;
      bankAccount.accountType = type === '1' ? 'CHECKING' : 'SAVINGS';
      await this.conversationState.updateData(data.from, { bankAccount });
      this.bankAccountStep = 6;

      await this.evolutionApi.sendMessage({
        to: data.from,
        text: `✅ Tipo de conta: ${bankAccount.accountType === 'CHECKING' ? 'Conta Corrente' : 'Poupança'}

**7.6 Nome do Titular**
Digite o nome do titular da conta (deve ser igual ao nome do CPF/CNPJ):
Exemplo: João Silva`,
      });
    } else if (this.bankAccountStep === 6) {
      // Nome do titular
      const accountHolderName = data.text.trim();
      if (accountHolderName.length < 3) {
        await this.evolutionApi.sendMessage({
          to: data.from,
          text: '❌ Nome do titular muito curto. Digite o nome completo.',
        });
        return;
      }

      const bankAccount = conversation.bankAccount!;
      bankAccount.accountHolderName = accountHolderName;
      await this.conversationState.updateData(data.from, { bankAccount });
      this.bankAccountStep = 0; // Reset
      await this.conversationState.updateState(data.from, OnboardingState.WAITING_DOCUMENT);

      await this.evolutionApi.sendMessage({
        to: data.from,
        text: `✅ Dados bancários registrados!

**8️⃣ Documento do Responsável** (Opcional)
Você pode enviar uma foto/arquivo do documento do responsável (RG, CNH ou CNPJ) para verificação.

Ou digite "pular" para continuar sem enviar documento (pode enviar depois).`,
      });
    }
  }

  private async handleDocument(
    data: MessageData,
    conversation: OnboardingData
  ): Promise<void> {
    // Por enquanto, apenas aceita "pular" ou salva URL se houver
    // Em produção, isso viria de upload de arquivo via Evolution API
    const text = data.text.trim().toLowerCase();

    if (text === 'pular' || text === 'skip' || text === 'pular documento') {
      await this.handleSkipDocument(data, conversation);
      return;
    }

    // Se houver mediaUrl (foto/documento), salva
    if (data.mediaUrl) {
      await this.conversationState.updateData(data.from, { documentUrl: data.mediaUrl });
      // Busca conversação atualizada
      const updatedConversation = await this.conversationState.getConversation(data.from);
      if (updatedConversation) {
        await this.completeOnboardingWithPayment(data.from, updatedConversation);
      } else {
        await this.evolutionApi.sendMessage({
          to: data.from,
          text: '❌ Erro ao processar documento. Por favor, tente novamente.',
        });
      }
    } else {
      await this.evolutionApi.sendMessage({
        to: data.from,
        text: '📎 Para enviar o documento, envie uma foto ou arquivo.\n\nOu digite "pular" para continuar sem documento.',
      });
    }
  }

  private async handleSkipDocument(
    data: MessageData,
    conversation: OnboardingData
  ): Promise<void> {
    await this.completeOnboardingWithPayment(data.from, conversation);
  }

  private async completeOnboardingWithPayment(
    from: string,
    conversation: OnboardingData
  ): Promise<void> {
    try {
      // Valida campos obrigatórios
      if (!conversation.name || !conversation.address || !conversation.phone) {
        throw new Error('Missing required fields: name, address, phone');
      }

      if (!conversation.legalName || !conversation.cpfCnpj || !conversation.email || !conversation.bankAccount) {
        throw new Error('Missing required payment fields: legalName, cpfCnpj, email, bankAccount');
      }

      const phone = Phone.create(conversation.phone);

      // Verifica se já existe restaurante com esse telefone (idempotência)
      const existing = await this.restaurantRepository.findByPhone(phone);
      if (existing) {
        await this.evolutionApi.sendMessage({
          to: from,
          text: '❌ Já existe um restaurante cadastrado com este telefone. Por favor, use outro número.',
        });
        return;
      }

      // Cria restaurante com todos os dados
      const restaurant = Restaurant.create({
        name: conversation.name,
        phone,
        address: conversation.address,
        legalName: conversation.legalName,
        cpfCnpj: conversation.cpfCnpj,
        email: conversation.email,
        bankAccount: conversation.bankAccount,
        documentUrl: conversation.documentUrl,
        isActive: true,
      });

      // Salva restaurante primeiro
      const saved = await this.restaurantRepository.save(restaurant);

      // Cria subconta no provedor de pagamento (se serviço disponível)
      if (this.paymentAccountService) {
        await this.conversationState.updateState(from, OnboardingState.CREATING_PAYMENT_ACCOUNT);

        await this.evolutionApi.sendMessage({
          to: from,
          text: '⏳ Estamos criando sua conta de pagamento. Isso pode levar alguns segundos...',
        });

        try {
          const paymentAccountResponse = await this.paymentAccountService.createSubAccount({
            legalName: conversation.legalName,
            cpfCnpj: conversation.cpfCnpj,
            email: conversation.email,
            phone: conversation.phone,
            name: conversation.name,
            bankAccount: conversation.bankAccount,
            documentUrl: conversation.documentUrl,
          });

          // Atualiza restaurante com paymentAccountId
          saved.setPaymentAccountId(paymentAccountResponse.accountId);
          await this.restaurantRepository.save(saved);

          logger.info('Payment account created successfully', {
            restaurantId: saved.getId(),
            paymentAccountId: paymentAccountResponse.accountId,
            status: paymentAccountResponse.status,
          });

          await this.conversationState.clearConversation(from);
          await this.conversationState.updateState(from, OnboardingState.COMPLETED);

          await this.evolutionApi.sendMessage({
            to: from,
            text: `✅ Restaurante cadastrado com sucesso!

📋 Dados cadastrados:
• Nome: ${saved.getName()}
• Razão Social: ${saved.getLegalName()}
• CPF/CNPJ: ${saved.getCpfCnpj()}
• Endereço: ${saved.getAddress()}
• Telefone: ${saved.getPhone().getFormatted()}
• E-mail: ${saved.getEmail()}

💰 Conta de Pagamento: ${paymentAccountResponse.status === 'approved' ? '✅ Aprovada' : '⏳ Pendente de aprovação'}

Agora você pode:
• Receber pagamentos de clientes
• Gerenciar pedidos
• Atualizar estoque
• Ver pedidos pendentes

Digite "ajuda" para ver todos os comandos disponíveis! 🎉`,
          });
        } catch (paymentError: any) {
          logger.error('Error creating payment account', {
            error: paymentError.message,
            restaurantId: saved.getId(),
          });

          // Ainda completa onboarding mesmo se falhar criação de subconta
          // (pode ser criada depois)
          await this.conversationState.clearConversation(from);
          await this.conversationState.updateState(from, OnboardingState.COMPLETED);

          await this.evolutionApi.sendMessage({
            to: from,
            text: `⚠️ Restaurante cadastrado, mas houve um problema ao criar a conta de pagamento.

📋 Dados cadastrados:
• Nome: ${saved.getName()}
• Endereço: ${saved.getAddress()}
• Telefone: ${saved.getPhone().getFormatted()}

❌ Erro ao criar conta de pagamento: ${paymentError.message}

Por favor, entre em contato com o suporte para configurar sua conta de pagamento.
Você ainda pode usar o sistema, mas não poderá receber pagamentos até configurar a conta.`,
          });
        }
      } else {
        // Sem serviço de pagamento, completa onboarding normalmente
        await this.conversationState.clearConversation(from);
        await this.conversationState.updateState(from, OnboardingState.COMPLETED);

        await this.evolutionApi.sendMessage({
          to: from,
          text: `✅ Restaurante cadastrado com sucesso!

📋 Dados cadastrados:
• Nome: ${saved.getName()}
• Endereço: ${saved.getAddress()}
• Telefone: ${saved.getPhone().getFormatted()}

⚠️ Serviço de pagamento não configurado. Entre em contato com o suporte para configurar sua conta de pagamento.

Digite "ajuda" para ver todos os comandos disponíveis! 🎉`,
        });
      }
    } catch (error: any) {
      logger.error('Error completing restaurant onboarding', {
        error: error.message,
        from,
      });

      await this.evolutionApi.sendMessage({
        to: from,
        text: `❌ Erro ao finalizar cadastro: ${error.message}

Por favor, tente novamente ou digite "cancelar" para sair.`,
      });
    }
  }
}
