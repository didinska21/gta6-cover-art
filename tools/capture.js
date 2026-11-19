// VICE PANELS screenshot/export capture: serves app/ locally, drives headless
// Chromium over CDP (no packages), stages scenes through the app's own ?shot=
// scenes and VicePanels API, saves editor screenshots and exported cover PNGs
// into a work directory, and fails loudly on any console error.
// Run: node tools/capture.js <workdir>
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const appRoot = path.resolve(__dirname, '../app');
const work = path.resolve(process.argv[2] || '/tmp/vp-shots');
fs.mkdirSync(work, { recursive: true });
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.ttf': 'font/ttf', '.txt': 'text/plain' };
const server = http.createServer((req, res) => {
  let file = path.resolve(appRoot, '.' + decodeURIComponent(req.url.split('?')[0]));
  if (file === appRoot) file = path.join(appRoot, 'index.html');
  if (!file.startsWith(appRoot + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404).end(); return; }
    res.setHeader('Content-Type', MIME[path.extname(file)] || 'application/octet-stream');
    res.end(data);
  });
});

const SHOTS = [
  { name: 'exp-landscape', kind: 'export', w: 1920, h: 1080, url: '/?shot=1&n=4&preset=sunset&size=1920x1080&layout=4&title=NEON%20HEAT&caption=One%20last%20ride%20along%20the%20bay' },
  { name: 'exp-portrait', kind: 'export', w: 1080, h: 1350, url: '/?shot=1&n=3&preset=neon&size=1080x1350&layout=3&title=MIDNIGHT%20RUN&caption=Every%20light%20on%20the%20strip%20is%20a%20promise' },
  { name: 'exp-square', kind: 'export', w: 1080, h: 1080, url: '/?shot=1&n=2&preset=miami&size=1080x1080&layout=2&title=PALM%20CITY&caption=Trouble%20wears%20a%20pastel%20suit' },
  { name: 'ed-sunset', kind: 'page', url: '/?shot=1&n=4&preset=sunset&size=1920x1080' },
  { name: 'ed-neon', kind: 'page', url: '/?shot=1&n=3&preset=neon&size=1080x1350&layout=3&title=MIDNIGHT%20RUN&caption=Every%20light%20on%20the%20strip%20is%20a%20promise' },
];

server.listen(0, '127.0.0.1', async () => {
  const port = server.address().port;
  const errors = [];
  let browser, socket;
  try {
    browser = spawn(process.env.CHROMIUM || '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1194/chrome-linux/headless_shell',
      ['--headless', '--no-sandbox', '--disable-gpu', '--remote-allow-origins=*', '--remote-debugging-port=9226', 'about:blank'], { stdio: 'ignore' });
    let target;
    for (let i = 0; i < 100 && !target; i++) {
      try { target = await fetch('http://127.0.0.1:9226/json/new?about:blank', { method: 'PUT' }).then((r) => r.json()); }
      catch { await delay(100); }
    }
    if (!target) throw Error('CDP endpoint unavailable');
    socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((res, rej) => { socket.onopen = res; socket.onerror = rej; });
    let serial = 0; const pending = new Map();
    socket.onmessage = ({ data }) => {
      const m = JSON.parse(data);
      if (m.id) { const r = pending.get(m.id); pending.delete(m.id); if (r) r(m); }
      if (m.method === 'Runtime.exceptionThrown') errors.push('exception: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push('console.error: ' + m.params.args.map((a) => a.value || a.description || '').join(' '));
    };
    const send = (method, params = {}) => new Promise((resolve) => { const id = ++serial; pending.set(id, resolve); socket.send(JSON.stringify({ id, method, params })); });
    const evaluate = async (expr) => {
      const m = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
      if (m.result?.exceptionDetails) throw Error(m.result.exceptionDetails.exception?.description || m.result.exceptionDetails.text);
      return m.result?.result?.value;
    };
    await send('Runtime.enable');
    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 880, deviceScaleFactor: 1, mobile: false });

    for (const shot of SHOTS) {
      await send('Page.navigate', { url: `http://127.0.0.1:${port}${shot.url}` });
      let ready = false;
      for (let i = 0; i < 120 && !ready; i++) { ready = await evaluate('window.__shotReady === true').catch(() => false); if (!ready) await delay(250); }
      if (!ready) throw Error(`shot ${shot.name}: __shotReady never set`);
      await delay(150);
      if (shot.kind === 'export') {
        const dataUrl = await evaluate(`window.VicePanels.exportDataURL(${shot.w}, ${shot.h})`);
        fs.writeFileSync(path.join(work, shot.name + '.png'), Buffer.from(dataUrl.split(',')[1], 'base64'));
      } else {
        const shotMsg = await send('Page.captureScreenshot', { format: 'jpeg', quality: 88 });
        fs.writeFileSync(path.join(work, shot.name + '.jpg'), Buffer.from(shotMsg.result.data, 'base64'));
      }
      console.log('captured', shot.name);
    }
  } catch (e) {
    errors.push('fatal: ' + e.message);
  } finally {
    try { socket && socket.close(); } catch {}
    try { browser && browser.kill(); } catch {}
    server.close();
  }
  if (errors.length) { console.error('ERRORS:\n' + errors.join('\n')); process.exit(1); }
  console.log('all shots captured, zero console errors');
});
