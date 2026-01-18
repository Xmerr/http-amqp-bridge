import type { FastifyInstance } from 'fastify';
import type { AmqpService } from '../services/index.js';
import type { HealthResponse } from '../types/index.js';

export async function healthRoutes(fastify: FastifyInstance, options: { amqpService: AmqpService }): Promise<void> {
  const { amqpService } = options;

  fastify.get<{ Reply: HealthResponse }>('/health', async (_request, reply) => {
    const isConnected = amqpService.isConnected();
    const status = isConnected ? 'healthy' : 'unhealthy';
    const statusCode = isConnected ? 200 : 503;

    return reply.status(statusCode).send({
      status,
      timestamp: new Date().toISOString(),
      checks: {
        amqp: isConnected ? 'connected' : 'disconnected',
      },
    });
  });
}
