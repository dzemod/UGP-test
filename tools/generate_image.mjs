#!/usr/bin/env node
// Generate or edit an image with Google Gemini (Windows-friendly port of the starter's main.py).
//
// Usage (from the project root):
//   node tools/generate_image.mjs <output-path> "<prompt>" [--aspect 3:4] [--size 1K|2K|4K]
//                                 [--edit input.jpg] [--ref style.jpg ...] [--style styles/x.md]
//                                 [--model gemini-3-pro-image-preview]
//
// Reads GOOGLE_AI_API_KEY from .env in the project root. No npm install needed (Node 20.12+).
// Note: Gemini decides the file format (usually PNG). If it differs from the extension you
// asked for, the file is saved with the correct extension and the real path is printed.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_MODEL = 'gemini-3-pro-image-preview';
const ASPECTS = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'];
const SIZES = ['1K', '2K', '4K'];
const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

function fail(msg, code = 1) { console.error(`Error: ${msg}`); process.exit(code); }

// ---- arguments ----
const args = process.argv.slice(2);
const opts = { aspect: null, size: '1K', edit: null, refs: [], style: null, model: DEFAULT_MODEL };
const positional = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  const next = () => { if (i + 1 >= args.length) fail(`${a} needs a value`); return args[++i]; };
  if (a === '--aspect') opts.aspect = next();
  else if (a === '--size') opts.size = next().toUpperCase();
  else if (a === '--edit') opts.edit = next();
  else if (a === '--ref') opts.refs.push(next());
  else if (a === '--style') opts.style = next();
  else if (a === '--model') opts.model = next();
  else if (a === '-h' || a === '--help') { console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 11).join('\n')); process.exit(0); }
  else if (a.startsWith('--')) fail(`unknown flag ${a}`);
  else positional.push(a);
}
if (positional.length !== 2) fail('expected <output-path> and "<prompt>". Run with --help for usage.');
const [outArg, promptArg] = positional;
if (opts.aspect && !ASPECTS.includes(opts.aspect)) fail(`--aspect must be one of ${ASPECTS.join(', ')}`);
if (!SIZES.includes(opts.size)) fail(`--size must be one of ${SIZES.join(', ')}`);
if (opts.edit && opts.refs.length) fail('use either --edit or --ref, not both');
if (opts.refs.length > 14) fail('at most 14 --ref images');

// ---- API key ----
const envPath = join(ROOT, '.env');
if (existsSync(envPath)) process.loadEnvFile(envPath);
const apiKey = process.env.GOOGLE_AI_API_KEY;
if (!apiKey) fail(`GOOGLE_AI_API_KEY not found (looked in ${envPath})`);

// ---- prompt (optionally wrapped by a style template) ----
let prompt = promptArg;
if (opts.style) {
  const md = readFileSync(resolve(opts.style), 'utf8');
  const m = md.match(/#+\s*Prompt Template\s*\n([\s\S]*?)(?=\n#+\s|\s*$)/i);
  if (!m) fail(`no "Prompt Template" section in ${opts.style}`);
  const tpl = m[1].replace(/^```\w*\n?|```$/gm, '').trim();
  prompt = /\{(prompt|subject)\}/i.test(tpl) ? tpl.replace(/\{(prompt|subject)\}/gi, promptArg) : `${promptArg}\n\n${tpl}`;
}

const imagePart = (file) => {
  const p = resolve(file);
  if (!existsSync(p)) fail(`image not found: ${p}`);
  const mime = MIME[extname(p).toLowerCase()];
  if (!mime) fail(`unsupported image type: ${p} (use jpg, png or webp)`);
  return { inlineData: { mimeType: mime, data: readFileSync(p).toString('base64') } };
};
const parts = [{ text: prompt }];
if (opts.edit) parts.push(imagePart(opts.edit));
opts.refs.forEach((r) => parts.push(imagePart(r)));

const imageConfig = { imageSize: opts.size };
if (opts.aspect) imageConfig.aspectRatio = opts.aspect;

// ---- request ----
const url = `https://generativelanguage.googleapis.com/v1beta/models/${opts.model}:generateContent`;
console.log(`Generating with ${opts.model} (${opts.aspect || 'default aspect'}, ${opts.size})...`);
const started = Date.now();
let res;
try {
  res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'], imageConfig },
    }),
    signal: AbortSignal.timeout(300_000),
  });
} catch (e) {
  fail(`request failed: ${e.name === 'TimeoutError' ? 'timed out after 5 minutes' : e.message}`);
}

const body = await res.json().catch(() => null);
if (!res.ok) fail(`API ${res.status}: ${body?.error?.message || res.statusText}`);

const cand = body?.candidates?.[0];
const outParts = cand?.content?.parts || [];
const img = outParts.find((p) => p.inlineData?.data);
const text = outParts.filter((p) => p.text).map((p) => p.text).join('\n').trim();
if (!img) {
  const reason = cand?.finishReason || body?.promptFeedback?.blockReason || 'unknown';
  fail(`no image returned (reason: ${reason})${text ? `\nModel said: ${text}` : ''}`);
}

// ---- save ----
let outPath = resolve(outArg);
const realExt = EXT[img.inlineData.mimeType] || '.png';
const wantedExt = extname(outPath).toLowerCase().replace('.jpeg', '.jpg');
if (wantedExt !== realExt) {
  outPath = outPath.slice(0, outPath.length - extname(outPath).length) + realExt;
  console.log(`Note: Gemini returned ${img.inlineData.mimeType}; saving as ${realExt}`);
}
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, Buffer.from(img.inlineData.data, 'base64'));

const usage = body.usageMetadata;
console.log(`Saved: ${outPath}`);
console.log(`Time: ${((Date.now() - started) / 1000).toFixed(1)}s` + (usage ? ` · tokens: ${usage.totalTokenCount}` : ''));
if (text) console.log(`Model note: ${text}`);
