import { assertValidDate } from './dates.mjs';

function assertNonNegativeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${label} must be a non-negative safe integer`);
  }
}

function assertName(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${label} must be a non-empty string`);
  }
}

function compareRawNames(left, right) {
  if (left.name === right.name) return 0;
  return left.name < right.name ? -1 : 1;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export function normalizeRepositoryLanguagesDataset({
  asOfDate,
  includedRepositoryCount,
  languageEntries,
}) {
  assertValidDate(asOfDate, 'asOfDate');
  assertNonNegativeInteger(includedRepositoryCount, 'includedRepositoryCount');
  if (!Array.isArray(languageEntries)) throw new TypeError('languageEntries must be an array');
  const totals = new Map();
  languageEntries.forEach((entry, index) => {
    assertName(entry?.name, `languageEntries[${index}].name`);
    assertNonNegativeInteger(entry?.bytes, `languageEntries[${index}].bytes`);
    const total = (totals.get(entry.name) ?? 0) + entry.bytes;
    if (!Number.isSafeInteger(total)) throw new RangeError('aggregated language bytes are unsafe');
    totals.set(entry.name, total);
  });
  const languages = [...totals]
    .map(([name, bytes]) => ({ name, bytes }))
    .filter(({ bytes }) => bytes > 0)
    .sort((left, right) => right.bytes - left.bytes || compareRawNames(left, right));
  const totalBytes = languages.reduce((sum, item) => sum + item.bytes, 0);
  if (!Number.isSafeInteger(totalBytes)) throw new RangeError('total language bytes are unsafe');
  return deepFreeze({
    definition: 'github.owned-public-non-fork-repository-language-bytes',
    source: 'github.graphql.repository-languages-with-rest-overflow',
    asOfDate,
    visibility: 'public',
    repositoryScope: {
      ownership: 'owner',
      forkPolicy: 'exclude',
      archivePolicy: 'include',
      includedRepositoryCount,
    },
    totalBytes,
    languages,
  });
}

export function buildLanguageDisplayGroups(dataset) {
  assertNonNegativeInteger(dataset?.totalBytes, 'totalBytes');
  if (!Array.isArray(dataset?.languages)) throw new TypeError('languages must be an array');
  const groups = dataset.languages.slice(0, 4).map(({ name, bytes }) => ({ name, bytes }));
  const remainingBytes = dataset.languages.slice(4).reduce((sum, { bytes }) => sum + bytes, 0);
  if (remainingBytes > 0) groups.push({ name: 'Other', bytes: remainingBytes });
  const groupedTotal = groups.reduce((sum, group) => sum + group.bytes, 0);
  if (groupedTotal !== dataset.totalBytes) {
    throw new TypeError('display-group byte sum must equal totalBytes');
  }
  if (groupedTotal === 0) return Object.freeze([]);
  const allocations = groups.map((group, index) => {
    const scaled = BigInt(group.bytes) * 100n;
    return {
      ...group,
      index,
      percentage: Number(scaled / BigInt(groupedTotal)),
      remainder: scaled % BigInt(groupedTotal),
    };
  });
  let points = 100 - allocations.reduce((sum, group) => sum + group.percentage, 0);
  const byRemainder = [...allocations].sort((left, right) => {
    if (left.remainder === right.remainder) return left.index - right.index;
    return left.remainder > right.remainder ? -1 : 1;
  });
  for (let index = 0; index < points; index += 1) byRemainder[index].percentage += 1;
  return deepFreeze(allocations.map(({ name, bytes, percentage }) => ({ name, bytes, percentage })));
}
