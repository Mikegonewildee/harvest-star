const fs=require('fs'); const E=require('../engine.js');
const grid=require('../rain_grid.json'); const power=require('/home/claude/dl/val/mull_power.json');
const lines=fs.readFileSync('/home/claude/dl/val/mull.csv','utf8').split(/\r?\n/);
const hi=lines.findIndex(l=>l.startsWith('date,')); const H=lines[hi].split(',');
const MON={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
const st=[]; for(const l of lines.slice(hi+1)){const p=l.split(','); if(p.length<H.length)continue; const [d,m,y]=p[0].split('-'); const o={y:+y,m:MON[m.toLowerCase()],dd:+d}; H.forEach((h,i)=>o[h]=p[i]); st.push(o);}
function stationSeasons(col){const se={}; for(const c in E.CROPS)se[c]={};
  for(let i=1;i<st.length;i++){const r=st[i],prev=st[i-1]; const rain=parseFloat(r.rain), s=parseFloat(prev[col]); if(isNaN(rain)||isNaN(s))continue; const fit=rain<1&&s>=0;
    for(const c in E.CROPS){const cr=E.CROPS[c];const v=r.m*100+r.dd,a=cr.win[0][0]*100+cr.win[0][1],b=cr.win[1][0]*100+cr.win[1][1]; if(v<a||v>b)continue; const hy=cr.autumn?r.y+1:r.y; se[c][hy]=(se[c][hy]||0)+(fit?1:0);}}
  return se;}
const wx=E.prepareWeather(power,{rainNormals:E.lookupGrid(grid,53.537,-7.362)});
console.log('Mullingar map',wx.mapAnnual,'power',Math.round(wx.powerAnnual));
const corr=(a,b)=>{const n=a.length,ma=a.reduce((x,y)=>x+y)/n,mb=b.reduce((x,y)=>x+y)/n;let s=0,sa=0,sb=0;for(let i=0;i<n;i++){s+=(a[i]-ma)*(b[i]-mb);sa+=(a[i]-ma)**2;sb+=(b[i]-mb)**2}return s/Math.sqrt(sa*sb)};
const out={};
for(const [dr,col] of [['moderate','smd_md'],['poor','smd_pd'],['well','smd_wd']]){
  const an=E.analyse(wx,{drainage:dr}); const ss=stationSeasons(col); out[dr]={};
  for(const c of ['wosr','wb','ww','sbe','sb','so','wo']){const ys=Object.keys(an.seasons[c]).map(Number).filter(y=>y>=1986&&y<=2026&&ss[c][y]!=null);
    const a=ys.map(y=>an.seasons[c][y]),b=ys.map(y=>ss[c][y]);
    out[dr][c]={n:ys.length,r:+corr(a,b).toFixed(2),engineMiss:a.filter(v=>v<5).length,stationMiss:b.filter(v=>v<5).length};}
  console.log(dr,JSON.stringify(out[dr]));
}
fs.writeFileSync('/home/claude/dl/val/result.json',JSON.stringify(out));
