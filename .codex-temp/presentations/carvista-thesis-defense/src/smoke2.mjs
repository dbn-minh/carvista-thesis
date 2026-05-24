import { Presentation, column, text, fill, hug } from '@oai/artifact-tool';
import fs from 'node:fs/promises';
const p = Presentation.create({ slideSize: { width: 1920, height: 1080 } });
const s = p.slides.add();
s.compose(column({ width: fill, height: fill, padding: 80 }, [text('Test', { name:'t', style: { fontSize: 72, color: '#0F172A', bold: true }, height: hug })]), { frame: { left: 0, top: 0, width: 1920, height: 1080 }, baseUnit: 8 });
const png = await s.export({ format: 'png' }); await fs.writeFile('scratch/test.png', Buffer.from(await png.arrayBuffer()));
const layout = await s.export({ format: 'layout' }); console.log('layout keys', Object.keys(layout)); await fs.writeFile('scratch/test.layout.json', JSON.stringify(layout,null,2));
console.log(JSON.stringify(layout,null,2).slice(0,1000));
