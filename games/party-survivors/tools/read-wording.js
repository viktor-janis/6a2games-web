// ============================================================
// Party Survivors — čtečka wording.xlsx (round-trip pro úpravy textů)
// Vypíše řádky, kde je vyplněný sloupec „Nový text" (= požadovaná změna).
// Zvládá formát, do kterého xlsx uloží Excel (sharedStrings + deflate).
// Spuštění:  node tools/read-wording.js  [--json]
// ============================================================
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const file = path.join(__dirname, '..', 'wording.xlsx');
const buf = fs.readFileSync(file);

// ---------- ZIP reader (store + deflate) ----------
function readZip(b) {
  let eocd = -1;
  for (let i = b.length - 22; i >= 0; i--) { if (b.readUInt32LE(i) === 0x06054b50) { eocd = i; break; } }
  if (eocd < 0) throw new Error('ZIP: EOCD nenalezen');
  const count = b.readUInt16LE(eocd + 10);
  let off = b.readUInt32LE(eocd + 16);
  const out = {};
  for (let n = 0; n < count; n++) {
    if (b.readUInt32LE(off) !== 0x02014b50) throw new Error('ZIP: chybná central directory');
    const method = b.readUInt16LE(off + 10);
    const compSize = b.readUInt32LE(off + 20);
    const nameLen = b.readUInt16LE(off + 28);
    const extraLen = b.readUInt16LE(off + 30);
    const commentLen = b.readUInt16LE(off + 32);
    const lho = b.readUInt32LE(off + 42);
    const name = b.toString('utf8', off + 46, off + 46 + nameLen);
    const lhNameLen = b.readUInt16LE(lho + 26);
    const lhExtraLen = b.readUInt16LE(lho + 28);
    const dataStart = lho + 30 + lhNameLen + lhExtraLen;
    const comp = b.subarray(dataStart, dataStart + compSize);
    out[name] = method === 8 ? zlib.inflateRawSync(comp) : Buffer.from(comp);
    off += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

const unesc = (s) => s
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
  .replace(/&amp;/g, '&');

function parseShared(xml) {
  if (!xml) return [];
  const out = [];
  const re = /<si\b[^>]*>([\s\S]*?)<\/si>|<si\b[^>]*\/>/g;
  let m;
  while ((m = re.exec(xml))) {
    if (m[1] === undefined) { out.push(''); continue; }
    let text = ''; const reT = /<t\b[^>]*>([\s\S]*?)<\/t>/g; let tm;
    while ((tm = reT.exec(m[1]))) text += tm[1];
    out.push(unesc(text));
  }
  return out;
}

const colIdx = (ref) => {
  const m = /^([A-Z]+)/.exec(ref); let c = 0;
  for (const ch of m[1]) c = c * 26 + (ch.charCodeAt(0) - 64);
  return c - 1;
};

function parseSheet(xml, shared) {
  const rows = [];
  const reRow = /<row\b([^>]*)>([\s\S]*?)<\/row>/g; let rm;
  while ((rm = reRow.exec(xml))) {
    const cells = [];
    const reC = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g; let cm;
    while ((cm = reC.exec(rm[2]))) {
      const attrs = cm[1], body = cm[2] || '';
      const rref = /\br="([A-Z]+\d+)"/.exec(attrs); if (!rref) continue;
      const ci = colIdx(rref[1]);
      const tt = /\bt="([^"]+)"/.exec(attrs); const type = tt ? tt[1] : 'n';
      let val = '';
      if (type === 's') { const v = /<v>([\s\S]*?)<\/v>/.exec(body); if (v) val = shared[+v[1]] || ''; }
      else if (type === 'inlineStr') { let t = ''; const reT = /<t\b[^>]*>([\s\S]*?)<\/t>/g; let tm; while ((tm = reT.exec(body))) t += tm[1]; val = unesc(t); }
      else if (type === 'str') { const v = /<v>([\s\S]*?)<\/v>/.exec(body); if (v) val = unesc(v[1]); }
      else { const v = /<v>([\s\S]*?)<\/v>/.exec(body); if (v) val = v[1]; }
      cells[ci] = val;
    }
    rows.push(cells);
  }
  return rows;
}

// ---------- mapování listů (názvy + pořadí) ----------
const zip = readZip(buf);
const wb = zip['xl/workbook.xml'].toString('utf8');
const rels = zip['xl/_rels/workbook.xml.rels'].toString('utf8');
const relMap = {};
{ const re = /<Relationship\b[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g; let m; while ((m = re.exec(rels))) relMap[m[1]] = m[2]; }
const sheets = [];
{ const re = /<sheet\b[^>]*name="([^"]*)"[^>]*r:id="([^"]+)"/g; let m;
  while ((m = re.exec(wb))) {
    let tgt = relMap[m[2]] || ''; tgt = tgt.replace(/^\//, '');
    if (!tgt.startsWith('xl/')) tgt = 'xl/' + tgt;
    sheets.push({ name: unesc(m[1]), path: tgt });
  } }

const shared = parseShared(zip['xl/sharedStrings.xml'] ? zip['xl/sharedStrings.xml'].toString('utf8') : '');

const changes = [];
for (const s of sheets) {
  const xml = zip[s.path] ? zip[s.path].toString('utf8') : '';
  const rows = parseSheet(xml, shared);
  if (!rows.length) continue;
  const head = rows[0].map(x => (x || '').trim());
  const idx = (label) => head.findIndex(h => h === label);
  const iKey = idx('Klíč'), iField = idx('Pole'), iSrc = idx('Zdroj'),
        iVis = idx('Viditelné hráči'), iOld = idx('Aktuální text'), iNew = idx('Nový text'), iNote = idx('Poznámka');
  for (let r = 1; r < rows.length; r++) {
    const c = rows[r];
    const nw = (c[iNew] || '').trim();
    if (!nw) continue;
    changes.push({
      sheet: s.name, key: c[iKey] || '', field: c[iField] || '', src: c[iSrc] || '',
      vis: c[iVis] || '', old: c[iOld] || '', neu: c[iNew] || '', note: c[iNote] || '',
    });
  }
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(changes, null, 2));
} else {
  console.log(`Změn (vyplněný „Nový text"): ${changes.length}\n`);
  let cur = '';
  for (const ch of changes) {
    if (ch.sheet !== cur) { cur = ch.sheet; console.log(`\n===== ${cur} =====`); }
    console.log(`[${ch.key}]  (${ch.field}, viditelné: ${ch.vis})  zdroj: ${ch.src}`);
    console.log(`   STARÉ: ${JSON.stringify(ch.old)}`);
    console.log(`   NOVÉ:  ${JSON.stringify(ch.neu)}`);
  }
}
