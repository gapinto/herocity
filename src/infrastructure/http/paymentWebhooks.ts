import { Router, Request, Response } from 'express';
import { IPaymentService } from '../../domain/services/IPaymentService';
import { IIdempotencyService } from '../../domain/services/IIdempotencyService';
import { IOrderRepository } from '../../domain/repositories/IOrderRepository';
import { NotificationService } from '../../application/services/NotificationService';
import { OrderStatus } from '../../domain/enums/OrderStatus';
import { Price } from '../../domain/value-objects/Price';
import { logger } from '../../shared/utils/logger';

export function createPaymentWebhookRoutes(
  paymentService: IPaymentService,
  orderRepository: IOrderRepository,
  notificationService: NotificationService,
  idempotencyService?: IIdempotencyService
): Router {
  const router = Router();

  /**
   * Webhook Asaas
   * Processa eventos de pagamento do Asaas
   */
  router.post('/webhooks/asaas', async (req: Request, res: Response) => {
    try {
      const event = req.body;
      const eventId = event.id || event.event;

      // Idempotência: verifica se evento já foi processado
      const idempotencyKey = eventId ? `webhook:asaas:${eventId}` : undefined;
      if (idempotencyKey && idempotencyService) {
        const isProcessed = await idempotencyService.isProcessed(idempotencyKey);
        
        if (isProcessed) {
          logger.info('Asaas webhook already processed (idempotent)', { eventId, event: event.event });
          return res.status(200).json({ received: true, duplicate: true });
        }
      }

      // Processa apenas eventos de pagamento confirmado
      if (event.event === 'PAYMENT_CONFIRMED' || event.event === 'PAYMENT_RECEIVED') {
        const paymentId = event.payment?.id || event.paymentId;

        if (!paymentId) {
          logger.warn('Asaas webhook missing payment ID', { event });
          return res.status(400).json({ error: 'Missing payment ID' });
        }

        // Idempotência por paymentId (mais confiável que eventId)
        const paymentIdempotencyKey = `payment:confirm:${paymentId}`;
        if (idempotencyService) {
          const isProcessed = await idempotencyService.isProcessed(paymentIdempotencyKey);
          if (isProcessed) {
            logger.info('Payment already confirmed (idempotent)', { paymentId });
            return res.status(200).json({ received: true, alreadyConfirmed: true });
          }
        }

        // Busca order pelo paymentId (idempotente)
        const order = await orderRepository.findByPaymentId(paymentId);

        if (!order) {
          // Busca por orderId extraído do paymentId (se houver)
          // Se não encontrar, pode ser pagamento de outro sistema ou erro
          logger.warn('Order not found for payment', { paymentId });
          // Marca evento como processado mesmo assim (evita reprocessar)
          if (idempotencyKey && idempotencyService) {
            await idempotencyService.markAsProcessed(idempotencyKey, 86400);
          }
          return res.status(404).json({ error: 'Order not found' });
        }

        // Verifica se já está pago (idempotência adicional no banco)
        if (order.getStatus() === OrderStatus.PAID) {
          logger.info('Order already paid (idempotent)', { orderId: order.getId(), paymentId });
          // Marca como processado
          if (idempotencyKey && idempotencyService) {
            await idempotencyService.markAsProcessed(idempotencyKey, 86400);
          }
          if (idempotencyService) {
            await idempotencyService.markAsProcessed(paymentIdempotencyKey, 86400);
          }
          return res.status(200).json({ received: true, alreadyPaid: true });
        }

        // Confirma pagamento (idempotente internamente)
        const confirmation = await paymentService.confirmPayment(paymentId);

        // Atualiza order (com verificação de status antes)
        if (order.getStatus() !== OrderStatus.PAID) {
          order.confirmPayment(
            confirmation.paymentId,
            confirmation.platformFee ? Price.create(confirmation.platformFee / 100) : Price.create(0),
            confirmation.restaurantAmount ? Price.create(confirmation.restaurantAmount / 100) : order.getTotal()
          );

          await orderRepository.save(order);

          // AGORA SIM: Notifica cozinha (idempotente também)
          await notificationService.notifyOrderCreated(order);
        }

        // Marca como processado DEPOIS de processar com sucesso
        if (idempotencyKey && idempotencyService) {
          await idempotencyService.markAsProcessed(idempotencyKey, 86400);
        }
        if (idempotencyService) {
          await idempotencyService.markAsProcessedWithResult(paymentIdempotencyKey, confirmation, 86400);
        }

        logger.info('Payment confirmed and order updated', {
          orderId: order.getId(),
          paymentId,
          amount: confirmation.amount,
        });
      } else {
        // Marca eventos não processados como vistos (evita reprocessar)
        if (idempotencyKey && idempotencyService) {
          await idempotencyService.markAsProcessed(idempotencyKey, 3600); // 1 hora para eventos não relevantes
        }
      }

      res.status(200).json({ received: true });
    } catch (error: any) {
      logger.error('Error processing Asaas webhook', { error: error.message, body: req.body });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * Webhook Stripe
   * Processa eventos de pagamento do Stripe
   */
  router.post('/webhooks/stripe', async (req: Request, res: Response) => {
    try {
      const event = req.body;
      const eventId = event.id;

      // Idempotência: verifica se evento já foi processado
      const idempotencyKey = eventId ? `webhook:stripe:${eventId}` : undefined;
      if (idempotencyKey && idempotencyService) {
        const isProcessed = await idempotencyService.isProcessed(idempotencyKey);
        
        if (isProcessed) {
          logger.info('Stripe webhook already processed (idempotent)', { eventId, type: event.type });
          return res.status(200).json({ received: true, duplicate: true });
        }
      }

      // Processa apenas payment_intent.succeeded
      if (event.type === 'payment_intent.succeeded') {
        const paymentId = event.data?.object?.id;

        if (!paymentId) {
          logger.warn('Stripe webhook missing payment ID', { event });
          if (idempotencyKey && idempotencyService) {
            await idempotencyService.markAsProcessed(idempotencyKey, 3600);
          }
          return res.status(400).json({ error: 'Missing payment ID' });
        }

        // Idempotência por paymentId (mais confiável que eventId)
        const paymentIdempotencyKey = `payment:confirm:${paymentId}`;
        if (idempotencyService) {
          const isProcessed = await idempotencyService.isProcessed(paymentIdempotencyKey);
          if (isProcessed) {
            logger.info('Payment already confirmed (idempotent)', { paymentId });
            if (idempotencyKey) {
              await idempotencyService.markAsProcessed(idempotencyKey, 86400);
            }
            return res.status(200).json({ received: true, alreadyConfirmed: true });
          }
        }

        // Busca order pelo paymentId (idempotente)
        const order = await orderRepository.findByPaymentId(paymentId);

        if (!order) {
          logger.warn('Order not found for payment', { paymentId });
          if (idempotencyKey && idempotencyService) {
            await idempotencyService.markAsProcessed(idempotencyKey, 86400);
          }
          return res.status(404).json({ error: 'Order not found' });
        }

        // Verifica se já está pago (idempotência adicional no banco)
        if (order.getStatus() === OrderStatus.PAID) {
          logger.info('Order already paid (idempotent)', { orderId: order.getId(), paymentId });
          if (idempotencyKey && idempotencyService) {
            await idempotencyService.markAsProcessed(idempotencyKey, 86400);
          }
          if (idempotencyService) {
            await idempotencyService.markAsProcessed(paymentIdempotencyKey, 86400);
          }
          return res.status(200).json({ received: true, alreadyPaid: true });
        }

        // Confirma pagamento (idempotente internamente)
        const confirmation = await paymentService.confirmPayment(paymentId);

        // Atualiza order (com verificação de status antes)
        if (order.getStatus() !== OrderStatus.PAID) {
          order.confirmPayment(
            confirmation.paymentId,
            confirmation.platformFee ? Price.create(confirmation.platformFee / 100) : Price.create(0),
            confirmation.restaurantAmount ? Price.create(confirmation.restaurantAmount / 100) : order.getTotal()
          );

          await orderRepository.save(order);

          // AGORA SIM: Notifica cozinha (idempotente também)
          await notificationService.notifyOrderCreated(order);
        }

        // Marca como processado DEPOIS de processar com sucesso
        if (idempotencyKey && idempotencyService) {
          await idempotencyService.markAsProcessed(idempotencyKey, 86400);
        }
        if (idempotencyService) {
          await idempotencyService.markAsProcessedWithResult(paymentIdempotencyKey, confirmation, 86400);
        }

        logger.info('Payment confirmed and order updated', {
          orderId: order.getId(),
          paymentId,
          amount: confirmation.amount,
        });
      } else {
        // Marca eventos não processados como vistos
        if (idempotencyKey && idempotencyService) {
          await idempotencyService.markAsProcessed(idempotencyKey, 3600);
        }
      }

      res.status(200).json({ received: true });
    } catch (error: any) {
      logger.error('Error processing Stripe webhook', { error: error.message, body: req.body });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}
