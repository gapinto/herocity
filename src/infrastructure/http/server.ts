import express from 'express';
import { createRoutes } from './routes';
import { createPaymentWebhookRoutes } from './paymentWebhooks';
import { setupSwagger } from './swagger';
import { WhatsAppController } from '../../application/controllers/WhatsAppController';
import { IRestaurantRepository } from '../../domain/repositories/IRestaurantRepository';
import { IPaymentService } from '../../domain/services/IPaymentService';
import { IOrderRepository } from '../../domain/repositories/IOrderRepository';
import { IIdempotencyService } from '../../domain/services/IIdempotencyService';
import { NotificationService } from '../../application/services/NotificationService';
import { env } from '../../shared/utils/env';
import { logger } from '../../shared/utils/logger';

interface ServerDependencies {
  paymentService?: IPaymentService;
  orderRepository?: IOrderRepository;
  notificationService?: NotificationService;
  idempotencyService?: IIdempotencyService;
}

export function createServer(
  whatsAppController: WhatsAppController,
  restaurantRepository?: IRestaurantRepository,
  dependencies?: ServerDependencies
): express.Application {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Swagger
  setupSwagger(app);

  const routes = createRoutes(whatsAppController, restaurantRepository);
  app.use('/api', routes);

  // Payment webhook routes
  if (dependencies?.paymentService && dependencies?.orderRepository && dependencies?.notificationService) {
    const paymentWebhookRoutes = createPaymentWebhookRoutes(
      dependencies.paymentService,
      dependencies.orderRepository,
      dependencies.notificationService,
      dependencies.idempotencyService
    );
    app.use('/api', paymentWebhookRoutes);
  }

  return app;
}

export function startServer(app: express.Application): void {
  const port = env.PORT;

  app.listen(port, () => {
    logger.info(`Server running on port ${port}`);
  });
}

