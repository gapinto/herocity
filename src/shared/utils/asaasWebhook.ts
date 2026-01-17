import crypto from 'crypto';
import { env } from './env';

export interface AsaasWebhookConfig {
  url: string;
  authToken: string;
}

export function createAsaasWebhookConfig(restaurantId: string): AsaasWebhookConfig {
  const baseUrl = process.env.ASAAS_WEBHOOK_BASE_URL || env.ASAAS_WEBHOOK_BASE_URL;
  if (!baseUrl) {
    throw new Error('ASAAS_WEBHOOK_BASE_URL not configured');
  }

  const authToken = crypto.randomBytes(24).toString('hex');
  const url = `${baseUrl}/api/webhooks/asaas/${restaurantId}`;

  return { url, authToken };
}
