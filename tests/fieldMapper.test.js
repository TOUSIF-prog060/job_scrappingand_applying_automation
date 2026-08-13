const test = require('node:test');
const assert = require('node:assert/strict');
const { findMatchingKey, getCandidateValue } = require('../automation/fieldMapper');

test('fieldMapper - matches labels to candidate profile keys correctly', () => {
  assert.equal(findMatchingKey('First Name *')?.key, 'firstName');
  assert.equal(findMatchingKey('Last Name *')?.key, 'lastName');
  assert.equal(findMatchingKey('Email Address')?.key, 'email');
  assert.equal(findMatchingKey('Phone Number')?.key, 'phone');
  assert.equal(findMatchingKey('Current Location')?.key, 'location');
  assert.equal(findMatchingKey('LinkedIn Profile')?.key, 'linkedin');
  assert.equal(findMatchingKey('GitHub URL')?.key, 'github');
});

test('fieldMapper - extracts correct values from candidate profile', () => {
  const dummyCandidate = {
    firstName: 'Tousif',
    lastName: 'Raza',
    email: 'test@example.com',
    phone: '+91-9000000000',
  };

  assert.equal(getCandidateValue(dummyCandidate, 'firstName'), 'Tousif');
  assert.equal(getCandidateValue(dummyCandidate, 'lastName'), 'Raza');
  assert.equal(getCandidateValue(dummyCandidate, 'fullName'), 'Tousif Raza');
  assert.equal(getCandidateValue(dummyCandidate, 'email'), 'test@example.com');
  assert.equal(getCandidateValue(dummyCandidate, 'unknownKey'), '');
});
