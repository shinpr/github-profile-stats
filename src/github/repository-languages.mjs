import { GitHubGraphqlError } from './client.mjs';

const PAGE_SIZE_LADDER = Object.freeze([100, 50, 25, 10]);
const REPOSITORY_LANGUAGES_QUERY = `
  query RepositoryLanguages($login: String!, $pageSize: Int!, $after: String) {
    user(login: $login) {
      repositories(
        ownerAffiliations: OWNER
        privacy: PUBLIC
        isFork: false
        orderBy: { field: NAME, direction: ASC }
        first: $pageSize
        after: $after
      ) {
        totalCount
        pageInfo { hasNextPage endCursor }
        nodes {
          name
          owner { login }
          languages(first: 100, orderBy: { field: SIZE, direction: DESC }) {
            totalCount
            totalSize
            pageInfo { hasNextPage endCursor }
            edges { size node { name } }
          }
        }
      }
    }
    rateLimit { cost }
  }
`;

function nonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function assertName(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${label} must be a non-empty string`);
  }
  return value;
}

function isRepositoryResourceLimit(error) {
  return error instanceof GitHubGraphqlError && error.errors.some((item) => (
    item?.type === 'RESOURCE_LIMITS_EXCEEDED'
    && Array.isArray(item.path)
    && item.path.includes('repositories')
  ));
}

function decodeLanguageEdges(connection, label) {
  if (!connection || !Array.isArray(connection.edges) || !connection.pageInfo
    || typeof connection.pageInfo.hasNextPage !== 'boolean'
    || !nonNegativeInteger(connection.totalCount)
    || !nonNegativeInteger(connection.totalSize)) {
    throw new TypeError(`${label} language connection is invalid`);
  }
  const entries = connection.edges.map((edge, index) => {
    const name = assertName(edge?.node?.name, `${label} language ${index} name`);
    if (!nonNegativeInteger(edge?.size)) {
      throw new TypeError(`${label} language ${index} bytes must be a non-negative safe integer`);
    }
    return { name, bytes: edge.size };
  });
  const edgeBytes = entries.reduce((sum, entry) => sum + entry.bytes, 0);
  if (!Number.isSafeInteger(edgeBytes)) throw new RangeError(`${label} language byte total is unsafe`);
  return {
    complete: !connection.pageInfo.hasNextPage
      && entries.length === connection.totalCount
      && edgeBytes === connection.totalSize,
    entries,
  };
}

function decodeRestLanguages(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new TypeError('REST language response must be an object');
  }
  return Object.entries(payload).map(([name, bytes]) => {
    assertName(name, 'REST language name');
    if (!nonNegativeInteger(bytes)) {
      throw new TypeError('REST language bytes must be non-negative safe integers');
    }
    return { name, bytes };
  });
}

async function collectRepositoryEntries({ client, node, pageIndex, itemIndex }) {
  const label = `repository page ${pageIndex} item ${itemIndex}`;
  const owner = assertName(node?.owner?.login, `${label} owner`);
  const name = assertName(node?.name, `${label} name`);
  const nested = decodeLanguageEdges(node.languages, label);
  if (nested.complete) return nested.entries;
  const payload = await client.requestRest({
    path: `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/languages`,
  });
  return decodeRestLanguages(payload);
}

async function requestPage({ client, username, after, startingSizeIndex }) {
  for (let sizeIndex = startingSizeIndex; sizeIndex < PAGE_SIZE_LADDER.length; sizeIndex += 1) {
    const pageSize = PAGE_SIZE_LADDER[sizeIndex];
    try {
      const payload = await client.requestGraphql({
        query: REPOSITORY_LANGUAGES_QUERY,
        variables: { login: username, pageSize, after },
      });
      return { payload, sizeIndex };
    } catch (error) {
      if (!isRepositoryResourceLimit(error)) throw error;
      if (sizeIndex === PAGE_SIZE_LADDER.length - 1) {
        throw new RangeError('repository languages resource limit at minimum page size 10', { cause: error });
      }
    }
  }
  throw new RangeError('repository languages exhausted the page-size ladder');
}

export async function collectRepositoryLanguages({ client, username }) {
  assertName(username, 'username');
  let after = null;
  let sizeIndex = 0;
  let expectedTotal = null;
  let includedRepositoryCount = 0;
  let pageIndex = 0;
  const languageEntries = [];

  while (true) {
    pageIndex += 1;
    const result = await requestPage({ client, username, after, startingSizeIndex: sizeIndex });
    sizeIndex = result.sizeIndex;
    const connection = result.payload?.data?.user?.repositories;
    if (!connection || !Array.isArray(connection.nodes) || !connection.pageInfo
      || typeof connection.pageInfo.hasNextPage !== 'boolean'
      || !nonNegativeInteger(connection.totalCount)) {
      throw new TypeError(`repository page ${pageIndex} is invalid`);
    }
    if (expectedTotal === null) expectedTotal = connection.totalCount;
    if (connection.totalCount !== expectedTotal) {
      throw new TypeError('repository totalCount changed during pagination');
    }
    for (const [itemIndex, node] of connection.nodes.entries()) {
      languageEntries.push(...await collectRepositoryEntries({ client, node, pageIndex, itemIndex }));
      includedRepositoryCount += 1;
    }
    if (!connection.pageInfo.hasNextPage) break;
    const nextCursor = connection.pageInfo.endCursor;
    if (typeof nextCursor !== 'string' || nextCursor.length === 0 || nextCursor === after) {
      throw new TypeError('repository pagination requires an advancing endCursor');
    }
    after = nextCursor;
  }

  if (includedRepositoryCount !== expectedTotal) {
    throw new TypeError(`repository count mismatch: received ${includedRepositoryCount}; expected ${expectedTotal}`);
  }
  return Object.freeze({ includedRepositoryCount, languageEntries: Object.freeze(languageEntries) });
}
