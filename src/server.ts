import Fastify, { type FastifyInstance } from 'fastify';
import type { Config } from './config.js';
import { AmqpService } from './services/index.js';
import { healthRoutes, publishRoutes } from './routes/index.js';
import { BridgeError } from './errors/index.js';

declare module 'fastify' {
  interface FastifyRequest {
    rawBody?: Buffer;
  }
}

export interface ServerContext {
  fastify: FastifyInstance;
  amqpService: AmqpService;
}

export async function createServer(config: Config): Promise<ServerContext> {
  const fastify = Fastify({
    logger: {
      level: 'info',
    },
  });

  // Add raw body parsing for webhook signature validation
  fastify.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (request, payload, done) => {
      request.rawBody = payload as Buffer;
      try {
        const json = JSON.parse(payload.toString()) as unknown;
        done(null, json);
      } catch (err) {
        done(err as Error, undefined);
      }
    }
  );

  // Error handler
  fastify.setErrorHandler((error, request, reply) => {
    if (error instanceof BridgeError) {
      return reply.status(error.statusCode).send(error.toJSON());
    }

    request.log.error(error);
    return reply.status(500).send({
      error: 'InternalServerError',
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    });
  });

  // Initialize AMQP service
  const amqpService = new AmqpService(config.amqpUrl);
  await amqpService.connect();

  // Register routes
  await fastify.register(healthRoutes, { amqpService });
  await fastify.register(publishRoutes, {
    amqpService,
    githubWebhookSecret: config.githubWebhookSecret,
  });

  return { fastify, amqpService };
}
