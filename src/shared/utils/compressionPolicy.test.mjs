import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAdaptiveTargetLadder,
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
