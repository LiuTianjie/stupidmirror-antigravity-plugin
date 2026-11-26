#!/usr/bin/env node
import { spawn } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import http from 'node:http';
import { homedir } from 'node:os';
import { basename, dirname, join, sep } from 'node:path';
import { SidecarApp, Response } from 'sidecar_sdk';
import { sanitizedDesktopLaunchEnv, shouldAutoLaunchForViewerCall } from './launchPolicy.mjs';

const ALLOWED_TOOLS = new Set(['show_screen', 'screen_frame', 'screen_action', 'screen_signal']);
const CONV_ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/;
const MAX_ANNOTATION_BYTES = 16 * 1024 * 1024;
const MAX_SAVED_ANNOTATIONS = 50;
const SIDECAR_META = '<meta name="stupidmirror-viewer" content="sidecar"><script src="/preload.js"></script>';

let lastLaunchAttemptMs = 0;

function getPlatformDataDir() {
  const home = homedir();
  if (process.platform === 'darwin') {
    return join(home, 'Library', 'Application Support', 'StupidMirror');
  }
  if (process.platform === 'win32') {
    return join(process.env.APPDATA || join(home, 'AppData', 'Roaming'), 'StupidMirror');
  }
  return join(process.env.XDG_CONFIG_HOME || join(home, '.config'), 'StupidMirror');
}

function resolveAppPath() {
  const home = homedir();
  const dataDir = getPlatformDataDir();
  const candidates = [];
  if (process.env.STUPIDMIRROR_APP) {
    candidates.push(process.env.STUPIDMIRROR_APP);
  }
  for (const file of [
    join(dataDir, 'Clients', 'app-path'),
    join(dataDir, 'Antigravity', 'app-path'),
    join(dataDir, 'Codex', 'app-path'),
  ]) {
    try {
      if (existsSync(file)) {
        const saved = readFileSync(file, 'utf8').trim();
        if (saved) candidates.push(saved);
      }
    } catch {
      // Ignore unreadable hint files.
    }
  }
  if (process.platform === 'darwin') {
    candidates.push('/Applications/StupidMirror.app', join(home, 'Applications/StupidMirror.app'));
  } else if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || join(home, 'AppData', 'Local');
    candidates.push(
      join(localAppData, 'Programs', 'StupidMirror', 'StupidMirror.exe'),
      'C:\\Program Files\\StupidMirror\\StupidMirror.exe',
    );
  }
  for (const appPath of candidates) {
    const baseDir = appPath.endsWith('.exe') ? dirname(appPath) : appPath;
    for (const htmlPath of [
      join(appPath, 'Contents/Resources/plugins/stupidmirror/assets/phone-screen.html'),
      join(appPath, 'Contents/Resources/CodexPlugin/plugins/stupidmirror/assets/phone-screen.html'),
      join(baseDir, 'resources/plugins/stupidmirror/assets/phone-screen.html'),
      join(baseDir, 'resources/phone-screen.html'),
      join(baseDir, 'plugins/stupidmirror/assets/phone-screen.html'),
    ]) {
      if (existsSync(htmlPath)) {
        return { appPath, htmlPath };
      }
    }
  }
  for (const appPath of candidates) {
    if (existsSync(appPath)) {
      return { appPath, htmlPath: null };
    }
  }
  return { appPath: null, htmlPath: null };
}

function readConnectionRecord() {
  const filePath = join(getPlatformDataDir(), 'MCP', 'connection.json');
  try {
    const stat = statSync(filePath);
    if (!stat.isFile()) return null;
    if (process.platform !== 'win32') {
      if (typeof process.getuid === 'function' && stat.uid !== process.getuid()) return null;
      if ((stat.mode & 0o077) !== 0) return null;
    }
    const raw = JSON.parse(readFileSync(filePath, 'utf8'));
    if (raw?.schemaVersion !== 1 || typeof raw?.endpoint !== 'string' || typeof raw?.bearerToken !== 'string') {
      return null;
    }
    const endpoint = new URL(raw.endpoint);
    if (
      endpoint.protocol !== 'http:' ||
      endpoint.hostname !== '127.0.0.1' ||
      endpoint.pathname !== '/mcp' ||
      !endpoint.port ||
      !raw.bearerToken ||
      /\s/.test(raw.bearerToken)
    ) {
      return null;
    }
    const port = Number(endpoint.port);
    if (!Number.isInteger(port) || port < 1024 || port > 65535) return null;
    const pid = Number(raw.processID);
    if (Number.isInteger(pid) && pid > 0) {
      try {
        process.kill(pid, 0);
      } catch (err) {
        if (err && err.code === 'ESRCH') return null;
      }
    }
    return { port, bearerToken: raw.bearerToken, pid };
  } catch {
    return null;
  }
}

