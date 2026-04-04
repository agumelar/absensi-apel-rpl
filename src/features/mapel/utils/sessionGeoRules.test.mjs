import test from 'node:test';
import assert from 'node:assert/strict';

import {
  GEOLOCATION_ERROR_MESSAGE,
  getGeoLocationErrorMessage,
  isValidGeoCoordinate,
} from './sessionGeoRules.js';

test('isValidGeoCoordinate menerima latitude/longitude numerik', () => {
  assert.equal(isValidGeoCoordinate(-6.2), true);
  assert.equal(isValidGeoCoordinate('107.8'), true);
  assert.equal(isValidGeoCoordinate(null), false);
  assert.equal(isValidGeoCoordinate('abc'), false);
});

test('getGeoLocationErrorMessage memetakan kode error permission denied', () => {
  assert.equal(
    getGeoLocationErrorMessage({ code: 1 }),
    GEOLOCATION_ERROR_MESSAGE.PERMISSION_DENIED,
  );
});

test('getGeoLocationErrorMessage memetakan kode error unavailable dan timeout', () => {
  assert.equal(
    getGeoLocationErrorMessage({ code: 2 }),
    GEOLOCATION_ERROR_MESSAGE.POSITION_UNAVAILABLE,
  );
  assert.equal(
    getGeoLocationErrorMessage({ code: 3 }),
    GEOLOCATION_ERROR_MESSAGE.TIMEOUT,
  );
});

test('getGeoLocationErrorMessage fallback ke unknown error', () => {
  assert.equal(getGeoLocationErrorMessage({ code: 999 }), GEOLOCATION_ERROR_MESSAGE.UNKNOWN);
  assert.equal(getGeoLocationErrorMessage(null), GEOLOCATION_ERROR_MESSAGE.UNKNOWN);
});
