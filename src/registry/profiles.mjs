import { COLOR_SCHEMES, getVisualFormat, LAYOUTS } from './visual-formats.mjs';
import { getDatasetProvider } from './datasets.mjs';

const PROFILE_IDS = Object.freeze([
  'signal-field',
  'activity-consistency',
  'language-composition',
]);

function unique(values) {
  return new Set(values).size === values.length;
}

export function resolveProfile(id, {
  profileIds = PROFILE_IDS,
  getFormat = getVisualFormat,
  getProvider = getDatasetProvider,
} = {}) {
  if (!profileIds.includes(id)) throw new TypeError(`unsupported profile: ${id}`);
  const visualFormat = getFormat(id);
  if (visualFormat?.id !== id || typeof visualFormat.render !== 'function'
    || typeof visualFormat.validate !== 'function'
    || !Array.isArray(visualFormat.requiredDatasetIds)
    || visualFormat.requiredDatasetIds.length === 0
    || !unique(visualFormat.requiredDatasetIds)) {
    throw new TypeError(`visual format ${id} registration is invalid`);
  }
  for (const datasetId of visualFormat.requiredDatasetIds) {
    const provider = getProvider(datasetId);
    if (provider?.id !== datasetId || typeof provider.collectAndNormalize !== 'function') {
      throw new TypeError(`dataset ${datasetId} registration is invalid`);
    }
  }
  const expectedArtifactNames = LAYOUTS.flatMap((layout) => (
    COLOR_SCHEMES.map((colorScheme) => `${id}-${layout}-${colorScheme}.svg`)
  )).sort();
  return Object.freeze({
    id,
    visualFormat,
    requiredDatasetIds: Object.freeze([...visualFormat.requiredDatasetIds]),
    expectedArtifactNames: Object.freeze(expectedArtifactNames),
  });
}
