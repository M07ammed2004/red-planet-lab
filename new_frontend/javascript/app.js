
const $=i=>document.getElementById(i),W=60,H=40,C=18,KM=.6,STEEP=13;
const cv=$('cv'),cx=cv.getContext('2d');
let seed=1247,h,sl,dg,S={x:5,y:33},G={x:53,y:3},mode='G',alg='A*',res=null,tm=0,dust;
const ALG=[['A*','A* Star','Smart','Guesses where the goal is and checks the best squares first.'],['Dij','Dijkstra','Careful','Checks every nearby square in order. Slow but always finds the best path.'],['Gr','Greedy','Speedy','Rushes toward the goal. Super quick, but can take a bumpy road.'],['Rip','Ripple','Simple','Spreads out like a ripple in a pond. Ignores hills and danger.']];
const rnd=()=>(seed=seed*16807%2147483647)/2147483647;
function build(){
 const L=[],N=(x,y,s,o)=>{const gx=x/s,gy=y/s,ix=gx|0,iy=gy|0,fx=gx-ix,fy=gy-iy,f=t=>t*t*(3-2*t),v=(a,b)=>L[o+(iy+b)*20+ix+a];
  const a=v(0,0)+(v(1,0)-v(0,0))*f(fx),b=v(0,1)+(v(1,1)-v(0,1))*f(fx);return a+(b-a)*f(fy)};
 for(let i=0;i<900;i++)L.push(rnd());
 const cr=[];for(let k=0;k<6;k++)cr.push([rnd()*W,rnd()*H,3+rnd()*3]);
 dust={x:W*.45,y:H*.22,r:8.5};h=[];sl=[];dg=[];
 for(let y=0;y<H;y++){h[y]=[];for(let x=0;x<W;x++){let v=.6*N(x,y,9,0)+.3*N(x,y,4,300);
  for(const[a,b,r]of cr){const d=Math.hypot(x-a,y-b)/r;if(d<1)v-=.28*(1-d*d);else if(d<1.35)v+=.14*Math.exp(-((d-1.1)**2)*40)}h[y][x]=v}}
 for(let y=0;y<H;y++){sl[y]=[];dg[y]=[];for(let x=0;x<W;x++){let m=0;
  for(let j=-1;j<2;j++)for(let i=-1;i<2;i++){const a=h[y+j]?.[x+i];if(a!==undefined)m=Math.max(m,Math.abs(a-h[y][x]))}
  const s=Math.atan(m*4000/700)*180/Math.PI;sl[y][x]=s;let d=s/22;
  for(const[a,b,r]of cr)if(Math.hypot(x-a,y-b)<r*.85)d+=.55;
  if(Math.hypot(x-dust.x,y-dust.y)<dust.r)d+=.12;dg[y][x]=Math.min(1,d)}}
 for(const p of[S,G])for(let j=-1;j<2;j++)for(let i=-1;i<2;i++){const x=p.x+i,y=p.y+j;if(sl[y]?.[x]!==undefined){sl[y][x]=Math.min(sl[y][x],5);dg[y][x]=Math.min(dg[y][x],.1)}}
 const t=document.createElement('canvas');t.width=cv.width;t.height=cv.height;const c=t.getContext('2d');
 const R=[[0,[255,224,174]],[.35,[247,183,132]],[.65,[225,133,105]],[1,[157,83,87]]];
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){const u=Math.min(1,Math.max(0,(h[y][x]-.05)/.8));let i=0;while(i<2&&u>R[i+1][0])i++;
  const f=(u-R[i][0])/(R[i+1][0]-R[i][0]),k=R[i][1].map((q,n)=>q+(R[i+1][1][n]-q)*f);c.fillStyle=`rgb(${k})`;c.fillRect(x*C,y*C,C+1,C+1)}
 base=document.createElement('canvas');base.width=cv.width;base.height=cv.height;const b=base.getContext('2d');
 b.filter='blur(7px)';b.drawImage(t,-10,-10,cv.width+20,cv.height+20);b.filter='none';
 const pc=document.createElement('canvas');pc.width=pc.height=6;const p=pc.getContext('2d');p.strokeStyle='rgba(70,60,60,.75)';p.lineWidth=1.2;p.beginPath();p.moveTo(0,6);p.lineTo(6,0);p.stroke();const pat=b.createPattern(pc,'repeat');
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){if(dg[y][x]>.6){b.fillStyle='rgba(176,60,30,.38)';b.fillRect(x*C,y*C,C,C)}
  if(sl[y][x]>STEEP){b.fillStyle='rgba(80,60,60,.16)';b.fillRect(x*C,y*C,C,C);b.fillStyle=pat;b.fillRect(x*C,y*C,C,C)}}
 b.fillStyle='rgba(255,200,60,.32)';for(let y=0;y<H;y++)for(let x=0;x<W;x++){b.beginPath();b.arc(x*C+9,y*C+9,3.2,0,7);b.fill()}
 b.strokeStyle='rgba(255,255,255,.35)';b.lineWidth=1;for(let i=0;i<=W;i+=6){b.beginPath();b.moveTo(i*C,0);b.lineTo(i*C,720);b.stroke()}for(let i=0;i<=H;i+=6){b.beginPath();b.moveTo(0,i*C);b.lineTo(1080,i*C);b.stroke()}
 // Tiny hand-drawn Mars landmarks: crater rims, a friendly alien, and pebble clusters.
 const crater=(x,y,r)=>{b.save();b.lineWidth=3;b.strokeStyle='rgba(126,67,67,.32)';b.fillStyle='rgba(255,228,185,.13)';b.beginPath();b.ellipse(x*C,y*C,r*C,r*C*.62,-.25,0,Math.PI*2);b.fill();b.stroke();b.lineWidth=2;b.strokeStyle='rgba(255,247,223,.48)';b.beginPath();b.ellipse(x*C-2,y*C-3,r*C*.78,r*C*.42,-.25,Math.PI,Math.PI*2);b.stroke();b.restore()};
 for(const [x,y,r] of [[12,8,1.2],[47,30,1.05],[28,36,.8]]) crater(x,y,r);
 // Little round rover-side alien waving from a safe map margin.
 const ax=8*C,ay=18*C;b.save();b.lineCap='round';b.lineWidth=3;b.strokeStyle='#668a67';b.fillStyle='#8eb984';
 b.beginPath();b.moveTo(ax-5,ay+5);b.lineTo(ax-8,ay+10);b.moveTo(ax+5,ay+5);b.lineTo(ax+9,ay+8);b.stroke();
 b.beginPath();b.ellipse(ax,ay,8,9,0,0,Math.PI*2);b.fill();b.stroke();
 b.fillStyle='#fff8e8';b.beginPath();b.arc(ax-3,ay-1,2.2,0,7);b.arc(ax+3,ay-1,2.2,0,7);b.fill();
 b.fillStyle='#493b48';b.beginPath();b.arc(ax-3,ay-1,1,0,7);b.arc(ax+3,ay-1,1,0,7);b.fill();
 b.strokeStyle='#557855';b.lineWidth=1.4;b.beginPath();b.arc(ax,ay+1,2.7,.15,Math.PI-.15);b.stroke();
 b.strokeStyle='#668a67';b.lineWidth=2;b.beginPath();b.moveTo(ax-2,ay-8);b.lineTo(ax-4,ay-12);b.stroke();b.fillStyle='#f2bd63';b.beginPath();b.arc(ax-4,ay-13,2,0,7);b.fill();b.restore();
 // Pebbles in small storybook clusters, away from the route labels.
 for(const [x,y] of [[19,11],[42,34],[32,6],[16,29],[52,20]]){b.fillStyle='rgba(132,74,70,.34)';b.beginPath();b.ellipse(x*C,y*C,5,3,-.25,0,7);b.fill();b.fillStyle='rgba(255,229,187,.48)';b.beginPath();b.ellipse(x*C-1,y*C-1,2,1.2,-.25,0,7);b.fill()}
 b.setLineDash([9,7]);b.strokeStyle='rgba(255,255,255,.85)';b.lineWidth=2.5;b.beginPath();b.arc(dust.x*C,dust.y*C,dust.r*C,0,7);b.stroke();b.setLineDash([]);
 pill(b,'Dust storm!',dust.x*C,(dust.y-dust.r)*C,'#fff','#ee5a1f');
}

