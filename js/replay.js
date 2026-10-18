// Time replay: one snapshot per second of every rack, every server and the hall totals, kept for 10 minutes.
// While replaying, the frame swaps the recorded values in just before drawing and swaps the live ones back after,
// so the simulation keeps running underneath and the 3D view, rack panel and KPIs show the past.
import { G } from './state.js';
import { racks } from './racks.js';

export const RING = 600;                       // seconds kept
const RK = ['load', 'inlet', 'power', 'mem', 'net', 'exhaust', 'swPower'], RS = ['status', 'svWarn', 'svCrit'];
const GK = ['cpu', 'net', 'it', 'maxIn'];
const nR = racks.length, servers = racks.flatMap(r => r.servers), nS = servers.length;
const rk = new Float32Array(RING * nR * RK.length), rs = new Uint8Array(RING * nR * RS.length);
const svL = new Float32Array(RING * nS), svS = new Uint8Array(RING * nS);
const gk = new Float32Array(RING * GK.length), gIn = new Int16Array(RING);
let head = -1, count = 0;

export const replay = { ago: 0 };              // seconds back from now; 0 = live
export const recorded = () => count;

export function record() {
  head = (head + 1) % RING; count = Math.min(RING, count + 1);
  racks.forEach((r, i) => {
    const o = (head * nR + i) * RK.length, p = (head * nR + i) * RS.length;
    RK.forEach((k, j) => { rk[o + j] = r[k]; });
    RS.forEach((k, j) => { rs[p + j] = r[k]; });
  });
  servers.forEach((sv, i) => { svL[head * nS + i] = sv.load; svS[head * nS + i] = sv.status; });
  GK.forEach((k, j) => { gk[head * GK.length + j] = G[k]; });
  gIn[head] = racks.indexOf(G.maxInRack);
}

// Swap the snapshot from `ago` seconds back into the live objects; returns false when live
const stash = { r: new Float32Array(nR * (RK.length + RS.length)), s: new Float32Array(nS * 2), g: new Float32Array(GK.length + 1) };
let swapped = false;
export function swapIn() {
  if (!replay.ago || !count) return false;
  const ago = Math.min(replay.ago, count - 1), slot = (head - ago + RING) % RING;
  racks.forEach((r, i) => {
    const b = i * (RK.length + RS.length), o = (slot * nR + i) * RK.length, p = (slot * nR + i) * RS.length;
    RK.forEach((k, j) => { stash.r[b + j] = r[k]; r[k] = rk[o + j]; });
    RS.forEach((k, j) => { stash.r[b + RK.length + j] = r[k]; r[k] = rs[p + j]; });
  });
  servers.forEach((sv, i) => { stash.s[i * 2] = sv.load; stash.s[i * 2 + 1] = sv.status; sv.load = svL[slot * nS + i]; sv.status = svS[slot * nS + i]; });
  GK.forEach((k, j) => { stash.g[j] = G[k]; G[k] = gk[slot * GK.length + j]; });
  stash.gRack = G.maxInRack; G.maxInRack = racks[gIn[slot]] || G.maxInRack;
  swapped = true;
  return true;
}
export function swapOut() {
  if (!swapped) return;
  racks.forEach((r, i) => {
    const b = i * (RK.length + RS.length);
    RK.forEach((k, j) => { r[k] = stash.r[b + j]; });
    RS.forEach((k, j) => { r[k] = stash.r[b + RK.length + j]; });
  });
  servers.forEach((sv, i) => { sv.load = stash.s[i * 2]; sv.status = stash.s[i * 2 + 1]; });
  GK.forEach((k, j) => { G[k] = stash.g[j]; });
  G.maxInRack = stash.gRack;
  swapped = false;
}
