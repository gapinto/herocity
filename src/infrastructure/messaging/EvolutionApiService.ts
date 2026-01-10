import axios, { AxiosInstance } from 'axios';
import { env } from '../../shared/utils/env';
import { logger } from '../../shared/utils/logger';

export interface SendMessageInput {
  to: string;
  text: string;
  mediaUrl?: string;
}

export interface SendMessageOutput {
  success: boolean;
  messageId?: string;
}

export class EvolutionApiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: env.EVOLUTION_API_URL,
      headers: {
        'Content-Type': 'application/json',
        apikey: env.EVOLUTION_API_KEY,
      },
    });
  }

  async sendMessage(input: SendMessageInput): Promise<SendMessageOutput> {
    try {
      const response = await this.client.post(
        `/message/sendText/${env.EVOLUTION_INSTANCE_NAME}`,
        {
          number: input.to,
          text: input.text,
          ...(input.mediaUrl && { mediaUrl: input.mediaUrl }),
        }
      );

      logger.info('Message sent successfully', { to: input.to });

      return {
        success: true,
        messageId: response.data?.key?.id,
      };
    } catch (error: any) {
      logger.error('Error sending message', {
        error: error.message,
        to: input.to,
      });
      throw new Error(`Failed to send message: ${error.message}`);
    }
  }
}

