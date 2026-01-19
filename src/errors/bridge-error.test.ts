import { describe, it, expect } from 'vitest';
import { BridgeError } from './bridge-error.js';

describe('BridgeError', () => {
  it('should create error with all parameters', () => {
    const error = new BridgeError('Test error', 'TEST_CODE', 400, { key: 'value' });

    expect(error.message).toBe('Test error');
    expect(error.code).toBe('TEST_CODE');
    expect(error.statusCode).toBe(400);
    expect(error.context).toEqual({ key: 'value' });
    expect(error.name).toBe('BridgeError');
  });

  it('should use default status code of 500', () => {
    const error = new BridgeError('Test error', 'TEST_CODE');

    expect(error.statusCode).toBe(500);
  });

  it('should serialize to JSON with context', () => {
    const error = new BridgeError('Test error', 'TEST_CODE', 400, { key: 'value' });

    const json = error.toJSON();

    expect(json).toEqual({
      error: 'BridgeError',
      code: 'TEST_CODE',
      message: 'Test error',
      context: { key: 'value' },
    });
  });

  it('should serialize to JSON without context when not provided', () => {
    const error = new BridgeError('Test error', 'TEST_CODE', 400);

    const json = error.toJSON();

    expect(json).toEqual({
      error: 'BridgeError',
      code: 'TEST_CODE',
      message: 'Test error',
    });
    expect(json).not.toHaveProperty('context');
  });

  it('should be an instance of Error', () => {
    const error = new BridgeError('Test error', 'TEST_CODE');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(BridgeError);
  });

  it('should have a stack trace', () => {
    const error = new BridgeError('Test error', 'TEST_CODE');

    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('BridgeError');
  });
});
