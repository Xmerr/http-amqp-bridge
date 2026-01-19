# HTTP-AMQP Bridge

Lightweight HTTP bridge that accepts webhook POSTs and publishes to RabbitMQ.

## Commands

```bash
npm run build       # Compile TypeScript
npm run dev         # Run in development mode
npm run start       # Run compiled output
npm test            # Run tests
npm run test:watch  # Run tests in watch mode
npm run test:coverage # Run tests with coverage report
```

## Testing Policy

**100% test coverage is required.** The CI pipeline enforces coverage thresholds on:
- Lines: 100%
- Functions: 100%
- Branches: 100%
- Statements: 100%

PRs will fail if coverage drops below these thresholds.

## Test Conventions

- Test files are co-located with source: `*.test.ts`
- Use Vitest with `describe`/`it` blocks
- Follow arrange-act-assert pattern
- Mock external dependencies (amqplib, fastify)

## Architecture

- `config.ts` - Environment configuration
- `errors/` - Custom error classes
- `services/` - AMQP service layer
- `middleware/` - Webhook validation
- `routes/` - HTTP endpoints (health, publish)
- `server.ts` - Fastify server setup
- `index.ts` - Application entry point