function rover(px,py){
 cx.save();cx.translate(px,py);cx.scale(1.22,1.22);cx.shadowColor='rgba(45,34,28,.38)';cx.shadowBlur=10;cx.shadowOffsetY=4;
 cx.fillStyle='#f3c467';cx.strokeStyle='#6b4651';cx.lineWidth=3.2;cx.beginPath();cx.roundRect(-13,-12,26,16,5);cx.fill();cx.stroke();
 cx.shadowColor='transparent';cx.fillStyle='#64b8b0';cx.strokeStyle='#fffaf0';cx.lineWidth=2.8;cx.beginPath();cx.roundRect(-7,-21,14,11,4);cx.fill();cx.stroke();
 cx.fillStyle='#44364b';cx.beginPath();cx.arc(-2,-16,1.1,0,7);cx.arc(3,-16,1.1,0,7);cx.fill();
 cx.strokeStyle='#a9503d';cx.lineWidth=2;cx.beginPath();cx.arc(.5,-14.5,2.4,.15,Math.PI-.15);cx.stroke();
 cx.strokeStyle='#6b4651';cx.lineWidth=2.5;cx.beginPath();cx.moveTo(8,-9);cx.lineTo(12,-16);cx.stroke();cx.fillStyle='#e4a936';cx.beginPath();cx.arc(12,-17,2.4,0,7);cx.fill();
 for(const x of [-8,8]){cx.fillStyle='#453d50';cx.beginPath();cx.arc(x,7,5.2,0,7);cx.fill();cx.fillStyle='#e78766';cx.beginPath();cx.arc(x,7,2,0,7);cx.fill()}
 cx.restore();
}

