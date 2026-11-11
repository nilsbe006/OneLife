// Startet einen lokalen Server und führt alle Browser-Tests nacheinander aus.
// Voraussetzung (einmalig): npm install && npx playwright install chromium
// Ausführen: npm run test:e2e
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const PORT = Number(process.env.PORT || 8765);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png' };

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = path.join(root, urlPath.endsWith('/') ? `${urlPath}index.html` : urlPath);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
// Mit BASE=<url> laufen die Tests gegen eine bestehende Seite (z. B. GitHub Pages) statt gegen den lokalen Server
const BASE = process.env.BASE || `http://localhost:${PORT}/`;
if (!process.env.BASE) await new Promise((r) => server.listen(PORT, r));
console.log(`Teste gegen ${BASE}`);

const out = path.join(here, 'shots');
fs.mkdirSync(out, { recursive: true });
const only = process.argv.slice(2);
const files = fs.readdirSync(here).filter((f) => /^e2e-.*\.mjs$/.test(f) && (!only.length || only.some((o) => f.includes(o)))).sort();
let failed = 0;
for (const f of files) {
  // asynchron starten, damit der Server in diesem Prozess weiter antworten kann
  const r = await new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(here, f)], {
      cwd: here, env: { ...process.env, BASE, OUT: out },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('close', (status) => resolve({ status, stdout, stderr }));
  });
  const ok = r.status === 0;
  if (!ok) failed++;
  console.log(`${ok ? '✔' : '✖'} ${f}`);
  if (!ok) console.log((r.stdout + r.stderr).split('\n').filter((l) => /FAIL|Error/.test(l)).slice(0, 10).join('\n'));
}
if (server.listening) server.close();
console.log(failed ? `\n${failed} von ${files.length} Testdateien fehlgeschlagen` : `\nAlle ${files.length} Testdateien bestanden`);
process.exit(failed ? 1 : 0);
