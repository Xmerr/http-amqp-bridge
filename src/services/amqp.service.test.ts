import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AmqpService } from './amqp.service.js';
import { BridgeError } from '../errors/index.js';

vi.mock('amqplib', () => ({
  default: {
    connect: vi.fn(),
  },
}));

import amqplib from 'amqplib';

describe('AmqpService', () => {
  let service: AmqpService;
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

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

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

    service = new AmqpService('amqp://localhost:5672');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('connect', () => {
    it('should connect successfully', async () => {
      await service.connect();

      expect(amqplib.connect).toHaveBeenCalledWith('amqp://localhost:5672');
      expect(mockConnection.createChannel).toHaveBeenCalled();
      expect(service.isConnected()).toBe(true);
    });

    it('should register connection event handlers', async () => {
      await service.connect();

      expect(mockConnection.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockConnection.on).toHaveBeenCalledWith('close', expect.any(Function));
    });

    it('should throw BridgeError on connection failure', async () => {
      vi.mocked(amqplib.connect).mockRejectedValue(new Error('Connection refused'));

      await expect(service.connect()).rejects.toThrow(BridgeError);
      await expect(service.connect()).rejects.toMatchObject({
        code: 'AMQP_CONNECTION_FAILED',
        statusCode: 503,
      });
    });

    it('should handle non-Error connection failure', async () => {
      vi.mocked(amqplib.connect).mockRejectedValue('string error');

      await expect(service.connect()).rejects.toThrow(BridgeError);
    });
  });

  describe('publish', () => {
    it('should publish string message successfully', async () => {
      await service.connect();

      const result = await service.publish('test-exchange', 'test.key', 'test message');

      expect(result.success).toBe(true);
      expect(result.exchange).toBe('test-exchange');
      expect(result.routingKey).toBe('test.key');
      expect(result.messageId).toBeDefined();
      expect(mockChannel.assertExchange).toHaveBeenCalledWith('test-exchange', 'topic', { durable: true });
      expect(mockChannel.publish).toHaveBeenCalled();
    });

    it('should publish Buffer message successfully', async () => {
      await service.connect();
      const buffer = Buffer.from('test buffer');

      const result = await service.publish('test-exchange', 'test.key', buffer);

      expect(result.success).toBe(true);
      expect(mockChannel.publish).toHaveBeenCalledWith(
        'test-exchange',
        'test.key',
        buffer,
        expect.objectContaining({
          persistent: true,
          contentType: 'application/json',
        })
      );
    });

    it('should throw BridgeError when not connected', async () => {
      await expect(service.publish('exchange', 'key', 'msg')).rejects.toThrow(BridgeError);
      await expect(service.publish('exchange', 'key', 'msg')).rejects.toMatchObject({
        code: 'AMQP_NOT_CONNECTED',
        statusCode: 503,
      });
    });

    it('should throw BridgeError on publish failure', async () => {
      await service.connect();
      mockChannel.assertExchange.mockRejectedValue(new Error('Exchange error'));

      await expect(service.publish('exchange', 'key', 'msg')).rejects.toThrow(BridgeError);
      await expect(service.publish('exchange', 'key', 'msg')).rejects.toMatchObject({
        code: 'AMQP_PUBLISH_FAILED',
        statusCode: 500,
      });
    });

    it('should handle non-Error publish failure', async () => {
      await service.connect();
      mockChannel.assertExchange.mockRejectedValue('string error');

      await expect(service.publish('exchange', 'key', 'msg')).rejects.toThrow(BridgeError);
    });
  });

  describe('isConnected', () => {
    it('should return false when not connected', () => {
      expect(service.isConnected()).toBe(false);
    });

    it('should return true when connected', async () => {
      await service.connect();

      expect(service.isConnected()).toBe(true);
    });
  });

  describe('close', () => {
    it('should close channel and connection', async () => {
      await service.connect();
      await service.close();

      expect(mockChannel.close).toHaveBeenCalled();
      expect(mockConnection.close).toHaveBeenCalled();
      expect(service.isConnected()).toBe(false);
    });

    it('should handle close errors gracefully', async () => {
      await service.connect();
      mockChannel.close.mockRejectedValue(new Error('Close error'));

      await expect(service.close()).resolves.not.toThrow();
      expect(service.isConnected()).toBe(false);
    });

    it('should handle close when not connected', async () => {
      await expect(service.close()).resolves.not.toThrow();
    });
  });

  describe('reconnection', () => {
    it('should schedule reconnection on connection error', async () => {
      await service.connect();
      const errorHandler = mockConnection.on.mock.calls.find((call) => call[0] === 'error')?.[1];

      errorHandler?.(new Error('Connection lost'));

      expect(service.isConnected()).toBe(false);
    });

    it('should schedule reconnection on connection close', async () => {
      await service.connect();
      const closeHandler = mockConnection.on.mock.calls.find((call) => call[0] === 'close')?.[1];

      closeHandler?.();

      expect(service.isConnected()).toBe(false);
    });

    it('should attempt reconnection after delay', async () => {
      await service.connect();
      vi.mocked(amqplib.connect).mockClear();

      const closeHandler = mockConnection.on.mock.calls.find((call) => call[0] === 'close')?.[1];
      closeHandler?.();

      await vi.advanceTimersByTimeAsync(5000);

      expect(amqplib.connect).toHaveBeenCalled();
    });

    it('should not schedule multiple reconnections', async () => {
      await service.connect();
      vi.mocked(amqplib.connect).mockClear();

      const closeHandler = mockConnection.on.mock.calls.find((call) => call[0] === 'close')?.[1];
      closeHandler?.();
      closeHandler?.();

      await vi.advanceTimersByTimeAsync(5000);

      expect(amqplib.connect).toHaveBeenCalledTimes(1);
    });

    it('should handle reconnection failure', async () => {
      await service.connect();
      vi.mocked(amqplib.connect).mockRejectedValue(new Error('Still down'));

      const closeHandler = mockConnection.on.mock.calls.find((call) => call[0] === 'close')?.[1];
      closeHandler?.();

      await vi.advanceTimersByTimeAsync(5000);

      expect(service.isConnected()).toBe(false);
    });
  });
});