let base;
function pill(c,t,x,y,bg,fg){c.font='600 14px Fredoka';const w=c.measureText(t).width+20;c.fillStyle=bg;c.beginPath();c.roundRect(x-w/2,y-12,w,24,12);c.fill();c.fillStyle=fg;c.textAlign='center';c.textBaseline='middle';c.fillText(t,x,y+1)}
const el=(x,y)=>-4500+h[y][x]*4000;
function search(a,w){
 const key=(x,y)=>y*W+x,g={},par={},cl=new Set(),order=[],open=[{x:S.x,y:S.y,f:0}];g[key(S.x,S.y)]=0;
 const hf=(x,y)=>{const dx=Math.abs(x-G.x),dy=Math.abs(y-G.y);return Math.max(dx,dy)+.414*Math.min(dx,dy)};
 while(open.length){let bi=0;for(let i=1;i<open.length;i++)if(open[i].f<open[bi].f)bi=i;const n=open.splice(bi,1)[0],k=key(n.x,n.y);
  if(cl.has(k))continue;cl.add(k);order.push(k);if(n.x==G.x&&n.y==G.y)break;
  for(let j=-1;j<2;j++)for(let i=-1;i<2;i++){if(!i&&!j)continue;const x=n.x+i,y=n.y+j;if(x<0||y<0||x>=W||y>=H)continue;
   if(a!='Rip'&&sl[y][x]>STEEP)continue;const d=i&&j?1.414:1,c=a=='Rip'?d:d*(1+w*(sl[y][x]/8+dg[y][x]*2.5)),nk=key(x,y),ng=g[key(n.x,n.y)]+c;
   if(g[nk]===undefined||ng<g[nk]){g[nk]=ng;par[nk]=k;const hh=hf(x,y);open.push({x,y,f:a=='A*'?ng+hh:a=='Gr'?hh:ng})}}}
 const gk=key(G.x,G.y);if(!cl.has(gk))return{fail:1,order};
 const path=[];for(let k=gk;k!==undefined;k=par[k])path.push({x:k%W,y:k/W|0});path.reverse();
 let dist=0,climb=0,steep=0,ds=0;for(let i=1;i<path.length;i++){const p=path[i],q=path[i-1];dist+=Math.hypot(p.x-q.x,p.y-q.y)*KM;climb+=Math.max(0,el(p.x,p.y)-el(q.x,q.y))}
 path.forEach(p=>{steep=Math.max(steep,sl[p.y][p.x]);ds+=dg[p.y][p.x]});ds/=path.length;
 return{path,order,n:order.length,dist,climb,steep,danger:ds,safety:Math.max(0,100-Math.round(ds*30)),energy:dist*2.1}}
