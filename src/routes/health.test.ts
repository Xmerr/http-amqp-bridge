import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { healthRoutes } from './health.js';
import type { AmqpService } from '../services/index.js';

describe('healthRoutes', () => {
  let mockAmqpService: {
    isConnected: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockAmqpService = {
      isConnected: vi.fn(),
    };
  });

  it('should return healthy status when connected', async () => {
    mockAmqpService.isConnected.mockReturnValue(true);
    const fastify = Fastify();
    await fastify.register(healthRoutes, { amqpService: mockAmqpService as unknown as AmqpService });

    const response = await fastify.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe('healthy');
    expect(body.checks.amqp).toBe('connected');
    expect(body.timestamp).toBeDefined();
  });

  it('should return unhealthy status when disconnected', async () => {
    mockAmqpService.isConnected.mockReturnValue(false);
    const fastify = Fastify();
    await fastify.register(healthRoutes, { amqpService: mockAmqpService as unknown as AmqpService });

    const response = await fastify.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(503);
    const body = JSON.parse(response.body);
    expect(body.status).toBe('unhealthy');
    expect(body.checks.amqp).toBe('disconnected');
  });

  it('should include ISO timestamp in response', async () => {
    mockAmqpService.isConnected.mockReturnValue(true);
    const fastify = Fastify();
    await fastify.register(healthRoutes, { amqpService: mockAmqpService as unknown as AmqpService });

    const response = await fastify.inject({
      method: 'GET',
      url: '/health',
    });

    const body = JSON.parse(response.body);
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
  });
});
