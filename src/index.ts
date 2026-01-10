import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { createServer, startServer } from './infrastructure/http/server';
import { WhatsAppController } from './application/controllers/WhatsAppController';
import { OrchestrationService } from './application/services/OrchestrationService';
import { UserContextService } from './application/services/UserContextService';
import { IntentService } from './application/services/IntentService';
import { EvolutionApiService } from './infrastructure/messaging/EvolutionApiService';
import { DeepSeekService } from './infrastructure/ai/DeepSeekService';
import { RestaurantOnboardingHandler } from './application/handlers/RestaurantOnboardingHandler';
import { RestaurantManagementHandler } from './application/handlers/RestaurantManagementHandler';
import { CustomerOrdersHandler } from './application/handlers/CustomerOrdersHandler';
import { PrismaRestaurantRepository } from './infrastructure/database/PrismaRestaurantRepository';
import { PrismaCustomerRepository } from './infrastructure/database/PrismaCustomerRepository';
import { PrismaOrderRepository } from './infrastructure/database/PrismaOrderRepository';
import { PrismaMenuItemRepository } from './infrastructure/database/PrismaMenuItemRepository';
import { PrismaOrderItemRepository } from './infrastructure/database/PrismaOrderItemRepository';
import { CreateOrder } from './domain/usecases/CreateOrder';
import { CreateMenuItem } from './domain/usecases/CreateMenuItem';
import { UpdateMenuItem } from './domain/usecases/UpdateMenuItem';
import { NotificationService } from './application/services/NotificationService';
import { OrderStateServiceFactory } from './infrastructure/cache/OrderStateServiceFactory';
import { PaymentServiceFactory } from './infrastructure/payment/PaymentServiceFactory';
import { PaymentAccountServiceFactory } from './infrastructure/payment/PaymentAccountServiceFactory';
import { IdempotencyServiceFactory } from './infrastructure/cache/IdempotencyServiceFactory';
import { ActiveConversationServiceFactory } from './infrastructure/cache/ActiveConversationServiceFactory';
import { ConversationStateServiceFactory } from './infrastructure/cache/ConversationStateServiceFactory';
import { logger } from './shared/utils/logger';

async function main() {
  try {
    // Database
    const prisma = new PrismaClient();

    // Repositories
    const restaurantRepository = new PrismaRestaurantRepository(prisma);
    const customerRepository = new PrismaCustomerRepository(prisma);
    const orderRepository = new PrismaOrderRepository(prisma);
    const menuItemRepository = new PrismaMenuItemRepository(prisma);
    const orderItemRepository = new PrismaOrderItemRepository(prisma);

    // Services
    const evolutionApi = new EvolutionApiService();
    const deepSeekService = new DeepSeekService();
    const userContextService = new UserContextService(restaurantRepository, customerRepository);
    const intentService = new IntentService(deepSeekService, menuItemRepository, restaurantRepository);
    const notificationService = new NotificationService(
      evolutionApi,
      customerRepository,
      restaurantRepository
    );

    // Payment & State Services (via factories)
    const orderStateService = OrderStateServiceFactory.create();
    const idempotencyService = IdempotencyServiceFactory.create();
    const paymentService = PaymentServiceFactory.create(undefined, idempotencyService);
    const paymentAccountService = PaymentAccountServiceFactory.create();
    const activeConversationService = ActiveConversationServiceFactory.create();
    const conversationStateService = ConversationStateServiceFactory.create();

    // Use Cases
    const createOrder = new CreateOrder(
      orderRepository,
      menuItemRepository,
      restaurantRepository,
      orderItemRepository,
      idempotencyService
    );
    const updateMenuItem = new UpdateMenuItem(menuItemRepository);
    const createMenuItem = new CreateMenuItem(menuItemRepository, restaurantRepository);

    // Handlers
    const restaurantOnboardingHandler = new RestaurantOnboardingHandler(
      evolutionApi,
      restaurantRepository,
      conversationStateService,
      paymentAccountService
    );
    const restaurantManagementHandler = new RestaurantManagementHandler(
      evolutionApi,
      orderRepository,
      menuItemRepository,
      notificationService,
      updateMenuItem,
      createMenuItem
    );
    const customerOrdersHandler = new CustomerOrdersHandler(
      evolutionApi,
      orderRepository,
      menuItemRepository,
      restaurantRepository,
      createOrder,
      notificationService,
      orderStateService,
      paymentService
    );

    // Orchestration
    const orchestrationService = new OrchestrationService(
      userContextService,
      intentService,
      evolutionApi,
      restaurantOnboardingHandler,
      restaurantManagementHandler,
      customerOrdersHandler,
      activeConversationService,
      idempotencyService
    );

    // Controller
    const whatsAppController = new WhatsAppController(orchestrationService);

    // Server (with webhook routes)
    const app = createServer(whatsAppController, restaurantRepository, {
      paymentService,
      orderRepository,
      notificationService,
      idempotencyService,
    });
    startServer(app);

    logger.info('HeroCity application started');

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully');
      await prisma.$disconnect();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      logger.info('SIGINT received, shutting down gracefully');
      await prisma.$disconnect();
      process.exit(0);
    });
  } catch (error: any) {
    logger.error('Failed to start application', { error: error.message });
    process.exit(1);
  }
}

main();

