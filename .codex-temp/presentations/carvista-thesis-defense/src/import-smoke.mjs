import { Presentation, PresentationFile, column, text, fill, hug } from '@oai/artifact-tool';
import fs from 'node:fs/promises';
const p = Presentation.create({ slideSize: { width: 1920, height: 1080 } });
const s = p.slides.add();
s.compose(column({ width: fill, height: fill, padding: 80 }, [text('Test import', { name:'t', style: { fontSize: 72, color: '#0F172A', bold: true }, height: hug })]), { frame: { left: 0, top: 0, width: 1920, height: 1080 }, baseUnit: 8 });
const pptx = await PresentationFile.exportPptx(p); await pptx.save('scratch/import-test.pptx');
console.log('import static', String(PresentationFile.importPptx).slice(0,1000));
try {
 const data=await fs.readFile('scratch/import-test.pptx');
 const imported = await PresentationFile.importPptx(new Blob([data]));
 console.log('imported type', imported, Object.keys(imported||{}));
} catch(e) { console.error('import error', e.stack || e); }
