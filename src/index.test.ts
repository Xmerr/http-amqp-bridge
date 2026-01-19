import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock config before importing the module
vi.mock('./config.js', () => ({
  loadConfig: vi.fn(),
}));

// Mock server before importing the module
vi.mock('./server.js', () => ({
  createServer: vi.fn(),
}));

import { loadConfig } from './config.js';
import { createServer } from './server.js';

describe('index', () => {
  let mockFastify: {
    listen: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
  };
  let mockAmqpService: {
    close: ReturnType<typeof vi.fn>;
  };
  let originalExit: typeof process.exit;
  let exitCode: number | undefined;
  let signalHandlers: Map<string, () => void>;
  let exitPromiseResolve: (() => void) | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    exitCode = undefined;
    signalHandlers = new Map();
    exitPromiseResolve = null;

    mockFastify = {
      listen: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    };

    mockAmqpService = {
      close: vi.fn().mockResolvedValue(undefined),
    };

    vi.mocked(loadConfig).mockReturnValue({
      port: 3000,
      amqpUrl: 'amqp://localhost:5672',
      githubWebhookSecret: undefined,
    });

    vi.mocked(createServer).mockResolvedValue({
      fastify: mockFastify as never,
      amqpService: mockAmqpService as never,
    });

    // Mock process.exit - store code but don't throw
    originalExit = process.exit;
    process.exit = vi.fn((code?: number) => {
      exitCode = code;
      if (exitPromiseResolve) {
        exitPromiseResolve();
      }
      // Return never to match the type signature
      return undefined as never;
    });

    // Mock process.on for signal handlers
    vi.spyOn(process, 'on').mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
      signalHandlers.set(event, handler as () => void);
      return process;
    });
  });

  afterEach(() => {
    process.exit = originalExit;
    vi.restoreAllMocks();
  });

  it('should start server successfully', async () => {
    // Import and run the module
    await import('./index.js');

    // Allow async operations to complete
    await vi.waitFor(() => {
      expect(loadConfig).toHaveBeenCalled();
    });

    expect(createServer).toHaveBeenCalled();
    expect(mockFastify.listen).toHaveBeenCalledWith({ port: 3000, host: '0.0.0.0' });
  });

  it('should register SIGTERM handler', async () => {
    await import('./index.js');

    await vi.waitFor(() => {
      expect(signalHandlers.has('SIGTERM')).toBe(true);
    });
  });

  it('should register SIGINT handler', async () => {
    await import('./index.js');

    await vi.waitFor(() => {
      expect(signalHandlers.has('SIGINT')).toBe(true);
    });
  });

  it('should handle SIGTERM gracefully', async () => {
    await import('./index.js');

    await vi.waitFor(() => {
      expect(signalHandlers.has('SIGTERM')).toBe(true);
    });

    const handler = signalHandlers.get('SIGTERM');
    expect(handler).toBeDefined();

    await handler?.();

    expect(mockFastify.close).toHaveBeenCalled();
    expect(mockAmqpService.close).toHaveBeenCalled();
    expect(exitCode).toBe(0);
  });

  it('should handle SIGINT gracefully', async () => {
    await import('./index.js');

    await vi.waitFor(() => {
      expect(signalHandlers.has('SIGINT')).toBe(true);
    });

    const handler = signalHandlers.get('SIGINT');
    expect(handler).toBeDefined();

    await handler?.();

    expect(mockFastify.close).toHaveBeenCalled();
    expect(mockAmqpService.close).toHaveBeenCalled();
    expect(exitCode).toBe(0);
  });

  it('should exit with code 1 on startup error', async () => {
    // Create promise to wait for process.exit
    const exitPromise = new Promise<void>((resolve) => {
      exitPromiseResolve = resolve;
    });

    vi.mocked(createServer).mockRejectedValue(new Error('Connection failed'));

    // Import module (starts main())
    await import('./index.js');

    // Wait for process.exit to be called
    await exitPromise;

    expect(exitCode).toBe(1);
  });
});
