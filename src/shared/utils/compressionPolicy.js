export const NORMAL_TARGETS_KB = Object.freeze([10, 15, 20, 25, 30]);
export const EMERGENCY_TARGETS_KB = Object.freeze([40, 50]);

export const buildAdaptiveTargetLadder = () => [
  ...NORMAL_TARGETS_KB,
  ...EMERGENCY_TARGETS_KB,
];

export const resolveCompressionMode = (sizeKB) => {
  if (sizeKB <= 30) {
    return 'normal';
  }

  if (sizeKB <= 50) {
    return 'emergency';
  }

  return 'failed';
};

const sleep = (delayMs) =>
  new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });

const toError = (value) => {
  if (value instanceof Error) return value;
  return new Error(String(value));
};

const normalizeRetries = (retries) => {
  const numericRetries = Number(retries);
  if (!Number.isFinite(numericRetries)) {
    return 0;
  }

  return Math.max(0, Math.floor(numericRetries));
};

export const retryAsync = async (taskFn, { retries = 0, delayMs = 0 } = {}) => {
  if (typeof taskFn !== 'function') {
    throw new Error('taskFn wajib berupa fungsi async');
  }

  const maxAttempts = normalizeRetries(retries) + 1;
  let lastError = new Error('retryAsync gagal tanpa detail error');

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await taskFn(attempt);
    } catch (error) {
      lastError = toError(error);
      if (attempt >= maxAttempts) {
        break;
      }

      if (delayMs > 0) {
        await sleep(delayMs);
      }
    }
  }

  throw toError(lastError);
};
