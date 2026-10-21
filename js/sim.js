// Telemetry simulation: every server runs its own figures; racks and the hall roll them up.
import { clamp, coolingUnit } from './core.js';
import { W, G, SV, HIST } from './state.js';
import { racks } from './racks.js';
import { stepServer, level } from './server.js';
import { applyServer, applyRack } from './live.js';

const wave = (t, p) => 0.5 * Math.sin(t * 0.21 + p) + 0.3 * Math.sin(t * 0.53 + p * 1.7) + 0.2 * Math.sin(t * 1.31 + p * 2.9);

export function step(dt) {
  W.t += dt; W.spikeAge += dt;
  const sa = W.spikeAge;
  const spike = sa < 1.5 ? sa / 1.5 : Math.exp(-(sa - 1.5) / 4);
  W.faultLevel += ((W.fault ? 1 : 0) - W.faultLevel) * Math.min(1, dt * 0.25);
  let cpu = 0, net = 0, it = 0, maxIn = -1, maxR = null;
  for (const r of racks) {
    let target;
    if (r.kind === 3) target = 0.22 + 0.6 * Math.max(0, Math.sin(W.t * 0.07 + r.phase)) + wave(W.t, r.phase) * 0.08 + spike * r.prof.aff * 0.4;
    else target = r.base * (0.45 + W.traffic * 1.1) + wave(W.t, r.phase) * 0.12 + spike * r.prof.aff * 0.42;
    // The load balancer hands the rack a share of the row's demand; every server then runs its own telemetry
    r.demand += (clamp(target, 0.04, 1) - r.demand) * Math.min(1, dt * 1.2);
    const k3 = Math.min(1, dt * 0.3), k5 = Math.min(1, dt * 0.5), k8 = Math.min(1, dt * 0.8);
    let sLoad = 0, sMem = 0, sPow = 0, sNet = 0, nWarn = 0, nCrit = 0;
    for (const sv of r.servers) {
      sv.stressLeft = Math.max(0, sv.stressLeft - dt);
      sv.stressAmp += ((sv.stressLeft > 0 ? 1 : 0) - sv.stressAmp) * Math.min(1, dt * 1.5);
      const own = clamp(r.demand * sv.bias + wave(W.t * 1.6, sv.phase) * 0.05, 0.02, 1);
      sv.load = own + sv.stressAmp * (1 - own) * 0.98;
      sv.mem += (clamp((0.36 + r.memBase + sv.load * 0.28) * sv.memBias + sv.stressAmp * 0.15, 0.08, 0.97) - sv.mem) * k3;
      const fanOut = sv.faults.some(f => f.kind === 'fan');
      sv.temp += (r.inlet + 13 + sv.load * 55 + (fanOut ? 6 : 0) - sv.temp) * k5;
      sv.rpm += ((3800 + clamp((sv.temp - 45) / 40, 0, 1) * 9200) * (fanOut ? 1.15 : 1) - sv.rpm) * k8;
      sv.power = sv.spec.w[0] + sv.load * (sv.spec.w[1] - sv.spec.w[0]) + (sv.rpm - 3800) * 0.006;   // idle to flat-out for the model, plus fans
      sv.net = r.prof.net / 12 * sv.load * sv.bias * (0.85 + 0.15 * Math.sin(W.t * 1.7 + sv.phase));   // the profile's figure is for a rack of 12
      applyServer(sv);   // live telemetry, when a feed reports this server, replaces the simulated figures
      sv.cLvl = level(sv.load * 100, 85, 95, sv.cLvl, 3);
      sv.tLvl = level(sv.temp, 85, 95, sv.tLvl, 2);
      sv.status = Math.max(sv.cLvl, sv.tLvl, sv.faults.length ? 1 : 0);   // any hardware fault is at least a warning
      if (sv.status === 2) nCrit++; else if (sv.status === 1) nWarn++;
      sLoad += sv.load; sMem += sv.mem; sPow += sv.power; sNet += sv.net;
    }
    // Rack figures are the roll-up of its servers, plus the two top-of-rack switches
    const n = Math.max(1, r.servers.length);
    r.load = sLoad / n;
    r.mem = sMem / n;
    r.swPower = 0.26 + sNet / 400;
    r.power = sPow / 1000 + r.swPower;
    r.net = sNet;
    r.svWarn = nWarn; r.svCrit = nCrit;
    const end = r.end;   // 0 in the middle of its row, 1 at either end
    const faultHit = coolingUnit(r.z) === 1 ? 11 : 3.5;   // rows fed by CU-2 lose supply air when it fails
    const inT = 19.5 + r.inletOffset + end * 1.8 * r.load + W.faultLevel * faultHit * (0.6 + 0.4 * r.load);
    r.inlet += (inT - r.inlet) * k5;
    applyRack(r);
    r.exhaust = r.inlet + 3 + r.power * 1.6;
    cpu += r.load; net += r.net; it += r.power;
    if (r.inlet > maxIn) { maxIn = r.inlet; maxR = r; }

    r.cpuLvl = level(r.load * 100, 85, 95, r.cpuLvl, 3);
    r.tLvl = level(r.inlet, 27, 32, r.tLvl, 0.6);
    r.svLvl = nCrit > 0 ? 1 : 0;
    r.faultLvl = r.torDown[0] || r.torDown[1] ? 1 : 0;
    r.status = Math.max(r.cpuLvl, r.tLvl, r.svLvl, r.faultLvl);
  }
  G.cpu = cpu / Math.max(1, racks.length); G.net = net; G.it = it;
  G.maxIn = maxIn; G.maxInRack = maxR;

  W.sampleAcc += dt;
  if (W.sampleAcc >= 1) {
    W.sampleAcc -= 1;
    for (const r of racks) {
      r.hist.push(r.load * 100); r.ihist.push(r.inlet); if (r.hist.length > HIST) { r.hist.shift(); r.ihist.shift(); }
      for (const sv of r.servers) { sv.hist.push(sv.load * 100); if (sv.hist.length > HIST) sv.hist.shift(); }
    }
    G.cpuHist.push(G.cpu * 100);
    if (G.cpuHist.length > HIST) G.cpuHist.shift();
    W.sampled = true;
  }
  if (SV.sel) stepServer(dt);
}
