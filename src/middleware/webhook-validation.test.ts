import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHmac } from 'node:crypto';
import { createWebhookValidation } from './webhook-validation.js';
import { BridgeError } from '../errors/index.js';

describe('createWebhookValidation', () => {
  let mockRequest: {
    headers: Record<string, string | undefined>;
    rawBody?: Buffer;
  };
  let mockReply: object;
  let mockDone: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockRequest = {
      headers: {},
      rawBody: undefined,
    };
    mockReply = {};
    mockDone = vi.fn();
  });

  it('should skip validation when no secret is configured', () => {
    const validate = createWebhookValidation(undefined);

    validate(mockRequest as never, mockReply as never, mockDone);

    expect(mockDone).toHaveBeenCalledWith();
  });

  it('should call done with error when signature header is missing', () => {
    const validate = createWebhookValidation('secret');

    validate(mockRequest as never, mockReply as never, mockDone);

    expect(mockDone).toHaveBeenCalledWith(expect.any(BridgeError));
    const error = mockDone.mock.calls[0][0] as BridgeError;
    expect(error.code).toBe('MISSING_SIGNATURE');
    expect(error.statusCode).toBe(401);
  });

  it('should call done with error when signature is not a string', () => {
    const validate = createWebhookValidation('secret');
    mockRequest.headers['x-hub-signature-256'] = undefined;

    validate(mockRequest as never, mockReply as never, mockDone);

    expect(mockDone).toHaveBeenCalledWith(expect.any(BridgeError));
    const error = mockDone.mock.calls[0][0] as BridgeError;
    expect(error.code).toBe('MISSING_SIGNATURE');
  });

  it('should call done with error when raw body is missing', () => {
    const validate = createWebhookValidation('secret');
    mockRequest.headers['x-hub-signature-256'] = 'sha256=abc123';

    validate(mockRequest as never, mockReply as never, mockDone);

    expect(mockDone).toHaveBeenCalledWith(expect.any(BridgeError));
    const error = mockDone.mock.calls[0][0] as BridgeError;
    expect(error.code).toBe('MISSING_BODY');
    expect(error.statusCode).toBe(400);
  });

  it('should call done with error when signature is invalid', () => {
    const validate = createWebhookValidation('secret');
    mockRequest.headers['x-hub-signature-256'] = 'sha256=invalid';
    mockRequest.rawBody = Buffer.from('test body');

    validate(mockRequest as never, mockReply as never, mockDone);

    expect(mockDone).toHaveBeenCalledWith(expect.any(BridgeError));
    const error = mockDone.mock.calls[0][0] as BridgeError;
    expect(error.code).toBe('INVALID_SIGNATURE');
    expect(error.statusCode).toBe(401);
  });

  it('should call done with error when signature length differs', () => {
    const validate = createWebhookValidation('secret');
    mockRequest.headers['x-hub-signature-256'] = 'sha256=short';
    mockRequest.rawBody = Buffer.from('test body');

    validate(mockRequest as never, mockReply as never, mockDone);

    expect(mockDone).toHaveBeenCalledWith(expect.any(BridgeError));
    const error = mockDone.mock.calls[0][0] as BridgeError;
    expect(error.code).toBe('INVALID_SIGNATURE');
  });

  it('should call done without error when signature is valid', () => {
    const secret = 'mysecret';
    const body = Buffer.from('{"test": "data"}');
    const expectedSignature = 'sha256=' + createHmac('sha256', secret)
      .update(body)
      .digest('hex');

    const validate = createWebhookValidation(secret);
    mockRequest.headers['x-hub-signature-256'] = expectedSignature;
    mockRequest.rawBody = body;

    validate(mockRequest as never, mockReply as never, mockDone);

    expect(mockDone).toHaveBeenCalledWith();
  });

  it('should use timing-safe comparison', () => {
    const secret = 'mysecret';
    const body = Buffer.from('test');
    const correctSignature = 'sha256=' + createHmac('sha256', secret)
      .update(body)
      .digest('hex');

    const validate = createWebhookValidation(secret);
    mockRequest.headers['x-hub-signature-256'] = correctSignature;
    mockRequest.rawBody = body;

    validate(mockRequest as never, mockReply as never, mockDone);

    expect(mockDone).toHaveBeenCalledWith();
  });
});
