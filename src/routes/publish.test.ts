import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { publishRoutes } from './publish.js';
import type { AmqpService } from '../services/index.js';

describe('publishRoutes', () => {
  let mockAmqpService: {
    publish: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockAmqpService = {
      publish: vi.fn(),
    };
  });

  it('should publish message successfully', async () => {
    mockAmqpService.publish.mockResolvedValue({
      success: true,
      messageId: 'msg-123',
      exchange: 'test-exchange',
      routingKey: 'test.key',
    });

    const fastify = Fastify();
    await fastify.register(publishRoutes, {
      amqpService: mockAmqpService as unknown as AmqpService,
      githubWebhookSecret: undefined,
    });

    const response = await fastify.inject({
      method: 'POST',
      url: '/publish/test-exchange/test.key',
      payload: { data: 'test' },
      headers: {
        'content-type': 'application/json',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.messageId).toBe('msg-123');
    expect(mockAmqpService.publish).toHaveBeenCalledWith(
      'test-exchange',
      'test.key',
      expect.any(String)
    );
  });

  it('should use raw body when available', async () => {
    mockAmqpService.publish.mockResolvedValue({
      success: true,
      messageId: 'msg-456',
      exchange: 'events',
      routingKey: 'github.push',
    });

    const fastify = Fastify();

    // Add raw body parser like in server.ts
    fastify.addContentTypeParser(
      'application/json',
      { parseAs: 'buffer' },
      (request, payload, done) => {
        (request as { rawBody?: Buffer }).rawBody = payload as Buffer;
        try {
          const json = JSON.parse(payload.toString()) as unknown;
          done(null, json);
        } catch (err) {
          done(err as Error, undefined);
        }
      }
    );

    await fastify.register(publishRoutes, {
      amqpService: mockAmqpService as unknown as AmqpService,
      githubWebhookSecret: undefined,
    });

    const response = await fastify.inject({
      method: 'POST',
      url: '/publish/events/github.push',
      payload: '{"event": "push"}',
      headers: {
        'content-type': 'application/json',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(mockAmqpService.publish).toHaveBeenCalledWith(
      'events',
      'github.push',
      expect.any(Buffer)
    );
  });

  it('should pass webhook secret to validation middleware', async () => {
    mockAmqpService.publish.mockResolvedValue({
      success: true,
      messageId: 'msg-789',
      exchange: 'exchange',
      routingKey: 'key',
    });

    const fastify = Fastify();
    await fastify.register(publishRoutes, {
      amqpService: mockAmqpService as unknown as AmqpService,
      githubWebhookSecret: 'secret123',
    });

    // Without valid signature, should fail
    const response = await fastify.inject({
      method: 'POST',
      url: '/publish/exchange/key',
      payload: { data: 'test' },
      headers: {
        'content-type': 'application/json',
      },
    });

    expect(response.statusCode).toBe(401);
  });
});
