# Server Hall Live

A three.js animation of a server room that shows how the servers are performing. All numbers come from a simulation that runs in the page; it is not connected to real monitoring data.

## What you see

- **24 racks in four rows** (web front-end, API services, database, batch and analytics), with cold and hot aisles, two CRAC cooling units, overhead cable trays and a core switch.
- **Light column on each rack**: height and colour show CPU load, or inlet air temperature when you switch the colour mode.
- **Server LEDs**: activity lights blink faster under load; status lights go amber for a warning and flash red when critical.
- **Hot-aisle particles**: exhaust air, brighter and redder as it heats up.
- **Cold-aisle particles**: supply air rising from the perforated floor tiles.
- **Packets on the cable trays**: network traffic to and from the core switch, denser with more traffic.

## Panels and controls

- KPI strip: requests/s, average CPU, network, IT load, PUE and the hottest inlet temperature.
- Rack detail: CPU, memory, inlet/exhaust temperature, power, network and 2-minute trends. Click a rack or use the arrow buttons.
- Controls: traffic demand slider, traffic spike, CRAC-2 failure, colour mode and auto-orbit.
- Alerts follow ASHRAE A1 guidance: 27 °C recommended and 32 °C allowable inlet limits, plus 85% / 95% CPU thresholds.

## Run it

It's a single static file with no build step. Open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

three.js 0.147.0 and OrbitControls load from jsDelivr, and the fonts from Google Fonts.
