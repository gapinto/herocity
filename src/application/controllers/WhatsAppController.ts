import { Request, Response } from 'express';
import { OrchestrationService, EvolutionWebhook } from '../services/OrchestrationService';
import { logger } from '../../shared/utils/logger';

export class WhatsAppController {
  constructor(private readonly orchestrationService: OrchestrationService) {}

  async webhook(req: Request, res: Response): Promise<void> {
    try {
      const webhook: EvolutionWebhook = req.body;

      // Processa webhook de forma assíncrona
      this.orchestrationService.handleWebhook(webhook).catch((error) => {
        logger.error('Error handling WhatsApp webhook', {
          error: error.message,
        });
      });

      // Responde imediatamente para Evolution API
      res.status(200).json({ received: true });
    } catch (error: any) {
      logger.error('Error processing webhook', { error: error.message });
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