function draw(n,showPath){cx.drawImage(base,0,0);
 cx.fillStyle='rgba(239,189,97,.92)';for(let i=0;i<Math.min(n,res?.order.length||0);i++){const k=res.order[i];cx.beginPath();cx.arc((k%W)*C+9,(k/W|0)*C+9,3.6,0,7);cx.fill()}
 if(showPath&&res?.path){cx.lineJoin='round';cx.beginPath();res.path.forEach((p,i)=>cx[i?'lineTo':'moveTo'](p.x*C+9,p.y*C+9));cx.strokeStyle='rgba(255,255,255,.85)';cx.lineWidth=9;cx.stroke();cx.strokeStyle='#438c91';cx.lineWidth=5;cx.stroke()}
 mk(S,'Start','#0a80d4');mk(G,'Goal','#ee5a1f');if(showPath&&res?.path?.length){const p=res.path[Math.floor(res.path.length*.52)];rover(p.x*C+9,p.y*C+9)}}
function mk(p,t,c){const x=p.x*C+9,y=p.y*C+9;cx.fillStyle='#fff';cx.beginPath();cx.arc(x,y,9,0,7);cx.fill();cx.strokeStyle=c;cx.lineWidth=4;cx.beginPath();cx.arc(x,y,6,0,7);cx.stroke();cx.fillStyle=c;cx.beginPath();cx.arc(x,y,2.5,0,7);cx.fill();pill(cx,t,x,y-24,c,'#fff')}
function diary(t,k){const d=document.createElement('div');d.className='dy'+(k?' k':'');d.innerHTML='<i>'+(k?'✓':'i')+'</i><span>'+t+'</span>';$('diary').prepend(d);while($('diary').children.length>5)$('diary').lastChild.remove()}
function sync(){$('sx').value=S.x;$('sy').value=S.y;$('gx').value=G.x;$('gy').value=G.y}
function reset(){clearInterval(tm);res=null;['vd','vs','vh','ve','cl','sp','ts'].forEach(i=>$(i).textContent='–');['bd','bs','bh','be'].forEach(i=>$(i).style.width=0);$('pf').style.visibility='hidden';$('el').innerHTML='';draw(0,0)}
function run(){clearInterval(tm);const w=$('w').value/100*4,r=search(alg,w);const nm=ALG.find(a=>a[0]==alg)[1];
 diary(nm+' is thinking about how to get from ('+S.x+','+S.y+') to ('+G.x+','+G.y+')…');
 if(r.fail){res=r;draw(0,0);diary('Oh no! No safe road found.');return}
 res=r;const rows=ALG.map(a=>{const q=a[0]==alg?r:search(a[0],w);return{a,q}});
 $('race').innerHTML=rows.map(({a,q})=>{const f=rows.every(z=>z.q.fail||q.n<=z.q.n);return`<tr class="${a[0]==alg?'on':''}"><td>${a[1]}${f?'<span class="ft">Fastest</span>':''}</td><td>${q.n}</td><td>${q.fail?'–':q.dist.toFixed(1)}</td><td style="color:var(--bl);font-weight:600">${q.fail?'–':q.safety+'%'}</td></tr>`}).join('');
 const fin=()=>{draw(r.n,1);$('pf').style.visibility='visible';
  $('vd').textContent=r.dist.toFixed(1);$('bd').style.width=Math.min(100,r.dist/45*100)+'%';$('cd').textContent='About '+(r.dist/10).toFixed(1)+' Mars days of driving';
  $('vs').textContent=r.safety;$('bs').style.width=r.safety+'%';
  const ds=Math.round(r.danger*100);$('vh').textContent=ds<25?'Low':ds<50?'Medium':'High';$('bh').style.width=ds+'%';$('ch').textContent='Danger score '+ds+' out of 100';
  $('ve').textContent=Math.round(r.energy);$('be').style.width=Math.min(100,r.energy/160*100)+'%';$('ce').textContent='Uses '+Math.round(r.energy/160*100)+'% of the battery';$('bat').textContent=Math.round(100-r.energy/160*100*.25)+'%';
  const es=r.path.map(p=>el(p.x,p.y)),mn=Math.min(...es),mx=Math.max(...es);
  $('el').innerHTML=`<polygon fill="#ee6a2d" points="0,70 ${es.map((e,i)=>(i/(es.length-1)*220).toFixed(1)+','+(60-(e-mn)/(mx-mn||1)*45).toFixed(1)).join(' ')} 220,70"/><text x="6" y="12" font-size="8" fill="#456">${Math.round(mn)} m</text>`;
  $('cl').textContent=Math.round(r.climb).toLocaleString()+' m';$('sp').textContent=Math.round(r.steep)+'°';$('ts').textContent=Math.round(r.dist*2+r.climb/60+r.danger*60);
  diary('Found it! '+r.dist.toFixed(1)+' km after checking '+r.n+' squares. Safety: '+r.safety+'%.',1)};
 if($('think').checked){let i=0;tm=setInterval(()=>{i+=Math.max(8,r.n/60|0);draw(i,0);if(i>=r.n){clearInterval(tm);fin()}},16)}else fin()}
