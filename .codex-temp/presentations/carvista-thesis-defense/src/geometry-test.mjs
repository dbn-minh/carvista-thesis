import { Presentation, shape } from '@oai/artifact-tool';
import { paint, stroke } from '@oai/artifact-tool/presentation-jsx';
import fs from 'node:fs/promises';
const p=Presentation.create({slideSize:{width:1920,height:1080}}); const s=p.slides.add();
for (const [i,g] of ['rect','ellipse','triangle','diamond','line','rightArrow','roundRect'].entries()) {
 try { s.compose(shape({geometry:g,width:120,height:80,fill:paint('#DBEAFE'),line:stroke('2px #2563EB')}), {frame:{left:100+i*160,top:100,width:120,height:80},baseUnit:8}); console.log('ok', g); } catch(e) { console.log('compose err', g, e.message); }
}
try { const png=await s.export({format:'png'}); await fs.writeFile('scratch/geometry-test.png', Buffer.from(await png.arrayBuffer())); console.log('render ok'); } catch(e) { console.error('render err', e.message); }
