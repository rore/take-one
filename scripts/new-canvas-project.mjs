#!/usr/bin/env node
import { cp, mkdir, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const source = dirname(fileURLToPath(import.meta.url));
export async function scaffold(dir) {
  if (!dir) throw new Error('Usage: new-canvas-project <dir>');
  const target = resolve(dir);
  try {
    const entries = await readdir(target);
    if (entries.length) throw new Error(`${target} already contains files; choose a new or empty directory`);
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  await mkdir(join(target, 'assets'), { recursive: true });
  for (const file of ['serve.mjs', 'frames.mjs', 'export.mjs', 'springs.js']) await cp(join(source, file), join(target, file));
  await writeFile(join(target, 'package.json'), '{"name":"film","private":true,"type":"module","dependencies":{"playwright-core":"^1.63.0"}}\n', { flag: 'wx' });
  await writeFile(join(target, 'film.html'), template, { flag: 'wx' });
  console.log(`project ready at ${target} (run npm install there, then edit film.html; springs in springs.js; review with: node frames.mjs 0 0,1,2)`);
}
const template = String.raw`<!doctype html><html><head><meta charset="utf-8"><title>film</title>
<style>html,body{margin:0;background:#111}canvas{display:block;width:100vw;height:auto;max-height:100vh;object-fit:contain}</style>
<script src="springs.js"></script></head>
<body><canvas id="c"></canvas><script>
const P=new URLSearchParams(location.search).has('portrait');const W=P?1080:1920,H=P?1350:1080;
const c=document.getElementById('c');c.width=W;c.height=H;const g=c.getContext('2d');
window.FILM_DURATION=10;
// motion = springs (Spring.to: one spring per target change, closed form, any t in any order). Linear motion = never.
const CARD_X=[[0,-400],[0.4,W/2-300],[3,W/2-100],[6,W+100]];
window.renderFrame=t=>{g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;g.globalCompositeOperation='source-over';g.filter='none';
  g.fillStyle='#fafaf8';g.fillRect(0,0,W,H);
  const x=Spring.to(t,CARD_X,'camera'),s=0.6+0.4*Spring.unit(t-0.4,'playful');
  g.save();g.translate(x+300,H/2);g.scale(s,s);g.fillStyle='#111';g.font='700 120px system-ui';g.textAlign='center';g.fillText('t = '+t.toFixed(2),0,40);g.restore();};
document.fonts.ready.then(()=>{window.READY=true;if(navigator.webdriver)return;let s=performance.now();const loop=n=>{window.renderFrame(((n-s)/1000)%window.FILM_DURATION);requestAnimationFrame(loop)};requestAnimationFrame(loop);});
</script></body></html>
`;
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  scaffold(process.argv[2]).catch(error => { console.error(error.message); process.exitCode = 1; });
}
