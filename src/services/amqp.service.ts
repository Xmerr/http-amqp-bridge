import amqplib, { type Connection, type Channel } from 'amqplib';
import { BridgeError } from '../errors/index.js';

export interface PublishResult {
  success: boolean;
  messageId: string;
  exchange: string;
  routingKey: string;
}

export class AmqpService {
  private connection: Connection | null = null;
  private channel: Channel | null = null;
  private reconnecting = false;
  private readonly reconnectDelay = 5000;

  constructor(private readonly url: string) {}

  async connect(): Promise<void> {
    try {
      this.connection = await amqplib.connect(this.url);
      this.channel = await this.connection.createChannel();

      this.connection.on('error', (err) => {
        console.error('AMQP connection error:', err.message);
        this.scheduleReconnect();
      });

      this.connection.on('close', () => {
        console.log('AMQP connection closed');
        this.scheduleReconnect();
      });

      console.log('Connected to RabbitMQ');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Failed to connect to RabbitMQ:', message);
      throw new BridgeError('Failed to connect to RabbitMQ', 'AMQP_CONNECTION_FAILED', 503, { originalError: message });
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnecting) return;
    this.reconnecting = true;
    this.channel = null;
    this.connection = null;

    console.log(`Reconnecting to RabbitMQ in ${this.reconnectDelay}ms...`);
    setTimeout(async () => {
      this.reconnecting = false;
      try {
        await this.connect();
      } catch {
        // connect() already logs the error
      }
    }, this.reconnectDelay);
  }

  async publish(exchange: string, routingKey: string, message: Buffer | string): Promise<PublishResult> {
    if (!this.channel) {
      throw new BridgeError('AMQP channel not available', 'AMQP_NOT_CONNECTED', 503);
    }

    const messageId = crypto.randomUUID();
    const content = typeof message === 'string' ? Buffer.from(message) : message;

    try {
      await this.channel.assertExchange(exchange, 'topic', { durable: true });

      this.channel.publish(exchange, routingKey, content, {
        persistent: true,
        messageId,
        timestamp: Date.now(),
        contentType: 'application/json',
      });

      return { success: true, messageId, exchange, routingKey };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new BridgeError('Failed to publish message', 'AMQP_PUBLISH_FAILED', 500, { originalError: message });
    }
  }

  isConnected(): boolean {
    return this.channel !== null && this.connection !== null;
  }

  async close(): Promise<void> {
    try {
      await this.channel?.close();
      await this.connection?.close();
    } catch {
      // Ignore close errors during shutdown
    }
    this.channel = null;
    this.connection = null;
  }
}
