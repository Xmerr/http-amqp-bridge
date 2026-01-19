import { createHmac, timingSafeEqual } from 'node:crypto';
import type { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';
import { BridgeError } from '../errors/index.js';

export function createWebhookValidation(secret: string | undefined) {
  return function validateGitHubWebhook(
    request: FastifyRequest,
    _reply: FastifyReply,
    done: HookHandlerDoneFunction
  ): void {
    // Skip validation if no secret is configured
    if (!secret) {
      done();
      return;
    }

    const signature = request.headers['x-hub-signature-256'];
    if (!signature || typeof signature !== 'string') {
      done(new BridgeError('Missing X-Hub-Signature-256 header', 'MISSING_SIGNATURE', 401));
      return;
    }

    const rawBody = request.rawBody;
    if (!rawBody) {
      done(new BridgeError('Raw body not available', 'MISSING_BODY', 400));
      return;
    }

    const expectedSignature = 'sha256=' + createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (signatureBuffer.length !== expectedBuffer.length || !timingSafeEqual(signatureBuffer, expectedBuffer)) {
      done(new BridgeError('Invalid webhook signature', 'INVALID_SIGNATURE', 401));
      return;
    }

    done();
  };
}
