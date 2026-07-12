import puppeteer from 'puppeteer';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const port = 8765;

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.pdf': 'application/pdf',
};

function prepareDist() {
  fs.rmSync(dist, { recursive: true, force: true });
  fs.mkdirSync(dist, { recursive: true });

  for (const file of ['index.html', 'photo.jpg']) {
    fs.copyFileSync(path.join(root, file), path.join(dist, file));
  }

  fs.writeFileSync(path.join(dist, '.nojekyll'), '');
}

function createServer() {
  return http.createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, `http://127.0.0.1:${port}`).pathname);
    const relativePath = urlPath === '/' ? 'index.html' : urlPath.replace(/^\//, '');
    const filePath = path.resolve(dist, relativePath);

    if (!filePath.startsWith(dist) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404).end();
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
    res.end(fs.readFileSync(filePath));
  });
}

async function main() {
  prepareDist();

  const server = createServer();
  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${port}/`, {
      waitUntil: 'networkidle0',
      timeout: 60000,
    });

    const pdfPath = path.join(dist, 'resume.pdf');
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      margin: { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' },
    });

    console.log(`Generated ${pdfPath}`);
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