cv.onclick=e=>{const b=cv.getBoundingClientRect(),x=Math.min(W-1,(e.clientX-b.left)/b.width*W|0),y=Math.min(H-1,(e.clientY-b.top)/b.height*H|0);(mode=='S'?S:G).x=x;(mode=='S'?S:G).y=y;sync();if(mode=='G')diary('Goal is now at ('+x+','+y+').');reset()};
cv.onmousemove=e=>{const b=cv.getBoundingClientRect(),x=Math.min(W-1,(e.clientX-b.left)/b.width*W|0),y=Math.min(H-1,(e.clientY-b.top)/b.height*H|0);$('spot').innerHTML=`<b style="color:var(--tx)">Spot (${x},${y})</b> · ${Math.round(el(x,y)).toLocaleString()} m high · ${Math.round(sl[y][x])}° steep · danger ${Math.round(dg[y][x]*100)}%`};
function setMode(m){mode=m;$('mS').className='tb s'+(m=='S'?' on':'');$('mG').className='tb'+(m=='G'?' on':'')}
$('mS').onclick=()=>setMode('S');$('mG').onclick=()=>setMode('G');
['sx','sy','gx','gy'].forEach(i=>$(i).onchange=()=>{S={x:+$('sx').value,y:+$('sy').value};G={x:+$('gx').value,y:+$('gy').value};reset()});
$('swap').onclick=()=>{[S,G]=[G,S];sync();reset()};
$('w').oninput=()=>$('wv').textContent=$('w').value+'%';
$('go').onclick=run;$('clr').onclick=reset;
$('nm').onclick=()=>{seed=seed*7%99991+1000;$('mn').textContent=seed%9000+1000;build();reset();diary('Map number '+$('mn').textContent+' is ready to explore.')};
$('algs').innerHTML=ALG.map(a=>`<div class="alg${a[0]==alg?' on':''}" data-a="${a[0]}"><b>${a[1]}</b><em>${a[2]}</em><p>${a[3]}</p></div>`).join('');
document.querySelectorAll('.alg').forEach(d=>d.onclick=()=>{alg=d.dataset.a;document.querySelectorAll('.alg').forEach(z=>z.classList.toggle('on',z==d))});
function clock(){const n=new Date();$('et').textContent=n.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});const m=(n/1000*(1/1.0275))%86400;$('mt').textContent=String(m/3600|0).padStart(2,'0')+':'+String(m%3600/60|0).padStart(2,'0')}
setInterval(clock,5000);clock();
build();sync();draw(0,0);diary('Map number 1247 is ready to explore.');


