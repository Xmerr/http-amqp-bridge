import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig } from './config.js';

describe('loadConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should load config with valid environment variables', () => {
    process.env.AMQP_URL = 'amqp://localhost:5672';
    process.env.PORT = '8080';
    process.env.GITHUB_WEBHOOK_SECRET = 'secret123';

    const config = loadConfig();

    expect(config).toEqual({
      port: 8080,
      amqpUrl: 'amqp://localhost:5672',
      githubWebhookSecret: 'secret123',
    });
  });

  it('should throw error when AMQP_URL is missing', () => {
    delete process.env.AMQP_URL;

    expect(() => loadConfig()).toThrow('AMQP_URL environment variable is required');
  });

  it('should use default PORT value when not provided', () => {
    process.env.AMQP_URL = 'amqp://localhost:5672';
    delete process.env.PORT;

    const config = loadConfig();

    expect(config.port).toBe(3000);
  });

  it('should set githubWebhookSecret to undefined when not provided', () => {
    process.env.AMQP_URL = 'amqp://localhost:5672';
    delete process.env.GITHUB_WEBHOOK_SECRET;

    const config = loadConfig();

    expect(config.githubWebhookSecret).toBeUndefined();
  });

  it('should set githubWebhookSecret to undefined when empty string', () => {
    process.env.AMQP_URL = 'amqp://localhost:5672';
    process.env.GITHUB_WEBHOOK_SECRET = '';

    const config = loadConfig();

    expect(config.githubWebhookSecret).toBeUndefined();
  });
});
