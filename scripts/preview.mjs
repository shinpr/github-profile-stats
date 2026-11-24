// Serves the cards in assets/ on one page, to look at them in a browser while developing.
// Usage: npm run preview -- --port 4173
import { readdir, readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { basename, join } from 'node:path';

const ASSETS = join(import.meta.dirname, '..', 'assets');

function portFrom(argv) {
  const at = argv.indexOf('--port');
  const port = at === -1 ? 4173 : Number(argv[at + 1]);
  if (!Number.isInteger(port) || port <= 0 || port > 65_535) {
    throw new TypeError('--port must be a port number');
  }
  return port;
}

async function page() {
  const cards = (await readdir(ASSETS)).filter((name) => name.endsWith('.svg')).sort();
  const figures = cards.map((name) => {
    const dark = name.endsWith('-dark.svg');
    return `<figure class="${dark ? 'dark' : 'light'}"><img src="/assets/${name}" alt=""><figcaption>${name}</figcaption></figure>`;
  });
  return `<!doctype html>
<meta charset="utf-8">
<title>GitHub Profile Stats preview</title>
<style>
  body { margin: 24px; font: 14px system-ui, sans-serif; }
  main { display: flex; flex-wrap: wrap; gap: 16px; }
  figure { margin: 0; padding: 12px; border-radius: 8px; }
  .light { background: #ffffff; color: #1f2328; }
  .dark { background: #0d1117; color: #e6edf3; }
  img { display: block; max-width: 640px; }
</style>
<h1>GitHub Profile Stats preview</h1>
<main>${figures.join('\n')}</main>
`;
}

const server = createServer(async (request, response) => {
  try {
    const path = new URL(request.url ?? '/', 'http://localhost').pathname;
    if (path === '/') {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end(await page());
      return;
    }
    const name = basename(path);
    if (path === `/assets/${name}` && name.endsWith('.svg')) {
      const svg = await readFile(join(ASSETS, name));
      response.writeHead(200, { 'content-type': 'image/svg+xml' });
      response.end(svg);
      return;
    }
    response.writeHead(404).end();
  } catch {
    response.writeHead(404).end();
  }
});

const port = portFrom(process.argv);
server.listen(port, '127.0.0.1', () => {
  console.log(`Preview: http://localhost:${port}/`);
});
