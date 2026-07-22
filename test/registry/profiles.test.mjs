import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveProfile } from '../../src/registry/profiles.mjs';

test('should resolve Signal Field to its exact format, datasets, and artifact manifest', () => {
  const profile = resolveProfile('signal-field');

  assert.equal(profile.visualFormat.id, 'signal-field');
  assert.deepEqual(profile.requiredDatasetIds, [
    'contributions',
    'totalStars',
    'authoredPullRequests',
    'authoredIssues',
  ]);
  assert.deepEqual(profile.expectedArtifactNames, [
    'signal-field-compact-dark.svg',
    'signal-field-compact-light.svg',
    'signal-field-wide-dark.svg',
    'signal-field-wide-light.svg',
  ]);
  assert.ok(Object.isFrozen(profile));
});

test('should resolve Activity consistency to its contribution dataset and four artifacts', () => {
  const profile = resolveProfile('activity-consistency');

  assert.equal(profile.visualFormat.id, 'activity-consistency');
  assert.deepEqual(profile.requiredDatasetIds, ['contributions']);
  assert.deepEqual(profile.expectedArtifactNames, [
    'activity-consistency-compact-dark.svg',
    'activity-consistency-compact-light.svg',
    'activity-consistency-wide-dark.svg',
    'activity-consistency-wide-light.svg',
  ]);
});

test('should resolve Language composition to its language dataset and four artifacts', () => {
  const profile = resolveProfile('language-composition');

  assert.equal(profile.visualFormat.id, 'language-composition');
  assert.deepEqual(profile.requiredDatasetIds, ['repositoryLanguages']);
  assert.deepEqual(profile.expectedArtifactNames, [
    'language-composition-compact-dark.svg',
    'language-composition-compact-light.svg',
    'language-composition-wide-dark.svg',
    'language-composition-wide-light.svg',
  ]);
});

test('should reject an invalid format or dataset graph during profile resolution', () => {
  const validProvider = (id) => ({ id, collectAndNormalize() {} });
  assert.throws(() => resolveProfile('broken', {
    profileIds: ['broken'],
    getFormat: () => ({ id: 'format', requiredDatasetIds: ['data'], render() {} }),
    getProvider: validProvider,
  }), /visual format broken registration is invalid/);
  assert.throws(() => resolveProfile('broken', {
    profileIds: ['broken'],
    getFormat: () => ({
      id: 'broken',
      requiredDatasetIds: ['data'],
      render() {},
      validate() {},
    }),
    getProvider: () => ({ id: 'wrong', collectAndNormalize() {} }),
  }), /dataset data registration is invalid/);
});
