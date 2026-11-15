// Optional Vercel function for same-origin ADS-B reads.
// ADSB.lol public data: ODbL 1.0; anonymous allowance currently 500 requests/day per IP.
// For production or public apps use an authorized key/plan and confirm the provider's ToS.
const LAT=1+21/60+33.16/3600;
const LON=103+59/60+21.57/3600;
export default async function handler(req,res){
  if(req.method!=='GET')return res.status(405).json({error:'GET only'});
  const radius=Number(req.query?.radius??10);
  if(![5,10,25,50,100].includes(radius))return res.status(400).json({error:'Unsupported radius'});
  const nm=Math.ceil(radius/1.852)+3;
  const controller=new AbortController();const t=setTimeout(()=>controller.abort(),11000);
  try{
    const headers={'Accept':'application/json'};
    if(process.env.ADSB_LOL_API_KEY)headers['x-api-key']=process.env.ADSB_LOL_API_KEY;
    const url=`https://api.adsb.lol/v2/point/${LAT.toFixed(5)}/${LON.toFixed(5)}/${nm}`;
    const up=await fetch(url,{headers,signal:controller.signal});
    if(!up.ok){const retry=up.headers.get('retry-after');if(retry)res.setHeader('Retry-After',retry);return res.status(up.status).json({error:up.status===429?'ADS-B provider quota reached':`ADS-B provider returned HTTP ${up.status}`})}
    const data=await up.json();if(!Array.isArray(data?.ac))return res.status(502).json({error:'Invalid ADS-B response'});
    res.setHeader('Cache-Control','public, s-maxage=180, stale-while-revalidate=30');
    res.setHeader('X-ADS-B-Provider','adsb.lol');
    return res.status(200).json(data);
  }catch(e){return res.status(502).json({error:e.name==='AbortError'?'Provider connection timed out':'Provider request failed'});}finally{clearTimeout(t)}
}
