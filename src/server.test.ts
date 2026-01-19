import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createServer } from './server.js';
import { BridgeError } from './errors/index.js';
import type { Config } from './config.js';

vi.mock('amqplib', () => ({
  default: {
    connect: vi.fn(),
  },
}));

import amqplib from 'amqplib';

describe('createServer', () => {
  let mockConnection: {
    createChannel: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
  };
  let mockChannel: {
    assertExchange: ReturnType<typeof vi.fn>;
    publish: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
  };
  let config: Config;

  beforeEach(() => {
    vi.clearAllMocks();

    mockChannel = {
      assertExchange: vi.fn().mockResolvedValue({}),
      publish: vi.fn().mockReturnValue(true),
      close: vi.fn().mockResolvedValue(undefined),
    };

    mockConnection = {
      createChannel: vi.fn().mockResolvedValue(mockChannel),
      on: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
    };

    vi.mocked(amqplib.connect).mockResolvedValue(mockConnection as never);

    config = {
      port: 3000,
      amqpUrl: 'amqp://localhost:5672',
      githubWebhookSecret: undefined,
    };
  });

  afterEach(async () => {
    vi.clearAllMocks();
  });

  it('should create server with fastify and amqpService', async () => {
    const { fastify, amqpService } = await createServer(config);

    expect(fastify).toBeDefined();
    expect(amqpService).toBeDefined();
    expect(amqpService.isConnected()).toBe(true);

    await fastify.close();
    await amqpService.close();
  });

  it('should parse raw body for JSON content', async () => {
    const { fastify, amqpService } = await createServer(config);

    const response = await fastify.inject({
      method: 'POST',
      url: '/publish/exchange/key',
      payload: '{"test": "data"}',
      headers: {
        'content-type': 'application/json',
      },
    });

    expect(response.statusCode).toBe(200);

    await fastify.close();
    await amqpService.close();
  });

  it('should handle invalid JSON in request body', async () => {
    const { fastify, amqpService } = await createServer(config);

    const response = await fastify.inject({
      method: 'POST',
      url: '/publish/exchange/key',
      payload: 'not valid json',
      headers: {
        'content-type': 'application/json',
      },
    });

    // Fastify returns 500 for JSON parse errors in custom content type parsers
    expect(response.statusCode).toBe(500);

    await fastify.close();
    await amqpService.close();
  });

  it('should handle BridgeError in error handler', async () => {
    vi.mocked(amqplib.connect).mockResolvedValueOnce(mockConnection as never);
    mockChannel.assertExchange.mockRejectedValue(new Error('Test error'));

    const { fastify, amqpService } = await createServer(config);

    // The publish endpoint will throw a BridgeError when publish fails
    const response = await fastify.inject({
      method: 'POST',
      url: '/publish/exchange/key',
      payload: '{"test": "data"}',
      headers: {
        'content-type': 'application/json',
      },
    });

    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('BridgeError');
    expect(body.code).toBe('AMQP_PUBLISH_FAILED');

    await fastify.close();
    await amqpService.close();
  });

  it('should handle generic errors in error handler', async () => {
    const { fastify, amqpService } = await createServer(config);

    // Register a route that throws a generic error
    fastify.get('/test-error', async () => {
      throw new Error('Generic error');
    });

    const response = await fastify.inject({
      method: 'GET',
      url: '/test-error',
    });

    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('InternalServerError');
    expect(body.code).toBe('INTERNAL_ERROR');
    expect(body.message).toBe('An unexpected error occurred');

    await fastify.close();
    await amqpService.close();
  });

  it('should register health routes', async () => {
    const { fastify, amqpService } = await createServer(config);

    const response = await fastify.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);

    await fastify.close();
    await amqpService.close();
  });

  it('should register publish routes', async () => {
    const { fastify, amqpService } = await createServer(config);

    const response = await fastify.inject({
      method: 'POST',
      url: '/publish/exchange/key',
      payload: '{}',
      headers: {
        'content-type': 'application/json',
      },
    });

    expect(response.statusCode).toBe(200);

    await fastify.close();
    await amqpService.close();
  });

  it('should pass githubWebhookSecret to publish routes', async () => {
    config.githubWebhookSecret = 'secret123';
    const { fastify, amqpService } = await createServer(config);

    // Without valid signature, should fail
    const response = await fastify.inject({
      method: 'POST',
      url: '/publish/exchange/key',
      payload: '{}',
      headers: {
        'content-type': 'application/json',
      },
    });

    expect(response.statusCode).toBe(401);

    await fastify.close();
    await amqpService.close();
  });
});
