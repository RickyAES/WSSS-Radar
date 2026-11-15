// Aviationstack flight-status metadata for Singapore Changi (SIN / WSSS).
// Secret must be set in Vercel as AVIATIONSTACK_API_KEY. Never send it to the browser.
// NOT a surface surveillance/ADS-B feed. ADS-B remains the position source.
const SNAPSHOT_TTL_MS = 24 * 60 * 60 * 1000; // free plan: 100 requests/month; 2 requests/snapshot
let snapshot = null;
let snapshotTime = 0;
let inflight = null;

function clean(value, limit=90) {
  return typeof value === 'string' ? value.trim().slice(0, limit) : null;
}
function flightInfo(item, direction) {
  const flight = item?.flight || {}, dep = item?.departure || {}, arr = item?.arrival || {};
  const airline = item?.airline || {};
  const number = clean(flight.number, 12);
  const iata = clean(flight.iata, 16) || (clean(airline.iata, 3) && number ? airline.iata + number : null);
  const icao = clean(flight.icao, 16) || (clean(airline.icao, 4) && number ? airline.icao + number : null);
  if (!iata && !icao) return null;
  return {
    iata, icao, direction,
    status: clean(item.flight_status, 32),
    departure: { airport: clean(dep.airport), iata: clean(dep.iata, 5), terminal: clean(dep.terminal, 12), gate: clean(dep.gate, 12), scheduled: clean(dep.scheduled, 40), estimated: clean(dep.estimated, 40), actual: clean(dep.actual, 40) },
    arrival: { airport: clean(arr.airport), iata: clean(arr.iata, 5), terminal: clean(arr.terminal, 12), gate: clean(arr.gate, 12), scheduled: clean(arr.scheduled, 40), estimated: clean(arr.estimated, 40), actual: clean(arr.actual, 40) }
  };
}
async function queryFlightDirection(key, direction, date) {
  // Date is Singapore-local, not flight tracking time. Use only as schedule metadata.
  const params = new URLSearchParams({access_key:key,flight_date:date,limit:'100', [direction === 'departure' ? 'dep_iata' : 'arr_iata']:'SIN'});
  const ctl = new AbortController(); const timer=setTimeout(()=>ctl.abort(),12000);
  try {
    const response=await fetch('https://api.aviationstack.com/v1/flights?'+params.toString(),{signal:ctl.signal,headers:{Accept:'application/json'}});
    const payload=await response.json().catch(()=>null);
    if(!response.ok||payload?.error){
      const code=payload?.error?.code;
      const errorCode=['invalid_access_key','missing_access_key','function_access_restricted','usage_limit_reached','rate_limit_reached','inactive_user'].includes(code)?code:'upstream_error';
      throw new Error(errorCode);
    }
    if(!Array.isArray(payload?.data))throw new Error('invalid_response');
    return payload.data.map(f=>flightInfo(f,direction)).filter(Boolean);
  } finally {clearTimeout(timer)}
}
async function retrieve(key){
  const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Singapore',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const results=await Promise.allSettled([queryFlightDirection(key,'departure',date),queryFlightDirection(key,'arrival',date)]);
  const good=results.filter(r=>r.status==='fulfilled');
  if(!good.length)throw new Error(results[0]?.reason?.message||'upstream_error');
  const records=good.flatMap(r=>r.value);
  const byId=new Map();
  for (const f of records) {
    const id=(f.icao||f.iata).toUpperCase();
    if(!byId.has(id))byId.set(id,f);
  }
  return { configured:true, provider:'aviationstack', kind:'flight_status_metadata', flightDate:date, fetchedAt:new Date().toISOString(), partial:good.length!==2, count:byId.size, flights:[...byId.values()].slice(0,200) };
}
module.exports=async function handler(req,res){
  if(req.method!=='GET')return res.status(405).json({error:'GET only'});
  res.setHeader('Content-Type','application/json');
  res.setHeader('Cache-Control','public, s-maxage=86400, stale-while-revalidate=300');
  const key=process.env.AVIATIONSTACK_API_KEY;
  if(!key)return res.status(200).json({configured:false,provider:'aviationstack',kind:'flight_status_metadata',count:0,flights:[],error:'AVIATIONSTACK_API_KEY is not configured in this Vercel project'});
  if(snapshot && Date.now()-snapshotTime<SNAPSHOT_TTL_MS) return res.status(200).json(snapshot);
  try{
    if(!inflight)inflight=retrieve(key).finally(()=>{inflight=null});
    const result=await inflight;
    snapshot=result;snapshotTime=Date.now();
    return res.status(200).json(result);
  }catch(error){
    // Never include URL, stack, or access key in JSON errors.
    res.setHeader('Cache-Control','no-store');
    return res.status(502).json({configured:true,provider:'aviationstack',kind:'flight_status_metadata',error: ['invalid_access_key','missing_access_key','function_access_restricted','usage_limit_reached','rate_limit_reached','inactive_user'].includes(error.message)?error.message:'aviationstack_request_failed',flights:[]});
  }
}
