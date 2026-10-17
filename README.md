# Server Hall Live

A three.js animation of a server room that shows how the servers are performing. All numbers come from a simulation that runs in the page; it is not connected to real monitoring data.

## What you see

- **24 racks in four rows** (web front-end, API services, database, batch and analytics), with cold and hot aisles, two CRAC cooling units and a core switch.
- **The room**: raised floor, walls and a suspended ceiling with light fixtures. The walls and ceiling face inwards, so from outside the room the near ones drop away and you look in like a dollhouse.
- **Hot-aisle containment** over the aisle between rows B and C: tinted roof panels on a frame, sliding end doors marked HOT AISLE, and two chimneys up to the ceiling plenum.
- **Overhead services**: ladder cable trays with fibre bundles on threaded drop rods, a fibre riser from each rack up into its tray, and a busway over each row with a tap-off box, power drop and status LED per rack (amber above 10 kW).
- **42U cabinets at true scale**: 12 × 2U servers in U1–24, blanking panels in U25–39, a patch panel in U40 and two top-of-rack switches in U41–42. Fronts show NVMe caddies and honeycomb intakes; rears show PSUs, I/O and fibre leads, with cable looms down the hot-aisle side. Each rack has a **perforated front door**, so you see the LEDs through it.
- **Glow**: LEDs, port lights and light fixtures bloom softly; steel panels, rails and floor pick up reflections from an environment map.
- **Light column on each rack**: height and colour show CPU load, or inlet air temperature when you switch the colour mode.
- **Server LEDs**: activity lights blink faster under load; status lights go amber for a warning and flash red when critical.
- **Hot-aisle particles**: exhaust air, brighter and redder as it heats up. In the contained aisle it rises to the roof, drifts to the nearest chimney and leaves through it; rows A and D exhaust back towards the CRAC returns.
- **Cold-aisle particles**: supply air rising from the perforated floor tiles.
- **Packets**: network traffic climbing each rack's riser and running along the trays to the core switch, denser with more traffic.

## Getting around

- **Drag** to orbit, **scroll** to zoom.
- **Hall view** flies back to the overview from wherever you are.
- **Find** (or press <kbd>/</kbd>): type a hostname such as `db-c04-07` to fly there and pull that server out, or a rack ID such as `B03` to fly to the front of that rack. Partial names work too, and the field suggests every host and rack.
- **Click a rack** to select it and swing its door open (the previously selected rack's door closes). Clicking a server behind a closed door opens the door first; click again to pull the server out.

## Inspect a single server

Click a server in an open rack (or a cell in the rack panel's server strip, a row in the inventory, or search for it) and it slides out on its rails while the camera flies in. The lid is off, and the hardware animates from that server's own telemetry:

- **Fans** spin faster as the CPUs heat up (3,800 to 13,000 rpm).
- **Heatsinks** glow from blue to red with CPU temperature, with heat rising off them.
- **Memory sticks** light up in turn as memory fills (16 DIMMs, 512 GB).
- **Drive and network LEDs** blink with disk IOPS and network traffic.
- **Airflow particles** enter cool at the front and warm up as they pass the CPUs.

The server panel shows per-core load for all 64 cores, CPU temperatures, fan speed, memory, IOPS, network and power, plus a 2-minute CPU trend. **Run 20 s stress test** pins the cores at 100% so you can watch the temperatures, fans and alerts respond. Click the pulled-out server again, press **Back** or <kbd>Esc</kbd> to slide it back in like a drawer; the camera stays where it is. Flying to a rack or opening a server stops the camera rotation until you press **Start rotation**.

## Panels and controls

- KPI strip: requests/s, average CPU, network, IT load, PUE and the hottest inlet temperature.
- Rack detail, **Live** tab: CPU, memory, power and network are rolled up from the rack's 12 servers (power also includes the two switches), with a count of servers in warning or critical state, inlet/exhaust temperature and 2-minute trends. A rack also turns amber when any of its servers is critical. Click a rack or use the arrow buttons.
- Rack detail, **Inventory** tab: everything in the rack from U42 down (switches, patch panel, free space, each server with model, drives, serial and in-service date, both PDUs), with live load and power per device and a rack total. **Hover a row** to outline that device in the rack; click a server row to pull it out.
- Controls: traffic demand slider, traffic spike, CRAC-2 failure, colour mode, **Stop/Start rotation** for the camera orbit and **Hide/Show airflow** for the air particles.
- Alerts follow ASHRAE A1 guidance: 27 °C recommended and 32 °C allowable inlet limits, plus 85% / 95% CPU thresholds.

## Run it

No build step, but the page uses ES modules, so it has to be served over HTTP (opening `index.html` straight from disk won't load the modules):

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

three.js 0.169.0 and its add-ons (OrbitControls, RoomEnvironment, EffectComposer, UnrealBloomPass, OutputPass) load from jsDelivr through an import map, and the fonts from Google Fonts.

## Code layout

| File | What it does |
| --- | --- |
| `index.html` | Markup for the HUD and the import map |
| `css/style.css` | All styles |
| `js/core.js` | Renderer, scene, camera, controls, lighting, colour scales, hall geometry constants, canvas helpers |
| `js/state.js` | Shared mutable state: world inputs, hall totals, selection, the pulled-out server |
| `js/textures.js` | Canvas-drawn textures for cabinets, doors and rack-mounted hardware |
| `js/racks.js` | Cabinets, servers, switches, panels, doors, selection outline and inventory highlight |
| `js/hall.js` | Floor, walls, ceiling, hot-aisle containment, trays, risers, busway, core switch, CRACs |
| `js/particles.js` | Hot and cold air particles, network packets |
| `js/server.js` | Pulled-out server model and its per-core telemetry |
| `js/sim.js` | Telemetry simulation and rack/hall roll-ups |
| `js/visuals.js` | Per-frame visual updates driven by the telemetry |
| `js/camera.js` | Camera flights and the orbit toggle |
| `js/hud.js` | KPI strip, rack and server panels, inventory, legend |
| `js/alerts.js` | Alert feed |
| `js/post.js` | Bloom post-processing |
| `js/main.js` | Wiring, picking, search, boot and the frame loop |
