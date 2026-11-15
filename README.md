# WSSS Changi Live Radar

This is an upgrade of the uploaded `changi_atc_radar.html`. It provides two switchable views: a street/geographic airport map and a dark-green north-up radar scope. It consumes **real ADS-B/MLAT positions only**. It does not generate fake aircraft, movement, callsigns, or ATC speech.

## Files

- `index.html` — standalone frontend, with responsive map/radar, range controls, search, aircraft details, altitude/groundspeed/heading, traffic list, ground-position filter and received-position trails.
- `api/aircraft.js` — optional same-origin serverless proxy for Vercel; uses ADSB.lol and an optional server-side API key.

## Quick launch

1. Open `index.html` in a browser **with Internet access**, or open the copy named `wsss_live_radar.html` supplied separately.
2. By default AUTO tries `/api/aircraft` (when hosted), then Airplanes.live, then ADSB.lol via a direct browser request.
3. If direct requests are blocked by CORS or the provider's access policy, use the hosted Vercel project below.
4. Switch between MAP and RADAR. The MAP view needs access to Leaflet and CARTO/OSM map tiles. The RADAR view does not require a map-tile service, but both modes require a usable ADS-B API for live aircraft.
5. The GND checkbox includes aircraft explicitly reported on the ground. If no ground positions are available from the supplier, no ground aircraft are invented.

## Deploy on Vercel (recommended)

1. Create a GitHub repository and upload the contents of this folder, preserving the `api/aircraft.js` path.
2. Go to Vercel, create a New Project, and import the repository. Use Framework Preset **Other** and keep the root directory at the repository root. No frontend build step is required.
3. Deploy. The site loads `index.html` at `/`, and the optional proxy is available at `/api/aircraft?radius=10`.
4. Open the site, go to Settings and select **AUTO** or **VERCEL PROXY**. Check the status indicator: `LIVE ADS-B` only appears after a structurally valid aircraft response.
5. For larger-scale usage, obtain suitable API access and add the secret `ADSB_LOL_API_KEY` as a **Vercel Environment Variable** (never in `index.html`), then redeploy.

**Important usage limits:** ADSB.lol documents an anonymous limit of 500 requests/day per IP and quota errors (HTTP 429); this app spaces proxy/direct ADSB.lol queries at roughly 180 seconds, but many users sharing the same server-side IP may hit the quota. The Airplanes.live direct mode attempts roughly every 60 seconds; observe that service's policy and adjust code if your permission/plan requires a different interval. Direct browser requests depend on source CORS permissions and can fail even when the upstream API exists. The proxy does not override source quota restrictions. Commercial or high-traffic deployment needs the relevant permissions/plan and compliance with applicable dataset licensing (including ADSB.lol ODbL 1.0).

## Live-data semantics

- All rendered aircraft are parsed from the most recent successful API JSON response. **No demo samples or fabricated flight labels are included.**
- The map and radar show fixed received positions between provider updates; the radar sweep is **visual only** and does not fabricate aircraft movement.
- Flight trails are lines joining successive received positions recorded during the current browser session (not historical airline tracks).
- `GROUND` classification is used only when explicitly reported by the upstream data (`alt_baro: "ground"`, ground Boolean, etc.). It does not infer taxiing from low altitude.
- After errors or freshness expiration, the status changes to `FEED OFFLINE` or `STALE`, and existing displayed positions are labeled as last-received data.
- Callsigns are sourced from the API. Some known ICAO airline codes (e.g. `SIA123`, `TGW248`) are *displayed* as their passenger-facing equivalents (`SQ123`, `TR248`). Raw callsigns are retained in the internal aircraft object. Neither implies an authoritative WSSS departure/arrival association.
- Ground aircraft around WSSS may be absent or intermittent depending on receiver coverage, privacy constraints, or API response filtering. The app does not promise complete airport surface coverage or display gate assignments.

## Map geometry and credits

CAAS Singapore AIP WSSS runway physical characteristics were used for the three runway endpoints. Map base layer uses CARTO tiles and OpenStreetMap data with attribution. Runway alignment is geographic; airport buildings and roads are presented through third-party basemap tiles.

- CAAS AIP reference: https://aim-sg.caas.gov.sg/aim-content/uploads/aip/22-JAN-2026/AIP-2/2026-01-22-000000/html/eAIP/SG-AD-2-WSSS-en-GB.html
- Airplanes.live API: https://airplanes.live/api-docs/
- ADSB.lol API and limits: https://www.adsb.lol/docs/open-data/api
- LiveATC WSSS page (opens externally): https://www.liveatc.net/search/?icao=WSSS

**Not for use as a real-world air traffic control, airfield safety, or navigation system.** Aircraft telemetry may be missing, delayed, or inaccurate.
