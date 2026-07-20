const REPOSITORIES_PER_PAGE = 100;

function assertCount(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${label} must be a non-negative safe integer`);
  }
  return value;
}

function validateUsername(username) {
  if (typeof username !== 'string' || username.length === 0) throw new TypeError('username is required');
}

export async function collectTotalStars({ client, username, maxPages = 20 }) {
  validateUsername(username);
  if (!Number.isInteger(maxPages) || maxPages < 1) throw new RangeError('maxPages must be positive');
  let totalStars = 0;
  for (let page = 1; page <= maxPages; page += 1) {
    const repositories = await client.requestRest({
      path: `/users/${encodeURIComponent(username)}/repos`,
      query: { type: 'owner', sort: 'full_name', direction: 'asc', per_page: REPOSITORIES_PER_PAGE, page },
    });
    if (!Array.isArray(repositories)) throw new TypeError(`repository page ${page} must be an array`);
    for (const [index, repository] of repositories.entries()) {
      totalStars += assertCount(repository?.stargazers_count, `repository page ${page} item ${index} stars`);
      assertCount(totalStars, 'totalStars');
    }
    if (repositories.length < REPOSITORIES_PER_PAGE) return totalStars;
  }
  throw new RangeError(`stars collector exceeded ${maxPages} pages`);
}

async function collectSearchTotal({ client, username, type }) {
  validateUsername(username);
  const label = type === 'pr' ? 'pull request' : 'issue';
  const payload = await client.requestRest({
    path: '/search/issues',
    query: { q: `author:${username} type:${type} is:public`, per_page: 1 },
  });
  if (payload?.incomplete_results !== false) {
    throw new TypeError(`${label} collector received an incomplete search result`);
  }
  return assertCount(payload.total_count, `${label} total_count`);
}

export function collectAuthoredPullRequests({ client, username }) {
  return collectSearchTotal({ client, username, type: 'pr' });
}

export function collectAuthoredIssues({ client, username }) {
  return collectSearchTotal({ client, username, type: 'issue' });
}
