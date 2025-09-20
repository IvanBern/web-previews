const http = require('http');
const path = require('path');
const fs = require('fs/promises');

const PUBLIC_DIR = __dirname;
const DEFAULT_PORT = Number.parseInt(process.env.PORT || '4173', 10);

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

function normalizePath(urlPath = '/') {
  const [clean] = urlPath.split('?');
  return clean.split('#')[0] || '/';
}

function buildFilePath(urlPath) {
  const normalized = normalizePath(urlPath);
  const safePath = normalized === '/' ? '/index.html' : normalized;
  const resolved = path.join(PUBLIC_DIR, safePath);
  if (!resolved.startsWith(PUBLIC_DIR)) {
    return null;
  }
  return resolved;
}

async function readFileSafe(filePath) {
  try {
    const data = await fs.readFile(filePath);
    return data;
  } catch (error) {
    return null;
  }
}

async function resolveAsset(urlPath) {
  const filePath = buildFilePath(urlPath);

  if (!filePath) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      body: 'Bad request',
    };
  }

  const fileBuffer = await readFileSafe(filePath);
  if (!fileBuffer) {
    return {
      statusCode: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      body: 'Not found',
    };
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = CONTENT_TYPES[ext] || 'application/octet-stream';

  return {
    statusCode: 200,
    headers: { 'Content-Type': contentType },
    body: fileBuffer,
  };
}

function createWebServer(options = {}) {
  const port = options.port ?? DEFAULT_PORT;

  const server = http.createServer(async (req, res) => {
    const result = await resolveAsset(req.url || '/');
    res.writeHead(result.statusCode, result.headers);
    res.end(result.body);
  });

  function start(listenPortOrCallback, maybeCallback) {
    let listenPort = port;
    let callback = maybeCallback;

    if (typeof listenPortOrCallback === 'function') {
      callback = listenPortOrCallback;
    } else if (typeof listenPortOrCallback === 'number') {
      listenPort = listenPortOrCallback;
    }

    return server.listen(listenPort, () => {
      if (typeof callback === 'function') {
        callback(server);
      }
    });
  }

  return { server, start, port };
}

async function ensureIndex() {
  const indexPath = path.join(PUBLIC_DIR, 'index.html');
  const exists = await readFileSafe(indexPath);
  if (!exists) {
    throw new Error(`Missing index.html at ${indexPath}`);
  }
}

async function bootstrap() {
  await ensureIndex();
  const { start, port } = createWebServer();
  start(() => {
    // eslint-disable-next-line no-console
    console.log(`Serving static files from ${PUBLIC_DIR} on http://localhost:${port}`);
  });
}

if (require.main === module) {
  bootstrap().catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  });
}

module.exports = { createWebServer, buildFilePath, normalizePath, resolveAsset };
