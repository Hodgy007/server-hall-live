// Inventory or monitoring mode (see resolveMode in site.js). Inventory shows the map and the records and hides everything
// driven by simulated figures; monitoring is the original page. The mode is put on <html> as data-mode so the
// stylesheet can hide the parts that do not belong: elements marked data-mon are monitoring only, data-inv inventory only.
import { SITE } from './data.js';
import { resolveMode } from './site.js';

export const MODE = resolveMode(new URLSearchParams(location.search).get('mode'), SITE.mode, SITE.telemetry);
export const INV = MODE === 'inventory';
document.documentElement.dataset.mode = MODE;
