import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = Number(process.env.PORT || 3000);

app.disable('x-powered-by');

app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

app.use((req, res, next) => {
  const origin = req.headers.origin;
  const configured = process.env.APP_URL;
  const allowed = new Set([
    'http://localhost:3000',
    'http://localhost:5173',
    'https://scriptflow-pro.onrender.com',
    configured,
  ].filter(Boolean));

  if (origin && (allowed.has(origin) || origin.endsWith('.onrender.com'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Lightweight endpoints used by the in-app connection monitor. They intentionally
// run before express.json() so the upload probe can measure raw request throughput.
app.get('/api/network/ping', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.status(204).end();
});

app.get('/api/network/download', (req, res) => {
  const requested = Number.parseInt(String(req.query.bytes || '262144'), 10);
  const bytes = Math.min(Math.max(Number.isFinite(requested) ? requested : 262144, 16 * 1024), 512 * 1024);
  const payload = Buffer.alloc(bytes);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Length', String(bytes));
  res.end(payload);
});

app.post('/api/network/upload', express.raw({ type: 'application/octet-stream', limit: '512kb' }), (req, res) => {
  const bytes = Buffer.isBuffer(req.body) ? req.body.length : 0;
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.json({ receivedBytes: bytes });
});

app.use(express.json({ limit: '1mb' }));

// Keep health before the SPA wildcard so /health returns JSON.
app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString(), uptime: process.uptime() });
});

app.use((req, res, next) => {
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
    "style-src 'self' 'unsafe-inline' https:",
    "img-src 'self' data: https: http: blob:",
    "font-src 'self' data: https:",
    "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https:",
    "frame-src 'self' https://*.firebaseapp.com https://accounts.google.com https://*.google.com https://fast.com https://www.fast.com",
    "media-src 'self' https: blob:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
  res.setHeader('Content-Security-Policy', csp);
  next();
});

app.use(express.static(path.join(__dirname, 'dist'), { maxAge: '1d', etag: true }));

app.get('*', (req, res) => {
  if (req.path === '/favicon.ico') return res.status(204).end();
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.use((err, _req, res, _next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message,
  });
});

app.listen(PORT, '0.0.0.0', () => console.log(`ScriptFlow Pro running on port ${PORT}`));
