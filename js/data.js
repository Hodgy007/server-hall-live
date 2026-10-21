// Site data: the browser's copy of a loaded file if there is one, otherwise data/hall.json, normalised by site.js.
// The page shows one hall at a time, chosen with ?hall= (the picker sets it); everything 3D is built for that hall.
import { loadSite, buildLayout } from './site.js';
import { getLocal } from './store.js';

const local = await getLocal();
let raw = null, source = { kind: 'server', name: 'data/hall.json' }, loadError = null;
if (local) {
  try { raw = JSON.parse(local.text); source = { kind: 'browser', name: local.name, at: local.at }; }
  catch (e) { loadError = `The file in this browser (${local.name}) is not valid JSON: ${e.message}`; }
}
if (!raw) {
  raw = await fetch('data/hall.json', { cache: 'no-cache' })
    .then(r => (r.ok ? r.json() : {}))
    .catch(e => { loadError = loadError || `data/hall.json could not be read: ${e.message}`; return {}; });
}

export const SITE = loadSite(raw);
SITE.source = source;
if (loadError) SITE.problems.unshift(loadError);
const want = new URLSearchParams(location.search).get('hall');
// The hall asked for, else the first with servers in it
export const HALL = SITE.halls.find(h => h.id === want) || SITE.halls.find(h => SITE.servers.some(s => s.hall === h.id)) || SITE.halls[0];
export const LAYOUT = buildLayout(HALL);
export const HALL_SERVERS = SITE.servers.filter(s => s.hall === HALL.id);
// Every host in the site and its hall, so search can find servers in the other halls
export const SITE_HOSTS = new Map(SITE.servers.map(s => [s.host.toLowerCase(), s.hall]));

// "https://{ip}/" style templates: {ip} is the out-of-band (iDRAC / iLO) address, {host} the server's hostname
export const fill = (tpl, sv) => tpl.replace(/\{ip\}/g, sv.ilo).replace(/\{host\}/g, sv.host);
