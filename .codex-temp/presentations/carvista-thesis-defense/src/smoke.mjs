import { Presentation, PresentationFile, column, text, fill, hug } from '@oai/artifact-tool';
const p = Presentation.create({ slideSize: { width: 1920, height: 1080 } });
const s = p.slides.add();
s.compose(column({ width: fill, height: fill, padding: 80 }, [text('Test', { style: { fontSize: 72, color: '#0F172A', bold: true }, height: hug })]), { frame: { left: 0, top: 0, width: 1920, height: 1080 }, baseUnit: 8 });
const out = await PresentationFile.exportPptx(p); console.log('pptx blob', Object.getOwnPropertyNames(Object.getPrototypeOf(out)), out.type, out.size); await out.save('scratch/test.pptx');
const png = await s.export({ format: 'png' }); console.log('png blob', Object.getOwnPropertyNames(Object.getPrototypeOf(png)), png.type, png.size); await png.save('scratch/test.png');
const layout = await s.export({ format: 'layout' }); console.log('layout', typeof layout, Object.keys(layout).slice(0,20));
await (await import('node:fs/promises')).writeFile('scratch/test.layout.json', JSON.stringify(layout,null,2));
