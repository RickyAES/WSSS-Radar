// WSSS radar adapter: reuses the Jetline Captain v86 radar DATA engine unchanged.
// The interface is independent; no model/synthetic traffic is generated.
'use strict';
const {fetchAirport,fetchWSSSGround}=require('../lib/adsb');
function asRaw(p,sourceProvider){
 const x={hex:p.hex,flight:p.callsign||'',lat:p.lat,lon:p.lon,
  seen_pos:p.seenPos,on_ground:!!p.onGround,sourceProvider:sourceProvider||'Jetline ADS-B'};
 if(p.registration)x.r=p.registration;
 if(p.type)x.t=p.type;
 if(p.onGround)x.alt_baro='ground';else if(Number.isFinite(p.altFt))x.alt_baro=p.altFt;
 if(Number.isFinite(p.speedKt))x.gs=p.speedKt;
 if(Number.isFinite(p.heading))x.track=p.heading;
 if(Number.isFinite(p.verticalRate))x.baro_rate=p.verticalRate;
 return x;
}
module.exports=async function handler(req,res){
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'METHOD_NOT_ALLOWED'});}
 const now=Date.now();let main=null,ground=null,mainErr=null,groundErr=null;
 const r=await Promise.allSettled([fetchAirport('WSSS'),fetchWSSSGround()]);
 if(r[0].status==='fulfilled')main=r[0].value;else mainErr=String(r[0].reason?.message||r[0].reason||'unknown').slice(0,180);
 if(r[1].status==='fulfilled')ground=r[1].value;else groundErr=String(r[1].reason?.message||r[1].reason||'unknown').slice(0,180);
 if(!main){res.setHeader('Cache-Control','no-store');return res.status(503).json({live:false,error:'JETLINE_LIVE_FEED_UNAVAILABLE',message:mainErr||groundErr||'No fresh ADS-B snapshot'});}
 const sampleTime=Date.parse(main.asOf);
 if(!Number.isFinite(sampleTime)||sampleTime>now+120000||now-sampleTime>240000){res.setHeader('Cache-Control','no-store');return res.status(503).json({live:false,error:'STALE_ADSB_DATA',message:'Jetline upstream snapshot was too old'});}
 const merged=new Map();
 for(const p of main.aircraft||[])merged.set(p.hex,asRaw(p,main.provider));
 // WSSS ground source is strictly receiver-confirmed and contains zero simulated positions.
 // Ground may come from an independent receiver network, so preserve verified ground state.
 const available=(ground?.providers||[]).filter(p=>p.status==='connected');
 const attribution=available.length?available.map(p=>p.name).join(' + '):'Jetline ground receiver';
 for(const p of ground?.aircraft||[]){
  if(!p.onGround||p.seenPos>45)continue;
  const prior=merged.get(p.hex);
  if(!prior||prior.seen_pos>=p.seenPos||!prior.on_ground)merged.set(p.hex,asRaw(p,attribution+' (ground)'));
 }
 const ac=[...merged.values()];
 const output={live:true,mode:'RECEIVER_DATA_ONLY',engine:'Jetline Captain v86',airport:'WSSS',
  provider:main.provider,asOf:main.asOf,sourceUrl:main.sourceUrl||'https://www.adsb.lol/',
  ac,total:ac.length,groundCount:ac.filter(x=>x.on_ground).length,
  ground:{asOf:ground?.asOf||null,providers:ground?.providers||[],diagnostics:ground?.diagnostics||null,
   coverage:ground?.coverage||'Receiver-dependent; ground positions may be absent.',
   error:groundErr},
  source:{name:'Jetline v86',feed:main.provider,groundNetwork:available.map(p=>p.name),
   noSimulation:true}};
 res.setHeader('Cache-Control','public, s-maxage=35, stale-while-revalidate=10');
 return res.status(200).json(output);
};
