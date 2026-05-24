import { PresentationFile } from '@oai/artifact-tool';
import fs from 'node:fs/promises';
const data=await fs.readFile('scratch/import-test.pptx');
const imported = await PresentationFile.importPptx(data);
console.log('imported proto', Object.getOwnPropertyNames(Object.getPrototypeOf(imported))); console.log('slides', imported.slides.count);
const s = imported.slides.getItem(0);
const png=await s.export({format:'png'}); await fs.writeFile('scratch/imported.png', Buffer.from(await png.arrayBuffer()));
console.log('rendered imported');
