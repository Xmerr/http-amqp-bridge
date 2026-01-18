import { loadConfig } from './config.js';
import { createServer, type ServerContext } from './server.js';

let context: ServerContext | null = null;

async function shutdown(signal: string): Promise<void> {
  console.log(`Received ${signal}, shutting down gracefully...`);

  if (context) {
    await context.fastify.close();
    await context.amqpService.close();
  }

  process.exit(0);
}

async function main(): Promise<void> {
  try {
    const config = loadConfig();
    context = await createServer(config);

    await context.fastify.listen({ port: config.port, host: '0.0.0.0' });
    console.log(`HTTP-AMQP bridge listening on port ${config.port}`);

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

main();
