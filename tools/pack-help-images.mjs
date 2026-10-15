// Mette le immagini di tools/guide-shots/*.webp in src/helpimg2.js (data URI, l'app resta un file solo e offline)
import fs from 'fs';
const dir = new URL('./guide-shots/', import.meta.url);
const names = fs.readdirSync(dir).filter(f => f.endsWith('.webp')).sort();
const body = names.map(f => `  '${f.replace('.webp', '')}': 'data:image/webp;base64,${fs.readFileSync(new URL(f, dir)).toString('base64')}',`).join('\n');
fs.writeFileSync(new URL('../src/helpimg2.js', import.meta.url), `// generato da tools/pack-help-images.mjs a partire da tools/guide-shots (immagini fatte con tools/guide-shots.py)\nexport default {\n${body}\n};\n`);
console.log(names.length, 'immagini');
