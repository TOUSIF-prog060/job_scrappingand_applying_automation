const test = require('node:test');
const assert = require('node:assert/strict');
const { isSafeToClick } = require('../automation/formFiller');

test('safetyGuard - correctly blocks final application submission buttons', () => {
  assert.equal(isSafeToClick('Submit Application'), false);
  assert.equal(isSafeToClick('Submit'), false);
  assert.equal(isSafeToClick('Send Application'), false);
  assert.equal(isSafeToClick('SEND YOUR APPLICATION'), false);
});

test('safetyGuard - allows safe multi-step navigation buttons', () => {
  assert.equal(isSafeToClick('Continue'), true);
  assert.equal(isSafeToClick('Next Step'), true);
  assert.equal(isSafeToClick('Proceed'), true);
  assert.equal(isSafeToClick('Save & Continue'), true);
});
