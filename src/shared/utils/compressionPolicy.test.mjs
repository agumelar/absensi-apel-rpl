import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAdaptiveTargetLadder,
  retryAsync,
  resolveCompressionMode,
} from './compressionPolicy.js';

test('buildAdaptiveTargetLadder returns expected ladder', () => {
  assert.deepEqual(buildAdaptiveTargetLadder(), [10, 15, 20, 25, 30, 40, 50]);
});

test('resolveCompressionMode returns normal at <= 30KB', () => {
  assert.equal(resolveCompressionMode(30), 'normal');
  assert.equal(resolveCompressionMode(10), 'normal');
});

test('resolveCompressionMode returns emergency at > 30KB and <= 50KB', () => {
  assert.equal(resolveCompressionMode(31), 'emergency');
  assert.equal(resolveCompressionMode(50), 'emergency');
});

test('resolveCompressionMode returns failed at > 50KB', () => {
  assert.equal(resolveCompressionMode(51), 'failed');
});

test('retryAsync retries failed task then succeeds', async () => {
  let attempts = 0;
  const result = await retryAsync(
    async () => {
      attempts += 1;
      if (attempts < 3) {
        throw new Error('temporary failure');
      }
      return 'ok';
    },
    { retries: 2, delayMs: 0 },
  );

  assert.equal(result, 'ok');
  assert.equal(attempts, 3);
});

test('retryAsync with invalid retries still executes once', async () => {
  let attempts = 0;

  const result = await retryAsync(
    async () => {
      attempts += 1;
      return 'single-run';
    },
    { retries: 'invalid', delayMs: 0 },
  );

  assert.equal(result, 'single-run');
  assert.equal(attempts, 1);
});

test('retryAsync throws Error when retries exhausted', async () => {
  await assert.rejects(
    () =>
      retryAsync(
        async () => {
          throw 'boom';
        },
        { retries: 1, delayMs: 0 },
      ),
    (error) => {
      assert.ok(error instanceof Error);
      assert.equal(error.message, 'boom');
      return true;
    },
  );
});

test('retryAsync throws clear Error for non-function taskFn', async () => {
  await assert.rejects(
    () => retryAsync(null, { retries: 1, delayMs: 0 }),
    (error) => {
      assert.ok(error instanceof Error);
      assert.equal(error.message, 'taskFn wajib berupa fungsi async');
      return true;
    },
  );
});