// Interactive, front-end-only adaptation of the supplied MarsOverview React component.
const SECTORS=[
 {id:'JZ-01',name:'Jezero Crater',center:[18.38,77.58],area:4900,bounds:[17.2,19.6,76.1,79.0],crs:'IAU_MARS:49900',state:'READY TO EXPLORE',flavor:'River delta trails and ancient lakebed'},
 {id:'GA-02',name:'Gale Crater',center:[-5.37,137.81],area:15400,bounds:[-6.8,-3.9,136.2,139.5],crs:'IAU_MARS:49900',state:'AWAITING SURVEY',flavor:'Layered foothills beneath Mount Sharp'},
 {id:'EL-03',name:'Elysium Planitia',center:[4.5,135.9],area:12000,bounds:[3.1,5.9,134.2,137.6],crs:'IAU_MARS:49900',state:'AWAITING SURVEY',flavor:'Wide volcanic plains and gentle slopes'},
 {id:'OL-04',name:'Olympus Mons',center:[18.65,226.2],area:22000,bounds:[17.0,20.2,224.1,228.3],crs:'IAU_MARS:49900',state:'AWAITING SURVEY',flavor:'A giant shield volcano above the clouds'}
];
let selectedSector=SECTORS[0];
function sectorCard(sec){return `<div class="sector-card${sec===selectedSector?' selected':''}" data-sector="${sec.id}" tabindex="0" role="button" aria-label="Select ${sec.name}"><div class="card-top"><span class="sector-id">${sec.id} · MARS REGION</span><span class="state-badge ${sec===selectedSector?'badge-active':'badge-unscouted'}">${sec.state}</span></div><h4 class="sector-name">${sec.name}</h4><div class="card-details"><span>${sec.center[0].toFixed(2)}° · ${sec.center[1].toFixed(2)}°</span><span>${sec.area.toLocaleString()} km²</span></div></div>`}
function renderSectorHub(){
 const list=$('sectorList'),detail=$('sectorDetail');if(!list||!detail)return;
 list.innerHTML=SECTORS.map(sectorCard).join('');
 list.querySelectorAll('[data-sector]').forEach(card=>{const choose=()=>{selectedSector=SECTORS.find(q=>q.id===card.dataset.sector);renderSectorHub()};card.onclick=choose;card.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose()}}});
 const s=selectedSector;detail.innerHTML=`<div class="detail-header"><div><span class="detail-tag">TARGET SPECIFICATION</span><h2>${s.name}</h2><span class="detail-crs">${s.flavor} · CRS: ${s.crs} · Mars radius 3,396 km</span></div><div class="state-large-badge"><span class="label">SECTOR STATUS</span><span class="badge-pill">${s.state}</span></div></div>
 <div class="grid-meta-row"><div class="meta-box"><span class="label">LATITUDE RANGE</span><span class="val">[${s.bounds[0].toFixed(2)}°, ${s.bounds[1].toFixed(2)}°]</span></div><div class="meta-box"><span class="label">LONGITUDE RANGE</span><span class="val">[${s.bounds[2].toFixed(2)}°, ${s.bounds[3].toFixed(2)}°]</span></div><div class="meta-box"><span class="label">AVAILABLE LAYERS</span><span class="val">Awaiting data scan</span></div><div class="meta-box"><span class="label">EST. DOWNLOAD</span><span class="val">Pending scan</span></div></div>
 <div class="pipeline-actions-card"><h4>🛰️ ORBITAL DATA PIPELINE</h4><p class="pipeline-desc">A three-step route from archive discovery to Curio-ready terrain.</p><div class="action-buttons-group"><button class="sector-action" data-pipeline="scan">① Scan orbital archives</button><button class="sector-action" data-pipeline="download">② Retrieve elevation DEM</button><button class="sector-action" data-pipeline="process">③ Prepare terrain layers</button></div></div>
 <div class="products-table-card"><h4>📡 ARCHIVE PRODUCTS</h4><p>No archive products loaded for this sector yet. Connect the application API to discover MOLA / orbital datasets.</p></div>
 <div class="ready-banner"><div><h3>🧭 Explore this region with Curio</h3><p>Jump back to the rover planner. Real sector DEM loading becomes available once the backend is connected.</p></div><button class="sector-action explore" id="sectorExplore">GO TO ROVER MAP ↓</button></div>`;
 detail.querySelectorAll('[data-pipeline]').forEach(btn=>btn.onclick=()=>showApiMessage(btn.dataset.pipeline));
 $('sectorExplore').onclick=()=>{document.querySelector('#cv')?.scrollIntoView({behavior:'smooth',block:'center'});$('spot').textContent=`${s.name} selected · interactive planner uses its built-in Jezero map until DEM services are connected.`};
}
function showApiMessage(action){const note=$('apiNote');const names={scan:'Archive scanning',download:'DEM retrieval',process:'Terrain processing'};note.innerHTML=`<span class="note-mark">i</span><span><b>${names[action]} needs a connected backend.</b> The supplied React code calls <code>${action==='scan'?'scanSector':action==='download'?'downloadSectorDem':'processSectorDem'}()</code>. This static front end has no API service configured, so no external request or download was made.</span>`;note.scrollIntoView({behavior:'smooth',block:'nearest'})}
renderSectorHub();
