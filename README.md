# Server Hall Live

A three.js animation of a server room that shows how the servers are performing. All numbers come from a simulation that runs in the page; it is not connected to real monitoring data.

## What you see

- **24 racks in four rows** (web front-end, API services, database, batch and analytics), with cold and hot aisles, two CRAC cooling units, overhead cable trays and a core switch.
- **42U cabinets at true scale**: 12 × 2U servers in U1–24, blanking panels in U25–39, a patch panel in U40 and two top-of-rack switches in U41–42. Fronts show NVMe caddies and honeycomb intakes; rears show PSUs, I/O and fibre leads, with cable looms down the hot-aisle side. Steel panels, rails and floor pick up reflections from an environment map.
- **Light column on each rack**: height and colour show CPU load, or inlet air temperature when you switch the colour mode.
- **Server LEDs**: activity lights blink faster under load; status lights go amber for a warning and flash red when critical.
- **Hot-aisle particles**: exhaust air, brighter and redder as it heats up.
- **Cold-aisle particles**: supply air rising from the perforated floor tiles.
- **Packets on the cable trays**: network traffic to and from the core switch, denser with more traffic.

## Inspect a single server

Click any server in a rack (or a cell in the rack panel's server strip) and it slides out on its rails while the camera flies in. The lid is off, and the hardware animates from that server's own telemetry:

- **Fans** spin faster as the CPUs heat up (3,800 to 13,000 rpm).
- **Heatsinks** glow from blue to red with CPU temperature, with heat rising off them.
- **Memory sticks** light up in turn as memory fills (16 DIMMs, 512 GB).
- **Drive and network LEDs** blink with disk IOPS and network traffic.
- **Airflow particles** enter cool at the front and warm up as they pass the CPUs.

The server panel shows per-core load for all 64 cores, CPU temperatures, fan speed, memory, IOPS, network and power, plus a 2-minute CPU trend. **Run 20 s stress test** pins the cores at 100% so you can watch the temperatures, fans and alerts respond. Click the pulled-out server again, press **Back** or <kbd>Esc</kbd> to slide it back in like a drawer; the camera stays where it is. Opening a server stops the camera rotation until you press **Start rotation**.

## Panels and controls

- KPI strip: requests/s, average CPU, network, IT load, PUE and the hottest inlet temperature.
- Rack detail, **Live** tab: CPU, memory, power and network are rolled up from the rack's 12 servers (power also includes the two switches), with a count of servers in warning or critical state, inlet/exhaust temperature and 2-minute trends. A rack also turns amber when any of its servers is critical. Click a rack or use the arrow buttons.
- Rack detail, **Inventory** tab: everything in the rack from U42 down (switches, patch panel, free space, each server with model, drives, serial and in-service date, both PDUs), with live load and power per device and a rack total. Click a server row to pull it out.
- Controls: traffic demand slider, traffic spike, CRAC-2 failure, colour mode, **Stop/Start rotation** for the camera orbit and **Hide/Show airflow** for the air particles.
- Alerts follow ASHRAE A1 guidance: 27 °C recommended and 32 °C allowable inlet limits, plus 85% / 95% CPU thresholds.

## Run it

It's a single static file with no build step. Open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

three.js 0.147.0, OrbitControls and RoomEnvironment load from jsDelivr, and the fonts from Google Fonts.
