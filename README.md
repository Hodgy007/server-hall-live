# Server Hall Live

A three.js animation of a server room that shows how the servers are performing. All numbers come from a simulation that runs in the page; it is not connected to real monitoring data.

## What you see

- **96 racks in eight rows of 12** (two rows each of web front-end, API services, database, and batch and analytics). Rows face each other across 1.8 m cold aisles and stand back to back over 1.2 m hot aisles; the outer rows A and H exhaust towards the end walls.
- **The room**: raised floor, walls and a suspended ceiling with light fixtures. The walls and ceiling face inwards, so from outside the room the near ones drop away and you look in like a dollhouse.
- **Lighting**: each ceiling fixture is a rectangular area light the size of the panel, so the floor and rack tops get soft pools of light down every aisle (the hot-aisle fixtures sit between the chimneys and run dimmer). In the cold aisle nearest where you are looking, shadow-casting lights take over most of each fixture's output, so racks, trays, busways and drop rods throw real shadows; move to another aisle and the shadows fade across with you. Ambient occlusion darkens where racks meet the floor, the gaps between them and the undersides of trays and busways. A faint cool haze makes fixtures, LEDs and far racks fall off with distance, with soft shafts of light under the cold-aisle fixtures.
- **Floor**: matt anti-static tiles with sunk seams; neighbouring tiles differ slightly in tint and wear. The vented tiles down the cold aisles are bare steel grates that catch the light, with supply air glowing faintly through the holes.
- **Hot-aisle containment** over the three hot aisles (B/C, D/E, F/G): tinted roof panels on a frame, sliding end doors marked HOT AISLE, and three chimneys each up to the ceiling plenum.
- **Cooling units** CU-1 and CU-2 sit outside the hall; they take warm air from the ceiling plenum and feed the floor: CU-1 the northern cold aisles (rows A–D), CU-2 the southern ones (rows E–H).
- **Uplink panel** in the east wall, where the tray spine leaves the hall for the meet-me room; its strips pulse with hall traffic.
- **Overhead services**: ladder cable trays with fibre bundles on threaded drop rods, a fibre riser from each rack up into its tray, and a busway over each row with a tap-off box, power drop and status LED per rack (amber above 10 kW).
- **42U cabinets at true scale**: 12 × 2U servers in U1–24, blanking panels in U25–38, an out-of-band (iLO) switch in U39, a patch panel in U40 and two top-of-rack switches in U41–42. Fronts show NVMe caddies and honeycomb intakes; rears show PSUs, I/O and fibre leads, with cable looms down the hot-aisle side. Each rack has a **perforated front door**, so you see the LEDs through it. No two cabinets are quite alike: the powder coat varies in tint and sheen between batches, door edges, lock strips and kick plates are scuffed to different degrees, and about one rack in ten (A01, B03, F02 and others) is from a second vendor, with lighter panels, ribbed sides, a slotted roof, square-perforated doors and dark handles.
- **Glow**: LEDs, port lights and light fixtures bloom softly; steel panels and rails pick up soft reflections from an environment map.
- **Light column on each rack**: height and colour show CPU load, or inlet air temperature when you switch the colour mode.
- **Server LEDs**: activity lights blink faster under load; status lights go amber for a warning and flash red when critical.
- **Hot-aisle particles**: exhaust air, brighter and redder as it heats up. In the contained aisles it rises to the roof, drifts to the nearest chimney and leaves through it; rows A and H exhaust towards the end walls.
- **Cold-aisle particles**: supply air rising from the perforated floor tiles.
- **Packets**: network traffic climbing each rack's riser and running along the trays to the uplink panel, denser with more traffic.

## Getting around

- **Drag** to orbit, **scroll** to zoom.
- **Reset view** (or <kbd>Esc</kbd> when no server is pulled out) flies back to the whole-hall overview with everything visible.
- **Find** (or press <kbd>/</kbd>): type a hostname such as `db-c04-07` to fly there and pull that server out, or a rack ID such as `B03` for rack view. Partial names work too, and the field suggests every host and rack.
- **Click a rack** (front or back) for **rack view**: the camera flies to a spot 2.9 m in front of it so the whole 42U front fits on screen, the door swings open, and everything between you and the rack (the opposite row, containment glass) is cut away so you can see how the rack is filled. Click a server in it to pull it out. In rack view <kbd>←</kbd> / <kbd>→</kbd> walk along the row (in the direction you are facing) and the panel's ‹ › arrows step through every rack. Zoom or orbit more than about 4.5 m away from the rack and the cut-away switches off by itself, so the rest of the hall comes back; **Reset view** leaves rack view altogether.
- Searching for a rack ID also opens rack view.

