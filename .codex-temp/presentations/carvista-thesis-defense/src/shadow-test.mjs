import { Presentation, panel, text } from '@oai/artifact-tool';
import { paint, stroke } from '@oai/artifact-tool/presentation-jsx';
import fs from 'node:fs/promises';
const p=Presentation.create({slideSize:{width:1920,height:1080}}); const s=p.slides.add();
s.compose(panel({fill:paint('#fff'),line:stroke('1px #E2E8F0'),borderRadius:32,shadow:'0px 18px 40px rgba(15,45,98,0.10)',padding:30}, text('shadow', {style:{fontSize:40}})), {frame:{left:200,top:200,width:500,height:240},baseUnit:8});
const png=await s.export({format:'png'}); await fs.writeFile('scratch/shadow-test.png', Buffer.from(await png.arrayBuffer()));
