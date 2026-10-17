// Mutable simulation and UI state shared between modules.
export const HIST = 120;   // seconds of trend history

// World: demand inputs, faults, colour mode, clock
export const W = { traffic: 0.6, spikeAge: Infinity, fault: false, faultLevel: 0, mode: 'load', t: 0, sampleAcc: 0, warm: true, sampled: false };
// Hall-wide totals for the KPI strip
export const G = { rps: 0, cpu: 0, net: 0, it: 0, cool: 0, pue: 0, maxIn: 0, maxInRack: null, rpsHist: [], cpuHist: [] };
// Selection, hover, camera orbit
export const UI = { selected: null, hovered: null, orbitOn: true, airOn: true, cutRack: null };
// The pulled-out server
export const SV = {
  sel: null, open: false, slide: 0, fOn: false, cores: new Float32Array(64), coreBias: new Float32Array(64),
  temp: [40, 40], rpm: 4000, mem: 0, iops: 0, netIn: 0, netOut: 0, power: 0, tLvl: 0, cLvl: 0, status: 0
};
