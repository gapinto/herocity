import { Router } from 'express';
import { WhatsAppController } from '../../application/controllers/WhatsAppController';
import { metricsService } from '../../application/services/MetricsService';
import { IRestaurantRepository } from '../../domain/repositories/IRestaurantRepository';

/**
 * @swagger
 * /api/webhook/whatsapp:
 *   post:
 *     summary: Webhook da Evolution API
 *     description: Recebe mensagens do WhatsApp via Evolution API
 *     tags: [WhatsApp]
 */
export function createRoutes(
  whatsAppController: WhatsAppController,
  restaurantRepository?: IRestaurantRepository
): Router {
  const router = Router();

  router.post('/webhook/whatsapp', (req, res) => whatsAppController.webhook(req, res));

  /**
   * @swagger
   * /api/health:
   *   get:
   *     summary: Health check
   *     description: Verifica se a API está funcionando
   *     tags: [Health]
   */
  router.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  /**
   * @swagger
   * /api/metrics:
   *   get:
   *     summary: Métricas do sistema
   *     description: Retorna métricas coletadas pelo sistema
   *     tags: [Metrics]
   */
  router.get('/metrics', (_req, res) => {
    const metrics = metricsService.getAllMetrics();
    res.json({
      metrics,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * @swagger
   * /api/qr-code/{restaurantId}:
   *   get:
   *     summary: Gera QR code para restaurante
   *     description: Retorna texto para gerar QR code na mesa do restaurante
   *     tags: [QR Code]
   *     parameters:
   *       - in: path
   *         name: restaurantId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID do restaurante
   */
  router.get('/qr-code/:restaurantId', async (req, res) => {
    try {
      const { restaurantId } = req.params;

      if (!restaurantRepository) {
        return res.status(503).json({ error: 'Restaurant repository not available' });
      }

      const restaurant = await restaurantRepository.findById(restaurantId);
      if (!restaurant) {
        return res.status(404).json({ error: 'Restaurant not found' });
      }

      if (!restaurant.isActive()) {
        return res.status(400).json({ error: 'Restaurant is not active' });
      }

      // Formato do QR code: pedido:restaurantId
      const qrCodeText = `pedido:${restaurantId}`;
      const whatsappNumber = process.env.WHATSAPP_NUMBER || '5511999999999';
      const whatsappLink = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(qrCodeText)}`;

      res.json({
        restaurantId,
        restaurantName: restaurant.getName(),
        qrCodeText,
        whatsappLink,
        instructions: 'Escaneie este QR code com seu WhatsApp para fazer um pedido diretamente!',
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}