function launchAppIfNeeded() {
  const now = Date.now();
  if (now - lastLaunchAttemptMs < 10_000) return false;
  const { appPath } = resolveAppPath();
  if (!appPath || !existsSync(appPath)) return false;
  lastLaunchAttemptMs = now;
  const env = sanitizedDesktopLaunchEnv();
  try {
    if (process.platform === 'darwin' && appPath.endsWith('.app')) {
      const child = spawn('/usr/bin/open', ['-g', '-a', appPath], {
        stdio: 'ignore',
        detached: true,
        env,
      });
      child.unref();
      return true;
    }
    const child = spawn(appPath, [], {
      stdio: 'ignore',
      detached: true,
      windowsHide: true,
      env,
    });
    child.unref();
    return true;
  } catch {
    return false;
  }
}

async function ensureConnection({ allowLaunch = false } = {}) {
  let conn = readConnectionRecord();
  if (conn) return conn;
  if (allowLaunch && launchAppIfNeeded()) {
    for (let i = 0; i < 16; i++) {
      await new Promise((r) => setTimeout(r, 250));
      conn = readConnectionRecord();
      if (conn) return conn;
    }
  }
  return readConnectionRecord();
}

function postLocalViewerCall(conn, payload) {
  return new Promise((resolve, reject) => {
    const body = Buffer.from(JSON.stringify(payload), 'utf8');
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: conn.port,
        path: '/viewer/api/call',
        method: 'POST',
        headers: {
          Host: `127.0.0.1:${conn.port}`,
          'Content-Type': 'application/json',
          'Content-Length': body.length,
          Authorization: `Bearer ${conn.bearerToken}`,
        },
        timeout: 240_000,
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode ?? 502,
            body: Buffer.concat(chunks).toString('utf8'),
          });
        });
      },
    );
    req.on('timeout', () => {
      req.destroy(new Error('StupidMirror viewer request timed out'));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function findBrainDir() {
  const dataDir = process.env.ANTIGRAVITY_EXECUTABLE_DATA_DIR;
  if (!dataDir) return null;
  for (let d = dataDir; d !== dirname(d); d = dirname(d)) {
    if (basename(d) !== 'sidecar_data') continue;
    const brain = join(dirname(d), 'brain');
    if (existsSync(brain)) return brain;
  }
  return null;
}

function resolveAnnotationDir(conversationId) {
  if (typeof conversationId === 'string' && CONV_ID_RE.test(conversationId)) {
    const brainDir = findBrainDir();
    if (brainDir) {
      try {
        const brainReal = realpathSync(brainDir);
        const convDir = join(brainReal, conversationId);
        if (existsSync(convDir)) {
          const convReal = realpathSync(convDir);
          if (convReal.startsWith(brainReal + sep)) {
            const targetDir = join(convReal, 'stupidmirror-annotations');
            mkdirSync(targetDir, { recursive: true, mode: 0o700 });
            return targetDir;
          }
        }
      } catch {
        // Fall through to app support fallback.
      }
    }
  }
  const fallback = join(homedir(), 'Library/Application Support/StupidMirror/Antigravity/annotations');
  mkdirSync(fallback, { recursive: true, mode: 0o700 });
  return fallback;
}

function pruneOldAnnotations(dir) {
  try {
    const files = readdirSync(dir)
      .filter((name) => name.startsWith('annotation-') && name.endsWith('.png'))
      .map((name) => {
        const full = join(dir, name);
        return { full, mtime: statSync(full).mtimeMs };
      })
      .sort((a, b) => b.mtime - a.mtime);
    for (const stale of files.slice(MAX_SAVED_ANNOTATIONS)) {
      try {
        unlinkSync(stale.full);
      } catch {
        // Ignore cleanup errors.
      }
    }
  } catch {
    // Ignore listing errors.
  }
}

function fallbackHtml(title, detail) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>StupidMirror</title>
  <script src="/preload.js"></script>
  <style>
    :root { color-scheme: light dark; font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; background: var(--background, #141414); color: var(--foreground, #f2f2f2); }
    .card { max-width: 340px; text-align: center; line-height: 1.6; }
    h1 { font-size: 16px; margin: 0 0 8px; }
    p { font-size: 13px; opacity: 0.78; margin: 0 0 16px; }
    button { font: inherit; font-size: 13px; padding: 7px 16px; border-radius: 8px; border: 1px solid currentColor; background: transparent; color: inherit; cursor: pointer; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${detail}</p>
    <button type="button" onclick="location.reload()">重新加载</button>
  </div>
</body>
</html>`;
}

function jsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    contentType: 'application/json; charset=utf-8',
    headers: { 'Cache-Control': 'no-store' },
  });
}

const app = new SidecarApp();

app.page('/', () => {
  const { htmlPath } = resolveAppPath();
  if (!htmlPath) {
    return new Response(
      fallbackHtml('未找到 StupidMirror 应用', '请确认 StupidMirror 已安装在「应用程序」目录，并在设置 → MCP 自动化中开启本地 MCP 服务后点击重新加载。'),
      { contentType: 'text/html; charset=utf-8', headers: { 'Cache-Control': 'no-store' } },
    );
  }
  try {
    const html = readFileSync(htmlPath, 'utf8');
    const headIdx = html.indexOf('<head>');
    const injected = headIdx >= 0
      ? html.slice(0, headIdx + 6) + SIDECAR_META + html.slice(headIdx + 6)
      : SIDECAR_META + html;
    return new Response(injected, {
      contentType: 'text/html; charset=utf-8',
      headers: {
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err) {
    return new Response(
      fallbackHtml('无法加载手机画面组件', String(err?.message || err)),
      { contentType: 'text/html; charset=utf-8', headers: { 'Cache-Control': 'no-store' } },
    );
  }
});

app.api(
  '/api/health',
  () => {
    const { appPath, htmlPath } = resolveAppPath();
    const conn = readConnectionRecord();
    return {
      status: 'ok',
      app_found: Boolean(appPath && htmlPath),
      mcp_connected: Boolean(conn),
    };
  },
  'GET',
);

app.api(
  '/viewer/api/call',
  async (data) => {
    const name = typeof data?.name === 'string' ? data.name : '';
    if (!ALLOWED_TOOLS.has(name)) {
      return jsonResponse(403, { error: { code: 'tool_not_allowed', message: `The viewer cannot call ${name || 'unknown'}.` } });
    }
    const payload = {
      name,
      arguments: data?.arguments && typeof data.arguments === 'object' ? data.arguments : {},
    };
    const allowLaunch = shouldAutoLaunchForViewerCall(name, payload.arguments);
    let conn = await ensureConnection({ allowLaunch });
    if (!conn) {
      return jsonResponse(503, {
        error: {
          code: 'stupidmirror_not_running',
          message: '请先打开 StupidMirror 并开启「设置 → MCP 自动化」中的本地 MCP 服务。',
        },
      });
    }
    try {
      let upstream = await postLocalViewerCall(conn, payload);
      if (upstream.statusCode === 401) {
        const refreshed = readConnectionRecord();
        if (refreshed && (refreshed.bearerToken !== conn.bearerToken || refreshed.port !== conn.port)) {
          conn = refreshed;
          upstream = await postLocalViewerCall(conn, payload);
        }
      }
      return new Response(upstream.body, {
        status: upstream.statusCode,
        contentType: 'application/json; charset=utf-8',
        headers: { 'Cache-Control': 'no-store' },
      });
    } catch (firstErr) {
      const refreshed = await ensureConnection({ allowLaunch: false });
      if (refreshed && (refreshed.port !== conn.port || refreshed.bearerToken !== conn.bearerToken)) {
        try {
          const upstream = await postLocalViewerCall(refreshed, payload);
          return new Response(upstream.body, {
            status: upstream.statusCode,
            contentType: 'application/json; charset=utf-8',
            headers: { 'Cache-Control': 'no-store' },
          });
        } catch (retryErr) {
          return jsonResponse(502, {
            error: {
              code: 'upstream_unreachable',
              message: `无法连接 StupidMirror：${retryErr?.message || retryErr}`,
            },
          });
        }
      }
      return jsonResponse(502, {
        error: {
          code: 'upstream_unreachable',
          message: `无法连接 StupidMirror：${firstErr?.message || firstErr}`,
        },
      });
    }
  },
  'POST',
);

app.api(
  '/viewer/api/annotation',
  async (data) => {
    const rawBase64 = typeof data?.image_base64 === 'string' ? data.image_base64 : '';
    const cleaned = rawBase64.replace(/^data:image\/png;base64,/, '');
    if (!cleaned) {
      return jsonResponse(400, { error: { code: 'missing_image', message: '缺少标注截图数据。' } });
    }
    const buffer = Buffer.from(cleaned, 'base64');
    if (buffer.length === 0 || buffer.length > MAX_ANNOTATION_BYTES) {
      return jsonResponse(400, { error: { code: 'invalid_image', message: '标注截图大小无效或超过 16MB 限制。' } });
    }
    // Verify PNG magic signature.
    if (
      buffer.length < 8 ||
      buffer[0] !== 0x89 ||
      buffer[1] !== 0x50 ||
      buffer[2] !== 0x4e ||
      buffer[3] !== 0x47
    ) {
      return jsonResponse(400, { error: { code: 'invalid_png', message: '仅支持 PNG 格式的标注截图。' } });
    }
    const conversationId = typeof data?.conversation_id === 'string' ? data.conversation_id : '';
    const dir = resolveAnnotationDir(conversationId);
    const filename = `annotation-${Date.now()}.png`;
    const filePath = join(dir, filename);
    writeFileSync(filePath, buffer, { mode: 0o600 });
    pruneOldAnnotations(dir);
    return jsonResponse(200, { path: filePath, filename });
  },
  'POST',
);

app.run();
