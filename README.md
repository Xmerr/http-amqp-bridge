# HTTP-AMQP Bridge

A lightweight HTTP bridge that accepts webhook POSTs and publishes them to RabbitMQ. Built with Fastify and amqplib.

## Features

- Forward HTTP webhook payloads to RabbitMQ exchanges
- Optional GitHub webhook signature validation (HMAC-SHA256)
- Auto-reconnection to RabbitMQ on connection loss
- Health check endpoint with connection status
- Topic exchanges with durable, persistent messages

## Requirements

- Node.js >= 22.0.0
- RabbitMQ server

## Installation

```bash
npm install
npm run build
```

## Configuration

Set the following environment variables:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AMQP_URL` | Yes | - | RabbitMQ connection URL (e.g., `amqp://localhost`) |
| `PORT` | No | `3000` | HTTP server port |
| `GITHUB_WEBHOOK_SECRET` | No | - | Secret for GitHub webhook signature validation |

## Usage

### Start the server

```bash
# Production
npm start

# Development (with hot reload)
npm run dev
```

### API Endpoints

#### Publish Message

```
POST /publish/:exchange/:routingKey
```

Publishes the request body to the specified RabbitMQ exchange with the given routing key.

**Parameters:**
- `exchange` - Target RabbitMQ exchange name (will be created as a topic exchange if it doesn't exist)
- `routingKey` - Message routing key

**Response:**
```json
{
  "success": true,
  "messageId": "550e8400-e29b-41d4-a716-446655440000",
  "exchange": "my-exchange",
  "routingKey": "my.routing.key"
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/publish/webhooks/github.push \
  -H "Content-Type: application/json" \
  -d '{"event": "push", "ref": "refs/heads/main"}'
```

#### Health Check

```
GET /health
```

Returns the service health status including RabbitMQ connection state.

**Response (healthy):**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "checks": {
    "amqp": "connected"
  }
}
```

**Response (unhealthy):**
```json
{
  "status": "unhealthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "checks": {
    "amqp": "disconnected"
  }
}
```

### GitHub Webhook Integration

To validate GitHub webhook signatures, set the `GITHUB_WEBHOOK_SECRET` environment variable to match the secret configured in your GitHub webhook settings.

When configured, the bridge will:
1. Require the `X-Hub-Signature-256` header on all publish requests
2. Validate the HMAC-SHA256 signature against the request body
3. Reject requests with missing or invalid signatures

## Development

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Architecture

```
src/
├── config.ts           # Environment configuration
├── errors/             # Custom error classes
├── middleware/         # Webhook validation
├── routes/             # HTTP endpoints
│   ├── health.ts       # Health check route
│   └── publish.ts      # Publish route
├── services/           # AMQP service layer
├── types/              # TypeScript type definitions
├── server.ts           # Fastify server setup
└── index.ts            # Application entry point
```

## License

MIT
