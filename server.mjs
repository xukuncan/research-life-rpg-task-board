import { createServer } from 'node:http';
import { readFile, mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const dataDirectory = join(root, 'data');
const dataFile = join(dataDirectory, 'state.json');
const host = '127.0.0.1';
const port = 4317;
const maxBodyBytes = 10 * 1024 * 1024;
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

function send(response, status, body = '') {
  response.writeHead(status, {
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Content-Type': 'text/plain; charset=utf-8',
  });
  response.end(body);
}

async function readRequestBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBodyBytes) throw new Error('body-too-large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function handleApi(request, response) {
  if (request.method === 'GET') {
    try {
      const content = await readFile(dataFile, 'utf8');
      response.writeHead(200, { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Type': 'application/json; charset=utf-8' });
      response.end(content);
    } catch (error) {
      if (error.code === 'ENOENT') response.writeHead(204).end();
      else send(response, 500, '读取项目数据失败');
    }
    return;
  }
  if (request.method !== 'PUT') {
    response.setHeader('Allow', 'GET, PUT');
    send(response, 405, '不支持的请求方法');
    return;
  }
  let state;
  try {
    state = JSON.parse(await readRequestBody(request));
  } catch (error) {
    send(response, error.message === 'body-too-large' ? 413 : 400, error.message === 'body-too-large' ? '数据文件过大' : '数据格式无效');
    return;
  }
  if (!state || typeof state !== 'object' || !Array.isArray(state.tasks) || !state.economy || !Array.isArray(state.economy.ledger)) {
    send(response, 400, '数据结构无效');
    return;
  }
  try {
    await mkdir(dataDirectory, { recursive: true });
    const temporaryFile = `${dataFile}.${process.pid}.tmp`;
    await writeFile(temporaryFile, `${JSON.stringify(state, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    await rename(temporaryFile, dataFile);
    response.writeHead(200, { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Type': 'application/json; charset=utf-8' });
    response.end('{"saved":true}');
  } catch {
    send(response, 500, '写入项目数据失败');
  }
}

const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, `http://${host}:${port}`).pathname;
  if (pathname === '/api/state') {
    await handleApi(request, response);
    return;
  }
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.setHeader('Allow', 'GET, HEAD');
    send(response, 405, '不支持的请求方法');
    return;
  }
  let decodedPath;
  try { decodedPath = decodeURIComponent(pathname); } catch { send(response, 400, '路径格式无效'); return; }
  const relativePath = decodedPath === '/' ? 'index.html' : decodedPath.replace(/^\/+/, '');
  const filePath = resolve(root, relativePath);
  if (!filePath.startsWith(`${root}${sep}`) || filePath.startsWith(`${dataDirectory}${sep}`)) {
    send(response, 403, '禁止访问');
    return;
  }
  try {
    const content = await readFile(filePath);
    response.writeHead(200, {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Type': mimeTypes[extname(filePath).toLowerCase()] || 'application/octet-stream',
    });
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch (error) {
    send(response, error.code === 'ENOENT' ? 404 : 500, error.code === 'ENOENT' ? '文件不存在' : '读取文件失败');
  }
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`端口 ${port} 已被占用。请关闭已运行的任务系统窗口后重试。`);
  } else {
    console.error('本地服务启动失败：', error.message);
  }
  process.exitCode = 1;
});

server.listen(port, host, () => {
  console.log(`研究牲任务系统已启动：http://${host}:${port}`);
  console.log(`项目数据文件：${dataFile}`);
  console.log('保持此窗口运行；按 Ctrl+C 可停止服务。');
});
