import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import {
  AMBER_HAND,
  BLUE_HAND,
  sampleSplashMotion,
} from "../apps/mobile/src/features/startup/splash-artwork.ts";

const output = new URL("../.cache/hands-connect-preview/", import.meta.url);
const png = await readFile(
  new URL("../apps/web/public/brand/intouch-mark.png", import.meta.url),
);
const image = `data:image/png;base64,${png.toString("base64")}`;
const contents = (svg) =>
  svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");

function scene(time, key) {
  const f = sampleSplashMotion(time);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-80 -70 1400 1190" aria-label="Hands Connect at ${time} milliseconds">
  <image href="${image}" width="1240" height="731" opacity="${1 - f.vectorOpacity}" data-original=""/>
  <g opacity="${f.vectorOpacity}" data-vectors="">
    <g data-hand="amber" transform="translate(${f.amberX} ${f.amberY}) rotate(${-f.rotation} 620 365.5)">${contents(AMBER_HAND)}</g>
    <g data-hand="blue" transform="translate(${f.blueX} ${f.blueY}) rotate(${f.rotation} 620 365.5)">${contents(BLUE_HAND)}</g>
    <circle data-ring="blue" cx="623" cy="344" r="${f.blueRadius}" opacity="${f.blueOpacity}" fill="#168cff" fill-opacity=".05" stroke="#40bfff" stroke-width="3"/>
    <circle data-ring="amber" cx="623" cy="344" r="${f.amberRadius}" opacity="${f.amberOpacity}" fill="none" stroke="#ffbc50" stroke-width="2.5"/>
    <g data-spark="" transform="translate(${f.sparkX} ${f.sparkY})" opacity="${f.sparkOpacity}">
      <g data-spark-cool="" opacity="${1 - f.sparkWarmth}" fill="#45dfff"><circle r="49" opacity=".06"/><circle r="30" opacity=".16"/><circle r="16" opacity=".55"/></g>
      <g data-spark-warm="" opacity="${f.sparkWarmth}" fill="#ffcb68"><circle r="49" opacity=".06"/><circle r="30" opacity=".16"/><circle r="16" opacity=".55"/></g><circle r="6" fill="#f6fcff"/>
    </g>
    <svg x="-56.36" y="809.9" width="1352.72" height="304.36" viewBox="0 0 240 54">
      <defs><clipPath id="reveal-${key}"><circle data-mask="" cx="120" cy="0" r="${f.revealRadius}"/></clipPath></defs>
      <g data-word="" clip-path="url(#reveal-${key})" opacity="${f.wordmarkOpacity}" transform="translate(0 ${f.wordmarkY})"><text x="120" y="39" text-anchor="middle" font-family="Arial,sans-serif" font-weight="900" font-size="31" letter-spacing="-1.2"><tspan fill="#ffad2b">In</tspan><tspan fill="#168cff">Touch</tspan></text></g>
    </svg>
  </g></svg>`;
}

const frames = [0, 180, 620, 820, 1000, 1300];
const samples = Array.from({ length: 161 }, (_, i) =>
  sampleSplashMotion(i * 10),
);
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>InTouch Hands Connect / motion study</title>
<style>body{margin:0;padding:36px;background:#101823;color:#eaf3ff;font:16px Georgia,serif}main{max-width:1000px;margin:auto}h1{font-size:36px;margin:10px 0}p{color:#b0bed0;line-height:1.5}.eyebrow{color:#50b9ff;letter-spacing:.15em;font:12px monospace}.player{border:1px solid #304056;border-radius:24px;padding:36px;background:#07101f;display:grid;place-items:center;min-height:280px}.player svg{width:248px;max-width:100%;overflow:visible}.controls{display:flex;gap:16px;align-items:center;margin:20px 0 36px}button{background:#168cff;border:0;color:white;padding:12px 22px;border-radius:20px;cursor:pointer}input{flex:1}output{font:14px monospace;min-width:70px}.frames{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}figure{margin:0;border:1px solid #263850;border-radius:18px;background:#07101f;padding:18px}figure svg{width:100%}figcaption{font:12px monospace;color:#9aafc9;margin-top:8px}@media(max-width:600px){body{padding:20px}.frames{grid-template-columns:repeat(2,1fr)}}</style>
<main><div class="eyebrow">INTOUCH / MOTION STUDY</div><h1>Hands connect.</h1><p>Shared vector artwork and timeline from the mobile splash. Replay or scrub to inspect the approach, fingertip spark, and lettering reveal. Native frame rate and handoff still require device testing.</p>
<div class="player">${scene(0, "player")}</div><div class="controls"><button id="play">Replay</button><input id="time" aria-label="Animation time" type="range" min="0" max="1600" value="0"><output id="clock">0 ms</output></div><div class="frames">${frames.map((time, i) => `<figure>${scene(time, `frame-${i}`)}<figcaption>${time} ms</figcaption></figure>`).join("")}</div></main>
<script>
const samples=${JSON.stringify(samples)};
const svg=document.querySelector('.player > svg'), slider=document.querySelector('#time'), clock=document.querySelector('#clock');
let animation;
function paint(time){const f=samples[Math.min(160,Math.round(time/10))]; const node=s=>svg.querySelector(s); const attr=(s,k,v)=>node(s).setAttribute(k,String(v));
attr('[data-original]','opacity',1-f.vectorOpacity);attr('[data-vectors]','opacity',f.vectorOpacity);
attr('[data-hand="amber"]','transform','translate('+f.amberX+' '+f.amberY+') rotate('+(-f.rotation)+' 620 365.5)');
attr('[data-hand="blue"]','transform','translate('+f.blueX+' '+f.blueY+') rotate('+f.rotation+' 620 365.5)');
for(const color of ['blue','amber']){attr('[data-ring="'+color+'"]','r',f[color+'Radius']);attr('[data-ring="'+color+'"]','opacity',f[color+'Opacity']);}
attr('[data-spark]','transform','translate('+f.sparkX+' '+f.sparkY+')');attr('[data-spark]','opacity',f.sparkOpacity);
attr('[data-spark-cool]','opacity',1-f.sparkWarmth);attr('[data-spark-warm]','opacity',f.sparkWarmth);
attr('[data-mask]','r',f.revealRadius);attr('[data-word]','opacity',f.wordmarkOpacity);attr('[data-word]','transform','translate(0 '+f.wordmarkY+')');
const fade=Math.max(0,Math.min(1,(time-1300)/300));svg.style.opacity=String(1-(fade<.5?2*fade*fade:1-Math.pow(-2*fade+2,2)/2));slider.value=time;clock.textContent=Math.round(time)+' ms';}
document.querySelector('#play').onclick=()=>{cancelAnimationFrame(animation);const start=performance.now();function tick(now){const time=Math.min(1600,now-start);paint(time);if(time<1600)animation=requestAnimationFrame(tick);}animation=requestAnimationFrame(tick);};
slider.oninput=()=>{cancelAnimationFrame(animation);paint(Number(slider.value));};
</script></html>`;
await mkdir(output, { recursive: true });
await writeFile(new URL("index.html", output), html);
await writeFile(new URL("amber-hand.svg", output), AMBER_HAND);
await writeFile(new URL("blue-hand.svg", output), BLUE_HAND);
for (const time of frames)
  await writeFile(
    new URL(`frame-${time}.svg`, output),
    scene(time, `standalone-${time}`),
  );
console.log(`Preview: ${fileURLToPath(new URL("index.html", output))}`);
