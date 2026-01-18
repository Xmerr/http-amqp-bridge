import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { AmqpService } from '../services/index.js';
import type { PublishParams, PublishResponse } from '../types/index.js';
import { createWebhookValidation } from '../middleware/index.js';

interface PublishOptions {
  amqpService: AmqpService;
  githubWebhookSecret: string | undefined;
}

export async function publishRoutes(fastify: FastifyInstance, options: PublishOptions): Promise<void> {
  const { amqpService, githubWebhookSecret } = options;
  const validateWebhook = createWebhookValidation(githubWebhookSecret);

  fastify.post<{
    Params: PublishParams;
    Reply: PublishResponse;
  }>('/publish/:exchange/:routingKey', {
    preHandler: validateWebhook,
  }, async (request: FastifyRequest<{ Params: PublishParams }>, reply) => {
    const { exchange, routingKey } = request.params;
    const body = request.rawBody ?? JSON.stringify(request.body);

    const result = await amqpService.publish(exchange, routingKey, body);

    return reply.status(200).send(result);
  });
}
