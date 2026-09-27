import assert from 'node:assert/strict';
import test from 'node:test';
import { canToggleRiderAvailability, getRiderVerificationView, isRiderVerificationStatus } from './riderVerification.ts';

test('API profile verification parser accepts only the four canonical states', () => {
  for (const status of ['pending', 'approved', 'rejected', 'suspended']) {
    assert.equal(isRiderVerificationStatus(status), true);
  }
  for (const status of ['verified', 'unknown', null, undefined]) {
    assert.equal(isRiderVerificationStatus(status), false);
  }
});

test('only approved Rider may request online availability', () => {
  for (const status of ['pending', 'rejected', 'suspended', 'verified', undefined]) {
    assert.equal(canToggleRiderAvailability(status, false), false);
  }
  assert.equal(canToggleRiderAvailability('approved', false), true);
});

test('going offline remains allowed even if verification changed', () => {
  for (const status of ['pending', 'approved', 'rejected', 'suspended', 'verified']) {
    assert.equal(canToggleRiderAvailability(status, true), true);
  }
});

test('pending, rejected, and suspended show distinct platform verification messages', () => {
  assert.match(getRiderVerificationView('pending').message, /awaiting LocalEats verification/);
  assert.match(getRiderVerificationView('rejected').title, /rejected/);
  assert.match(getRiderVerificationView('suspended').title, /suspended/);
  assert.doesNotMatch(getRiderVerificationView('pending').message, /shop relationship|pairing/i);
});

test('approved messaging separates online eligibility from Rider Pool dispatch', () => {
  const view = getRiderVerificationView('approved');
  assert.match(view.message, /may go online/);
  assert.match(view.message, /dispatch is being enabled/);
});

test('unknown and legacy verified states fail closed', () => {
  for (const status of ['verified', 'unexpected', null]) {
    assert.equal(getRiderVerificationView(status).title, 'Verification unavailable');
    assert.equal(canToggleRiderAvailability(status, false), false);
  }
});
