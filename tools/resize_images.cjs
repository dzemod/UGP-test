// Responsive copies of site photos: for every site/assets/img/<name>.jpg wider than 600px
// creates <name>-600.jpg and (if wider than 1200px) <name>-1200.jpg. Originals are not touched.
// Resizing is done by headless Chrome (canvas, high-quality smoothing) — no Python/ImageMagick needed.
//
// Usage (from the project root):
//   npm i --no-save puppeteer-core            (once, or point NODE_PATH at an existing install)
//   node tools/resize_images.cjs [--force] [name ...]
// Env: CHROME_PATH — path to chrome.exe (default: the standard Windows install path).
// Already existing copies are skipped unless --force is given (rerun with --force after replacing a photo).
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const IMG_DIR = path.join(__dirname, '..', 'site', 'assets', 'img');
const WIDTHS = [600, 1200];
const QUALITY = 0.82;
const SKIP = /-(600|1200)\.jpg$|^(team|review)-\d\.jpg$/; // copies themselves; portraits are already ≤ 800px
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

(async () => {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const only = args.filter((a) => !a.startsWith('--'));
  const files = fs.readdirSync(IMG_DIR).filter((f) => f.endsWith('.jpg') && !SKIP.test(f) && (!only.length || only.includes(f.replace(/\.jpg$/, ''))));
  const browser = await puppeteer.launch({ executablePath: CHROME });
  const page = await browser.newPage();
  for (const file of files) {
    const src = 'data:image/jpeg;base64,' + fs.readFileSync(path.join(IMG_DIR, file)).toString('base64');
    for (const w of WIDTHS) {
      const out = path.join(IMG_DIR, file.replace(/\.jpg$/, `-${w}.jpg`));
      if (!force && fs.existsSync(out)) continue;
      const res = await page.evaluate(async (s, width, q) => {
        const img = new Image(); img.src = s; await img.decode();
        if (img.naturalWidth <= width) return null;            // не збільшуємо
        const c = document.createElement('canvas');
        c.width = width; c.height = Math.round(img.naturalHeight * width / img.naturalWidth);
        const ctx = c.getContext('2d'); ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, c.width, c.height);
        return { data: c.toDataURL('image/jpeg', q), h: c.height };
      }, src, w, QUALITY);
      if (!res) continue;
      fs.writeFileSync(out, Buffer.from(res.data.split(',')[1], 'base64'));
      console.log(`${path.basename(out)}  ${w}x${res.h}  ${Math.round(fs.statSync(out).size / 1024)} KB`);
    }
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
