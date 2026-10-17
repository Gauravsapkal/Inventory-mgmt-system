const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PORT = 9876;
const ROOT = path.resolve(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACTS_DIR = 'C:/Users/User/.gemini/antigravity-ide/brain/f94adb6f-5bba-48a8-a4b4-30b2ad5d2978/sample_pdfs';

// Simple static server
const server = http.createServer((req, res) => {
  let reqPath = decodeURI(req.url.split('?')[0]);
  if (reqPath === '/') reqPath = '/scripts/pdf_viewer.html';
  const filePath = path.join(ROOT, reqPath.replace(/^\//, ''));

  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.ttf': 'font/ttf',
  };

  res.writeHead(200, {
    'Content-Type': mimeTypes[ext] || 'application/octet-stream',
    'Access-Control-Allow-Origin': '*'
  });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, async () => {
  console.log(`Server listening on port ${PORT}`);

  const targets = [
    { file: 'docs/sample_pdfs/Sample_Goods_Receipt_Note_GRN.pdf', out: 'grn_preview.png' },
    { file: 'docs/sample_pdfs/Sample_Tax_Invoice.pdf', out: 'invoice_preview.png' },
    { file: 'docs/sample_pdfs/Sample_MultiPage_GRN_StressTest.pdf', out: 'multipage_grn_p1_preview.png' },
  ];

  for (const t of targets) {
    const outPath = path.join(ARTIFACTS_DIR, t.out);
    const url = `http://localhost:${PORT}/scripts/pdf_viewer.html?file=/${t.file}`;
    console.log(`Rendering ${t.file} -> ${outPath}...`);
    try {
      execSync(`"${CHROME}" --headless=new --disable-gpu --screenshot="${outPath}" --window-size=1250,1650 --virtual-time-budget=5000 "${url}"`, {
        stdio: 'inherit',
        timeout: 20000,
      });
      console.log(`Saved screenshot: ${outPath} (${fs.statSync(outPath).size} bytes)`);
    } catch (err) {
      console.error(`Failed to capture ${t.file}:`, err.message);
    }
  }

  server.close(() => {
    console.log('Rendering completed and server stopped.');
    process.exit(0);
  });
});
