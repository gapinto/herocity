import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'HeroCity API',
      version: '1.0.0',
      description: 'API para sistema de pedidos de restaurante via WhatsApp',
      contact: {
        name: 'HeroCity',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
    ],
    paths: {
      '/api/webhook/whatsapp': {
        post: {
          summary: 'Webhook da Evolution API',
          description: 'Recebe mensagens do WhatsApp via Evolution API',
          tags: ['WhatsApp'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    event: {
                      type: 'string',
                      example: 'messages.upsert',
                    },
                    data: {
                      type: 'object',
                      properties: {
                        key: {
                          type: 'object',
                          properties: {
                            remoteJid: {
                              type: 'string',
                              example: '5511999999999@s.whatsapp.net',
                            },
                            fromMe: {
                              type: 'boolean',
                              example: false,
                            },
                            pushName: {
                              type: 'string',
                              example: 'João Silva',
                            },
                          },
                        },
                        message: {
                          type: 'object',
                          properties: {
                            conversation: {
                              type: 'string',
                              example: 'Olá',
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Webhook recebido com sucesso',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      received: {
                        type: 'boolean',
                        example: true,
                      },
                    },
                  },
                },
              },
            },
            '500': {
              description: 'Erro interno do servidor',
            },
          },
        },
      },
      '/api/health': {
        get: {
          summary: 'Health check',
          description: 'Verifica se a API está funcionando',
          tags: ['Health'],
          responses: {
            '200': {
              description: 'API está funcionando',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      status: {
                        type: 'string',
                        example: 'ok',
                      },
                      timestamp: {
                        type: 'string',
                        example: '2026-01-09T12:00:00.000Z',
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  apis: ['./src/infrastructure/http/routes.ts'],
};

const swaggerSpec = swaggerJsdoc(options);

export function setupSwagger(app: Express): void {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

