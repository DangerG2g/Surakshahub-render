import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import apiHandler from './api/[...path].js';

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.join(__dirname, 'dist');
const port = Number(process.env.PORT || 3001);

app.disable('x-powered-by');
app.use(express.json({ limit: '8mb' }));
app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'SurakshaHub API' }));
app.use('/api', (req, res, next) => {
  // Express strips the mount path from req.url; restore it for the shared API handler.
  req.url = `/api${req.url.startsWith('/') ? '' : '/'}${req.url}`;
  return apiHandler(req, res, next);
});
app.use(express.static(distDir, { index: false, maxAge: '1h' }));
app.use((req, res) => {
  if (req.method === 'GET' && !req.path.startsWith('/api/')) {
    return res.sendFile(path.join(distDir, 'index.html'));
  }
  return res.status(404).json({ error: 'Not found.' });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`SurakshaHub listening on port ${port}`);
});