## Inspect a single server

Click a server in an open rack (or a cell in the rack panel's server strip, a row in the inventory, or search for it) and it slides out on its rails while the camera flies in. The lid is off, and the hardware animates from that server's own telemetry:

- **Fans** spin faster as the CPUs heat up (3,800 to 13,000 rpm).
- **Heatsinks** glow from blue to red with CPU temperature, with heat rising off them.
- **Memory sticks** light up in turn as memory fills (16 DIMMs, 512 GB).
- **Drive and network LEDs** blink with disk IOPS and network traffic.
- **Airflow particles** enter cool at the front and warm up as they pass the CPUs.

The server panel starts with the server's specification:

- **Server**: hostname (FQDN), model and serial number.
- **Processor**: 2 × Intel Xeon Gold 6448Y (web and API rows), AMD EPYC 9354 (database) or AMD EPYC 9334 (batch); 32 cores each.
- **OS**: Ubuntu, Debian, Red Hat Enterprise Linux or Rocky Linux, with the kernel version.
- **Memory**: 512 GB DDR5-4800 (16 × 32 GB) and how much is in use.
- **Storage**: 8 NVMe drives (960 GB to 7.68 TB depending on the row), raw capacity and usage.
- **Network**: the LACP bond's IP address, VLAN, gateway and MTU; **NIC 1** and **NIC 2** with the ToR switch and port each one is cabled to, and their MAC addresses.
- **OOB (iLO)**: the management IP, the out-of-band switch port and MAC. **Open iLO console** opens `https://<iLO IP>/` in a new tab, or whatever `iloUrl` in `data/hall.json` says. Generated addresses are simulated; real ones come from your site data (below).

Below that it shows per-core load for all 64 cores, CPU temperatures, fan speed, memory, IOPS, network and power, plus a 2-minute CPU trend. **Run 20 s stress test** pins the cores at 100% so you can watch the temperatures, fans and alerts respond. Click the pulled-out server again, press **Back** or <kbd>Esc</kbd> to slide it back in like a drawer; the camera stays where it is. Flying to a rack or opening a server stops the camera rotation until you press **Start rotation**.

## Panels and controls

- KPI strip: requests/s, average CPU, network, IT load, PUE and the hottest inlet temperature.
- Rack detail, **Live** tab: CPU, memory, power and network are rolled up from the rack's 12 servers (power also includes the two switches), with a count of servers in warning or critical state, inlet/exhaust temperature and 2-minute trends. A rack also turns amber when any of its servers is critical. Click a rack or use the arrow buttons.
- Rack detail, **Inventory** tab: everything in the rack from U42 down (ToR switches, patch panel, OOB switch, free space, each server with model, drives, serial and in-service date, both PDUs), with live load and power per device and a rack total. **Hover a row** to outline that device in the rack; click a server row to pull it out.
- Controls: traffic demand slider, **Replay**, traffic spike, **Inject hardware fault** / **Repair all faults**, cooling unit CU-2 failure (its aisles lose supply air and those racks' inlets climb), colour mode, **Stop/Start rotation** for the camera orbit and **Hide/Show airflow** for the air particles.
- **Colour racks by** CPU load, inlet temperature or **power** (draw against each rack's 12 kW budget, which shows where there is capacity to add servers).
- **Replay** scrubs back up to 10 minutes: the 3D view, rack panel and KPIs show the hall as it was (one snapshot a second) while the simulation keeps running; the header chip shows how far back you are and **back to live** returns. Sparklines and the pulled-out server stay live.

## Hardware faults

**Inject hardware fault** fails something at random somewhere in the hall:

- **PSU**: the server keeps running on its second supply. In the pulled-out view the failed PSU's LED flashes red.
- **NVMe drive**: RAID runs degraded while it rebuilds onto the hot spare; the drive's LED stays amber and the storage line says so.
- **Fan**: that fan stops, the other five spin about 15% faster and the CPUs run about 6 °C hotter.
- **ToR switch**: one of the rack's two switches goes down; its status LEDs flash red, every server's bond runs on the other link, and the NIC line for that switch says *link down*.

Any fault makes its server a warning (amber status LED), which rolls up into the rack's counts; a switch outage makes the whole rack a warning. Each fault raises an alert, is listed in the server panel, and is named on the server's row in the inventory. **Repair all faults** clears them.

## Your own data

`data/hall.json` is read at start-up. Out of the box it lists no racks, so everything is generated and simulated. Copy `data/hall.example.json` over it to see the format:

- `domain` for the FQDNs and `iloUrl` for the console link (`{ip}` is the iLO address, `{host}` the hostname).
- `racks.<rack>.servers.U<n>` gives a server's real `host`, `serial`, `installed`, `model`, `cpu`, `cpuNote`, `os`, `kernel`, `drives`, `driveTB`, `ip`, `vlan`, `gateway`, `port`, `mac`, `ilo`, `oobPort` and `iloMac`. Every field is optional; slots and fields you leave out keep their generated values. Servers sit at U1, U3, … U23.
- `telemetry` points at a live feed (`url`, `intervalSeconds`). It is polled, and every server and rack it reports shows its real figures instead of simulated ones: `cpu` in %, `memGB`, `tempC` (hottest CPU), `powerW`, `netGbps`, and a rack's `inletC`. `data/telemetry.example.json` shows the shape. Anything the feed stops reporting for three intervals falls back to the simulation; the header chip shows how many servers are live.
- Alerts follow ASHRAE A1 guidance: 27 °C recommended and 32 °C allowable inlet limits, plus 85% / 95% CPU thresholds.

## Run it

No build step, but the page uses ES modules, so it has to be served over HTTP (opening `index.html` straight from disk won't load the modules):

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

three.js 0.169.0 and its add-ons (OrbitControls, RoomEnvironment, RectAreaLightUniformsLib, EffectComposer, GTAOPass, UnrealBloomPass, OutputPass) load from jsDelivr through an import map, and the fonts from Google Fonts.

Phones and tablets (narrow screens or touch-only pointers) skip ambient occlusion and use smaller shadow maps. Add `?quality=low` to the address to get that on any machine, for example a slow laptop, or `?quality=high` to force everything on.

## Code layout

| File | What it does |
| --- | --- |
| `index.html` | Markup for the HUD and the import map |
| `css/style.css` | All styles |
| `js/core.js` | Renderer, scene, camera, controls, fill lighting, quality setting, colour scales, hall geometry constants, canvas helpers |
| `js/state.js` | Shared mutable state: world inputs, hall totals, selection, the pulled-out server |
| `js/textures.js` | Canvas-drawn textures for cabinets (worn and second-vendor variants), doors and rack-mounted hardware |
| `js/racks.js` | Cabinets, servers, switches, panels, doors, selection outline and inventory highlight |
| `js/hall.js` | Tiled floor and vented tiles, walls, ceiling, hot-aisle containment, trays, risers, busway, uplink panel |
| `js/lights.js` | Ceiling fixtures as area lights, shadow-casting lights that follow the viewed aisle, light shafts in the haze |
| `js/particles.js` | Hot and cold air particles, network packets |
| `js/server.js` | Pulled-out server model and its per-core telemetry |
| `js/sim.js` | Telemetry simulation and rack/hall roll-ups |
| `js/visuals.js` | Per-frame visual updates driven by the telemetry |
| `js/camera.js` | Camera flights and the orbit toggle |
| `js/hud.js` | KPI strip, rack and server panels, inventory, legend |
| `js/alerts.js` | Alert feed |
| `js/post.js` | Post-processing: ambient occlusion and bloom |
| `js/faults.js` | Hardware faults: inject, repair, describe |
| `js/replay.js` | Ten-minute snapshot ring buffer and the swap used while replaying |
| `js/data.js` | Loads `data/hall.json` |
| `js/live.js` | Polls the optional telemetry feed and applies it over the simulation |
| `js/main.js` | Wiring, picking, search, boot and the frame loop |
