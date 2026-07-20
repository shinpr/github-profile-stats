import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { createGitHubClient, GitHubRequestError } from '../../src/github/client.mjs';

test('should retry one transient response and return decoded JSON', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    if (calls === 1) return new Response('{}', { status: 500 });
    return Response.json({ ok: true });
  };
  const client = createGitHubClient({
    token: 'secret-token',
    fetchImpl,
    sleep: async () => {},
    deadlineAt: Date.now() + 10_000,
  });

  const payload = await client.requestRest({ path: '/user', query: {} });

  assert.deepEqual(payload, { ok: true });
  assert.equal(calls, 2);
});

test('should not retry an authentication failure or expose the token', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return Response.json({ message: 'Bad credentials' }, { status: 401 });
  };
  const client = createGitHubClient({
    token: 'highly-sensitive-token',
    fetchImpl,
    sleep: async () => {},
    deadlineAt: Date.now() + 10_000,
  });

  await assert.rejects(
    client.requestRest({ path: '/user', query: {} }),
    (error) => {
      assert.ok(error instanceof GitHubRequestError);
      assert.equal(error.status, 401);
      assert.doesNotMatch(error.message, /highly-sensitive-token/);
      return true;
    },
  );
  assert.equal(calls, 1);
});

test('should classify GraphQL errors without leaking variables into the message', async () => {
  const fixtureUrl = new URL('../fixtures/github/contribution-resource-limit.json', import.meta.url);
  const fixture = JSON.parse(await readFile(fixtureUrl, 'utf8'));
  const fetchImpl = async () => Response.json(fixture.response);
  const client = createGitHubClient({
    token: 'secret-token',
    fetchImpl,
    deadlineAt: Date.now() + 10_000,
  });

  await assert.rejects(
    client.requestGraphql({ query: 'query Test { viewer { login } }', variables: { secret: 'value' } }),
    (error) => {
      assert.equal(error.name, 'GitHubGraphqlError');
      assert.equal(error.errors[0].type, 'RESOURCE_LIMITS_EXCEEDED');
      assert.doesNotMatch(error.message, /value/);
      return true;
    },
  );
});
