const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;
const DEFAULT_RETRY_DELAY_MS = 250;
const REST_API_VERSION = '2026-03-10';

export class GitHubRequestError extends Error {
  constructor(message, { status = null, cause, retryable = false } = {}) {
    super(message, { cause });
    this.name = 'GitHubRequestError';
    this.status = status;
    this.retryable = retryable;
  }
}

export class GitHubGraphqlError extends GitHubRequestError {
  constructor(message, { errors, status = 200 } = {}) {
    super(message, { status });
    this.name = 'GitHubGraphqlError';
    this.errors = Array.isArray(errors) ? errors : [];
  }
}

function retryableStatus(response) {
  if (response.status === 429 || response.status >= 500) return true;
  return response.status === 403
    && (response.headers.get('x-ratelimit-remaining') === '0' || response.headers.has('retry-after'));
}

function retryDelay(response, now) {
  const header = response?.headers.get('retry-after');
  if (!header) return DEFAULT_RETRY_DELAY_MS;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const timestamp = Date.parse(header);
  return Number.isNaN(timestamp) ? DEFAULT_RETRY_DELAY_MS : Math.max(0, timestamp - now());
}

function buildUrl(path, query) {
  const url = new URL(path, 'https://api.github.com');
  for (const [key, value] of Object.entries(query ?? {})) {
    url.searchParams.set(key, String(value));
  }
  return url;
}

function safeJson(response) {
  return response.json().catch((error) => {
    throw new GitHubRequestError(`GitHub returned invalid JSON with status ${response.status}`, {
      status: response.status,
      cause: error,
    });
  });
}

async function sleepBeforeRetry({ milliseconds, now, deadlineAt, sleep }) {
  if (now() + milliseconds > deadlineAt) {
    throw new GitHubRequestError('GitHub retry delay exceeds the generation deadline');
  }
  await sleep(milliseconds);
}

function createRequester(context) {
  return async function request({ url, init, beforeAttempt }) {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const remaining = context.deadlineAt - context.now();
      if (remaining <= 0) throw new GitHubRequestError('GitHub generation deadline exceeded');
      beforeAttempt?.();
      let response;
      try {
        response = await context.fetchImpl(url, {
          ...init,
          signal: AbortSignal.timeout(Math.min(context.requestTimeoutMs, remaining)),
        });
      } catch (cause) {
        if (attempt === 2) {
          throw new GitHubRequestError('GitHub network request failed after retry', {
            cause,
            retryable: true,
          });
        }
        await sleepBeforeRetry({ ...context, milliseconds: DEFAULT_RETRY_DELAY_MS });
        continue;
      }
      if (response.ok) return response;
      const canRetry = retryableStatus(response);
      if (attempt === 1 && canRetry) {
        await sleepBeforeRetry({ ...context, milliseconds: retryDelay(response, context.now) });
        continue;
      }
      throw new GitHubRequestError(`GitHub request failed with status ${response.status}`, {
        status: response.status,
        retryable: canRetry,
      });
    }
    throw new GitHubRequestError('GitHub request exhausted its retry budget');
  };
}

function createHeaders(token) {
  return {
    accept: 'application/vnd.github+json',
    authorization: `Bearer ${token}`,
    'user-agent': 'github-profile-stats',
    'x-github-api-version': REST_API_VERSION,
  };
}

async function decodeGraphql(response) {
  const payload = await safeJson(response);
  if (Array.isArray(payload.errors) && payload.errors.length > 0) {
    throw new GitHubGraphqlError('GitHub GraphQL response contained errors', {
      status: response.status,
      errors: payload.errors.map(({ type, path, message }) => ({ type, path, message })),
    });
  }
  return payload;
}

export function createGitHubClient({
  token,
  fetchImpl = globalThis.fetch,
  sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  now = Date.now,
  deadlineAt = now() + 60_000,
  requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
}) {
  if (typeof token !== 'string' || token.length === 0) throw new TypeError('token is required');
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function');
  const request = createRequester({ fetchImpl, sleep, now, deadlineAt, requestTimeoutMs });
  const headers = createHeaders(token);

  return Object.freeze({
    async requestRest({ path, query, beforeAttempt }) {
      const response = await request({
        url: buildUrl(path, query),
        beforeAttempt,
        init: { headers },
      });
      return safeJson(response);
    },

    async requestGraphql({ query, variables, beforeAttempt }) {
      const response = await request({
        url: new URL('/graphql', 'https://api.github.com'),
        beforeAttempt,
        init: {
          method: 'POST',
          headers: { ...headers, 'content-type': 'application/json' },
          body: JSON.stringify({ query, variables }),
        },
      });
      return decodeGraphql(response);
    },
  });
}
