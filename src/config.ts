export interface Config {
  port: number;
  amqpUrl: string;
  githubWebhookSecret: string | undefined;
}

export function loadConfig(): Config {
  const amqpUrl = process.env.AMQP_URL;
  if (!amqpUrl) {
    throw new Error('AMQP_URL environment variable is required');
  }

  return {
    port: parseInt(process.env.PORT ?? '3000', 10),
    amqpUrl,
    githubWebhookSecret: process.env.GITHUB_WEBHOOK_SECRET || undefined,
  };
}
