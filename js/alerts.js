// Alert feed in the controls panel (newest first, six kept).
import { $ } from './core.js';

const alerts = [];
export function pushAlert(sev, text) {
  const d = new Date();
  alerts.unshift({ sev, text, t: d.toTimeString().slice(0, 8) });
  if (alerts.length > 6) alerts.pop();
  const ul = $('alerts'); ul.textContent = '';
  for (const a of alerts) {
    const li = document.createElement('li'); li.className = a.sev;
    const tm = document.createElement('time'); tm.textContent = a.t;
    const sp = document.createElement('span'); sp.textContent = a.text;
    li.append(tm, sp); ul.append(li);
  }
}
