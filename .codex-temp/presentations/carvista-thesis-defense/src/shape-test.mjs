import { Presentation, shape, panel, text, fill, hug } from '@oai/artifact-tool';
import { paint, stroke } from '@oai/artifact-tool/presentation-jsx';
import fs from 'node:fs/promises';
const p=Presentation.create({slideSize:{width:1920,height:1080}}); const s=p.slides.add();
s.compose(shape({name:'bg', width:fill,height:fill,fill:paint('#F1F5F9')}), {frame:{left:0,top:0,width:1920,height:1080},baseUnit:8});
s.compose(panel({name:'card',fill:paint('#FFFFFF'),line:stroke('2px #E2E8F0'),borderRadius:32,padding:{x:30,y:20}}, text('Card', {style:{fontSize:48,color:'#0F172A',bold:true}})), {frame:{left:200,top:200,width:600,height:300},baseUnit:8});
const png=await s.export({format:'png'}); await fs.writeFile('scratch/shape-test.png',Buffer.from(await png.arrayBuffer()));
