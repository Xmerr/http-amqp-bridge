export interface PublishParams {
  exchange: string;
  routingKey: string;
}

export interface PublishResponse {
  success: boolean;
  messageId: string;
  exchange: string;
  routingKey: string;
}

export interface HealthResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  checks: {
    amqp: 'connected' | 'disconnected';
  };
}

export interface ErrorResponse {
  error: string;
  code: string;
  message: string;
  context?: Record<string, unknown>;
}
