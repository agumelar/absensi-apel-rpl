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
