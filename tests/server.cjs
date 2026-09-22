const http = require('node:http');
const { readFile } = require('node:fs/promises');
const path = require('node:path');
http.createServer(async (req, res) => {
  if (req.url !== '/' && req.url !== '/index.html') { res.writeHead(404).end(); return; }
  try {
    const html = await readFile(path.join(__dirname, '../dist/index.html'));
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }).end(html);
  } catch { res.writeHead(500).end(); }
}).listen(8765, '127.0.0.1');
