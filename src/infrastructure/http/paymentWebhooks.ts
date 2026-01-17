import { Router, Request, Response } from 'express';
import { IPaymentService } from '../../domain/services/IPaymentService';
import { IIdempotencyService } from '../../domain/services/IIdempotencyService';
import { IOrderRepository } from '../../domain/repositories/IOrderRepository';
import { IRestaurantRepository } from '../../domain/repositories/IRestaurantRepository';
import { NotificationService } from '../../application/services/NotificationService';
import { OrderStatus } from '../../domain/enums/OrderStatus';
import { Price } from '../../domain/value-objects/Price';
import { logger } from '../../shared/utils/logger';

export function createPaymentWebhookRoutes(
  paymentService: IPaymentService,
  orderRepository: IOrderRepository,
  notificationService: NotificationService,
  restaurantRepository: IRestaurantRepository,
  idempotencyService?: IIdempotencyService
): Router {
  const router = Router();

  /**
   * Webhook Asaas
   * Processa eventos de pagamento do Asaas
   */
  router.post('/webhooks/asaas/:restaurantId', async (req: Request, res: Response) => {
    try {
      const { restaurantId } = req.params;
      const webhookToken = req.headers['asaas-access-token'];

      if (!restaurantId) {
        return res.status(400).json({ error: 'Missing restaurantId' });
      }

      if (!webhookToken || Array.isArray(webhookToken)) {
        return res.status(401).json({ error: 'Missing webhook token' });
      }

      const restaurant = await restaurantRepository.findById(restaurantId);
      if (!restaurant || !restaurant.getPaymentWebhookToken()) {
        return res.status(404).json({ error: 'Restaurant webhook not configured' });
      }

      if (restaurant.getPaymentWebhookToken() !== webhookToken) {
        return res.status(403).json({ error: 'Invalid webhook token' });
      }

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

      // Processa eventos de pagamento confirmado
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
          await notificationService.notifyOrderStatusChanged(order, OrderStatus.PAID);

          await notificationService.notifyRestaurant(
            order.getRestaurantId(),
            `💳 Pagamento confirmado para o pedido #${order.getId().slice(0, 8)}.`
          );
        }

        // Marca como processado DEPOIS de processar com sucesso
        if (idempotencyKey && idempotencyService) {
          await idempotencyService.markAsProcessed(idempotencyKey, 86400);
        }
        if (idempotencyService) {
          await idempotencyService.markAsProcessed(paymentIdempotencyKey, 86400, confirmation);
        }

        logger.info('Payment confirmed and order updated', {
          orderId: order.getId(),
          paymentId,
          amount: confirmation.amount,
        });
        
        return res.status(200).json({ received: true });
      } else if (event.event && event.event.startsWith('PAYMENT_SPLIT_')) {
        const paymentId = event.payment?.id || event.paymentId;
        if (!paymentId) {
          logger.warn('Asaas split webhook missing payment ID', { event });
          return res.status(400).json({ error: 'Missing payment ID' });
        }

        const order = await orderRepository.findByPaymentId(paymentId);
        if (!order) {
          logger.warn('Order not found for split payment', { paymentId });
          if (idempotencyKey && idempotencyService) {
            await idempotencyService.markAsProcessed(idempotencyKey, 86400);
          }
          return res.status(404).json({ error: 'Order not found' });
        }

        const orderId = order.getId().slice(0, 8);
        const customerMessages: Record<string, string> = {
          PAYMENT_SPLIT_DONE: `✅ Pagamento confirmado e repasse concluído para o pedido #${orderId}.`,
          PAYMENT_SPLIT_REFUSED: `⚠️ O repasse do pagamento foi recusado para o pedido #${orderId}. Nossa equipe vai verificar.`,
          PAYMENT_SPLIT_CANCELLED: `⚠️ O repasse do pagamento foi cancelado para o pedido #${orderId}.`,
          PAYMENT_SPLIT_REFUNDED: `⚠️ O repasse do pagamento foi estornado para o pedido #${orderId}.`,
          PAYMENT_SPLIT_DIVERGENCE_BLOCK: `⚠️ O pagamento do pedido #${orderId} foi bloqueado por divergência no repasse. Estamos tratando.`,
          PAYMENT_SPLIT_DIVERGENCE_BLOCK_FINISHED: `✅ O bloqueio do pagamento do pedido #${orderId} foi resolvido.`,
        };

        const restaurantMessages: Record<string, string> = {
          PAYMENT_SPLIT_DONE: `✅ Split concluído para o pedido #${orderId}. Repasse liberado.`,
          PAYMENT_SPLIT_REFUSED: `⚠️ Split recusado para o pedido #${orderId}. Verifique sua conta de pagamento.`,
          PAYMENT_SPLIT_CANCELLED: `⚠️ Split cancelado para o pedido #${orderId}.`,
          PAYMENT_SPLIT_REFUNDED: `⚠️ Split estornado para o pedido #${orderId}.`,
          PAYMENT_SPLIT_DIVERGENCE_BLOCK: `⚠️ Split bloqueado por divergência no pedido #${orderId}. Ajuste necessário.`,
          PAYMENT_SPLIT_DIVERGENCE_BLOCK_FINISHED: `✅ Bloqueio de split resolvido para o pedido #${orderId}.`,
        };

        const customerMessage =
          customerMessages[event.event] || `Atualização de repasse do pagamento para o pedido #${orderId}.`;
        const restaurantMessage =
          restaurantMessages[event.event] || `Atualização de split para o pedido #${orderId}.`;

        await notificationService.notifyCustomer(order.getCustomerId(), customerMessage);
        await notificationService.notifyRestaurant(order.getRestaurantId(), restaurantMessage);

        if (idempotencyKey && idempotencyService) {
          await idempotencyService.markAsProcessed(idempotencyKey, 86400);
        }

        return res.status(200).json({ received: true });
      } else {
        // Marca eventos não processados como vistos (evita reprocessar)
        if (idempotencyKey && idempotencyService) {
          await idempotencyService.markAsProcessed(idempotencyKey, 3600); // 1 hora para eventos não relevantes
        }
        return res.status(200).json({ received: true });
      }
    } catch (error: any) {
      logger.error('Error processing Asaas webhook', { error: error.message, body: req.body });
      return res.status(500).json({ error: 'Internal server error' });
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
          await idempotencyService.markAsProcessed(paymentIdempotencyKey, 86400, confirmation);
        }

        logger.info('Payment confirmed and order updated', {
          orderId: order.getId(),
          paymentId,
          amount: confirmation.amount,
        });
        
        return res.status(200).json({ received: true });
      } else {
        // Marca eventos não processados como vistos
        if (idempotencyKey && idempotencyService) {
          await idempotencyService.markAsProcessed(idempotencyKey, 3600);
        }
        return res.status(200).json({ received: true });
      }
    } catch (error: any) {
      logger.error('Error processing Stripe webhook', { error: error.message, body: req.body });
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}
