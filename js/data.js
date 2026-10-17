// Site data: real names, addresses and hardware from data/hall.json override the generated inventory,
// and an optional telemetry feed replaces the simulation for the servers it reports. See data/hall.example.json.
export const HALL = await fetch('data/hall.json', { cache: 'no-cache' })
  .then(r => (r.ok ? r.json() : {}))
  .catch(() => ({}));

// "https://{ip}/" style templates: {ip} is the iLO address, {host} the server's hostname
export const fill = (tpl, sv) => tpl.replace(/\{ip\}/g, sv.ilo).replace(/\{host\}/g, sv.host);
