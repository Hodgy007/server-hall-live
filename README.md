# Server Hall Live

A three.js animation of a server room that shows how the servers are performing. The halls, racks and servers come from a site file you supply (JSON: each building and hall's floor layout, and every server with its rack, U position, make, model, CPU, memory, addresses, out-of-band controller, NICs and disks); with no file it shows a generated demo hall. Performance figures come from a simulation that runs in the page unless you point it at a live telemetry feed.

## What you see

- **Your halls, as your file lays them out** (see [Your own data centre](#your-own-data-centre)): the room is the size of the hall's floor grid, racks stand where the grid puts them and face the way it says, vented tiles mark the cold aisles and hot-aisle containment is built over the tiles marked for it. The header names the building and hall, and the hall picker switches between halls.
- **The demo hall** (when no file is loaded): 96 racks in eight rows of 12 (two rows each of web front-end, API services, database, and batch and analytics). Rows face each other across 1.8 m cold aisles and stand back to back over contained hot aisles; the outer rows A and H exhaust towards the end walls.
- **The room**: raised floor, walls and a suspended ceiling with light fixtures. The walls and ceiling face inwards, so from outside the room the near ones drop away and you look in like a dollhouse.
- **Lighting**: the ceiling fixtures light the floor and rack tops in soft pools down every aisle (the hot-aisle fixtures sit between the chimneys and run dimmer). Because the fixtures never move or dim, their light is worked out once at start-up into a grid through the hall that every surface looks up, rather than recalculated for every pixel of every frame. In the cold aisle nearest where you are looking, shadow-casting lights take over most of each fixture's output, so racks, trays, busways and drop rods throw real shadows; move to another aisle and the shadows fade across with you. Ambient occlusion darkens where racks meet the floor, the gaps between them and the undersides of trays and busways. A faint cool haze makes fixtures, LEDs and far racks fall off with distance, with soft shafts of light under the cold-aisle fixtures.
- **Floor**: matt anti-static tiles with sunk seams; neighbouring tiles differ slightly in tint and wear. The vented tiles down the cold aisles are bare steel grates that catch the light, with supply air glowing faintly through the holes.
- **Hot-aisle containment** over each contained hot aisle (in the demo, B/C, D/E and F/G): tinted roof panels on a frame, sliding end doors marked HOT AISLE, and chimneys about every 2.6 m up to the ceiling plenum.
- **Cooling units** CU-1 and CU-2 sit outside the hall; they take warm air from the ceiling plenum and feed the floor: CU-1 the northern half of the hall's cold aisles, CU-2 the southern half.
- **Uplink panel** in the east wall, where the tray spine leaves the hall for the meet-me room; its strips pulse with hall traffic.
- **Overhead services**: ladder cable trays with fibre bundles on threaded drop rods, a fibre riser from each rack up into its tray, and a busway over each row with a tap-off box, power drop and status LED per rack (amber above 10 kW).
- **42U cabinets at true scale**: servers at their own U positions and heights (1U to 4U, any mix in a rack; the demo puts 12 of one Dell model in each), blanking panels over every free U up to U40, an out-of-band switch in U39, a patch panel in U40 and two top-of-rack switches in U41–42. Each server shows its maker's face. **Dell PowerEdge** (1U and 2U, no bezel): a left control panel with the system health/ID and activity lights and status icons, eight NVMe carriers (light pipes, release button, hex-vented handle) standing proud of the face, a hex grille over the empty bays, the pull-out information tag (2U), and a right control panel with a green-ringed power button, USB and iDRAC Direct ports. **HPE ProLiant** (1U and 2U): the serial-label pull tab, eight Smart Carriers with their activity rings and release latches, a square-perforated vent with the status lights, and the power button, UID button, USB and iLO service port on the right; at the rear PCIe risers along the top and the OCP NIC, iLO port and two power supplies along the bottom. **Any other make, or any 3U or 4U server**: a generic chassis with handles, 3.5" carriers four across (one row in 1U up to six in 4U), the BMC port and NIC cages at the rear left and the power supplies at the right. At the rear, **blue structured cabling**: each server's out-of-band lead and up to two NIC leads drop out of their ports, run right and join a strapped bundle up the side of the cabinet, which fans out at the top to the OOB switch (U39) and the two ToR switches (NIC 1 to U42, NIC 2 to U41), each lead into the switch port its record names (the number at the end of `Ethernet1/7` or `Gi1/0/7`), or the one numbered after the server when it names none. Power cords are bundled down the other side. Pull a server out and its leads go with it. Close up the cables are drawn in full, with plugs; from the hall overview a lighter version stands in. Each rack has a **perforated front door**, so you see the LEDs through it. No two cabinets are quite alike: the powder coat varies in tint and sheen between batches, door edges, lock strips and kick plates are scuffed to different degrees, and about one rack in ten (A01, B03, F02 and others) is from a second vendor, with lighter panels, ribbed sides, a slotted roof, square-perforated doors and dark handles.
- **Glow**: LEDs, port lights and light fixtures bloom softly; steel panels and rails pick up soft reflections from an environment map.
- **Light column on each rack**: height and colour show CPU load, or inlet air temperature when you switch the colour mode.
- **Server LEDs**: activity lights blink faster under load; status lights go amber for a warning and flash red when critical.
- **Hot-aisle particles**: exhaust air, brighter and redder as it heats up. In the contained aisles it rises to the roof, drifts to the nearest chimney and leaves through it; rows A and H exhaust towards the end walls.
- **Cold-aisle particles**: supply air rising from the perforated floor tiles.
- **Packets**: network traffic climbing each rack's riser and running along the trays to the uplink panel, denser with more traffic.

## Getting around

- **Drag** to orbit, **scroll** to zoom.
- **Move** across the hall: <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> (or the arrow keys, outside rack view), **right-drag** or **shift-drag** with the mouse, or two fingers on a touch screen. The view slides along the floor and stays inside the hall; moving stops the camera rotation.
- **Reset view** (or <kbd>Esc</kbd> when no server is pulled out) flies back to the whole-hall overview with everything visible.
- **Find** (or press <kbd>/</kbd>): type a hostname such as `db-e04-07` to fly there and pull that server out, or a rack ID such as `B03` for rack view. Partial names work too, and the field suggests every host and rack.
- **Click a rack** (front or back) for **rack view**: the camera flies to a spot 2.9 m in front of it so the whole 42U front fits on screen, the door swings open, and everything between you and the rack (the opposite row, containment glass) is cut away so you can see how the rack is filled. Click a server in it to pull it out. In rack view <kbd>←</kbd> / <kbd>→</kbd> walk along the row (in the direction you are facing) and the panel's ‹ › arrows step through every rack. You can slide along the row and keep the cut-away; zoom or orbit more than about 4.5 m away, or move off across the aisle, and it switches off by itself, so the rest of the hall comes back; **Reset view** leaves rack view altogether.
- Searching for a rack ID also opens rack view.
- **Links**: the address follows what you are looking at, so it can be copied and shared. `#rack=B03` opens rack view for B03 and `#host=db-e04-07` pulls that server out; Reset view clears it.

## Inspect a single server

Click a server in an open rack (or a cell in the rack panel's server strip, a row in the inventory, or search for it) and it slides out on its rails while the camera flies in. It is shown at true scale with the lid off, built for its record (its maker's face, 1U to 4U, one to four sockets, AMD or Intel, its DIMM count). From front to back: eight NVMe drives in their carriers and the backplane, with cables running down the left wall to the board; the fan wall (six 60 mm fans in 2U, eight 40 mm fans in 1U); the CPU sockets, each in its carrier frame (orange on AMD, dark on Intel) under a copper-based heatsink with heat pipes and a label naming the processor; the DIMMs either side of each socket; VRM chokes; PCIe risers with blue handles (Dell's touch points); the OCP NIC, BOSS-N1 boot module, CMOS battery and the two power supplies. A label behind the front grille, in the maker's colour, names the model, serial (Dell's service tag) and host. The hardware animates from that server's own telemetry:

- **Fans** spin faster as the CPUs heat up (3,800 to 13,000 rpm).
- **Heatsinks** glow from blue to red with CPU temperature, with heat rising off them.
- **Memory sticks** light up in turn as memory fills (16 to 32 DIMMs, depending on the model).
- **Drive and network LEDs** blink with disk IOPS and network traffic.
- **Airflow particles** enter cool at the front and warm up as they pass the CPUs.

The server panel starts with everything its record says (anything the record leaves out is filled from the model catalogue, or left as not recorded):

- **Server**: hostname (FQDN), make and model, serial or service tag, and when it went into service.
- **Location**: building, hall, rack, U position and role.
- **Processor**, **OS** and **Memory** (size, type, DIMMs and how they sit on the memory channels, and how much is in use).
- **Local disks**, each set with its count, size, type and RAID, then raw capacity and usage; and **Attached** storage: SAN volumes or LUNs with their array, protocol, size and LUN.
- **Network**: every IP address with its interface, VLAN and gateway; then each **NIC** with the switch and port it is cabled to, its speed, bond and MAC.
- **OOB** (iDRAC, iLO or BMC): the management address, switch port and MAC. **Open … console** opens `https://<address>/` in a new tab, or whatever `oobUrl` in the site file says.

The demo hall's racks each hold twelve servers of one model, picked at random from these Dell PowerEdge models:

| Model | Size | Processors | Memory |
| --- | --- | --- | --- |
| R7725 | 2U | 2 × AMD EPYC 9355, 32 cores at 3.55 GHz | 24 DIMMs, 768 GB |
| R7725xd (storage-dense) | 2U | 2 × AMD EPYC 9375F, 32 cores at 3.8 GHz | 24 DIMMs, 768 GB |
| R7715 | 2U | 1 × AMD EPYC 9535, 64 cores at 2.4 GHz | 24 DIMMs, 768 GB |
| R6725 | 1U | 2 × AMD EPYC 9335, 32 cores at 3.0 GHz | 24 DIMMs, 768 GB |
| R6715 | 1U | 1 × AMD EPYC 9535, 64 cores at 2.4 GHz | 24 DIMMs, 768 GB |
| R770 | 2U | 2 × Intel Xeon 6737P, 32 cores at 2.9 GHz | 32 DIMMs, 1 TB |
| R770AP | 2U | 2 × Intel Xeon 6978P, 120 cores | 24 DIMMs, 768 GB |
| R670 | 1U | 2 × Intel Xeon 6737P, 32 cores at 2.9 GHz | 32 DIMMs, 1 TB |
| R570 | 2U | 1 × Intel Xeon 6737P, 32 cores at 2.9 GHz | 16 DIMMs, 512 GB |
| R470 | 1U | 1 × Intel Xeon 6737P, 32 cores at 2.9 GHz | 16 DIMMs, 512 GB |

Power draw follows the model, from idle to flat out (for a model the catalogue does not know, it is estimated from the sockets, cores and memory). The rack panel names the rack's model, or how many models it holds.

Below that it shows per-core load for every core (one block per socket), CPU temperatures, fan speed, memory, IOPS, network and power, plus a 2-minute CPU trend. **Run 20 s stress test** pins the cores at 100% so you can watch the temperatures and fans respond. Click the pulled-out server again, press **Back** or <kbd>Esc</kbd> to slide it back in like a drawer; the camera stays where it is. Flying to a rack or opening a server stops the camera rotation until you press **Start rotation**.

## Panels and controls

- KPI strip: average CPU, network, IT load and the hottest inlet temperature.
- Rack detail, **Live** tab: CPU, memory, power and network are rolled up from the rack's 12 servers (power also includes the two switches), with a count of servers in warning or critical state, inlet/exhaust temperature and 2-minute trends. A rack also turns amber when any of its servers is critical. Click a rack or use the arrow buttons.
- Rack detail, **Inventory** tab: everything in the rack from U42 down (ToR switches, patch panel, OOB switch, free space, each server with model, drives, serial and in-service date, both PDUs), with live load and power per device and a rack total. **Hover a row** to outline that device in the rack; click a server row to pull it out.
- Controls: colour mode, **Thermal camera**, **Start/Stop rotation** for the camera orbit and **Show/Hide airflow** for the air particles; both start off. The simulation runs at a steady 60% traffic demand with both cooling units healthy.
- **Colour racks by** CPU load, inlet temperature or **power** (draw against each rack's 12 kW budget, which shows where there is capacity to add servers).
- **Thermal camera** switches the hall to a false-colour infrared view (the ironbow palette, 16–46 °C): every surface takes the colour of the air where it stands, so cold aisles, rack fronts at their inlet temperature, rears and hot aisles at their exhaust and the warm ceiling plenum all read at a glance, and each server's face shows its own inlet and exhaust. Glass, the perforated doors, labels and the light columns drop out so the racks behind them show.

## Your own data centre

The page reads `data/hall.json` at start-up, or a file you load into the browser. Out of the box `data/hall.json` lists no halls, so the demo hall is generated. `data/hall.example.json` is a worked example (two buildings, Dell, HPE and Supermicro servers from 1U to 4U, SAN volumes, and three deliberate mistakes so the problems list has something to show): load it with **Load file** to see it.

### Loading a file

- **Load file** in the header (or drop a `.json` file anywhere on the page) checks the file and keeps a copy in this browser, which is used instead of `data/hall.json` from then on, on every visit, until you press **Use server file**. The header says which file is on show. The copy lives only in this browser.
- To give everyone the same view, put the file on the server as `data/hall.json`.
- **The hall picker** lists every building and hall in the file with its rack and server counts; the page shows one hall at a time (`?hall=` in the address). **Find** knows every host and rack in the file and switches to the hall it is in.
- **Problems in the data** (a chip in the header when there are any) lists what could not be placed, and why: a server whose rack is not in any hall's grid, two servers in the same rack units, a hostname used twice, a U position outside U1–38 (U39–42 hold the switches), a grid token it does not understand, a rack with no room behind it. Everything else is still shown.

### The layout editor

**Layout editor** (`layout.html`, linked from the header) draws each hall's floor plan on a grid of 0.6 m floor tiles. It opens the file this browser is using (or `data/hall.json`), and:

- **Rack ↓ / Rack ↑** place racks whose fronts face south or north; drag along a row to place a run of them. New racks are named from the prefix and the next free number, except that racks the file's servers name but no grid has yet are placed first, under those names. Each rack shows how many servers the file puts in it.
- **Vented tile** paints the cold aisle in front of racks, **Hot aisle** the contained aisle between rack rears, **Floor / erase** clears tiles and removes racks.
- **Select** a rack to rename it (its servers move with it), turn it round or delete it. Halls can be added, renamed (their servers move with them), resized and deleted; **Undo** (or Ctrl+Z) steps back.
- A file with servers but no halls gets an empty hall for each building and room its servers name, so you can lay out their racks.
- **Show in viewer** keeps the edited file in this browser and opens the hall in the viewer; **Download JSON** saves it, for `data/hall.json` or anywhere else.

### The file format

```json
{
  "domain": "corp.example.com",
  "oobUrl": "https://{ip}/",
  "telemetry": { "url": "data/telemetry.example.json", "intervalSeconds": 10 },
  "halls": [
    { "building": "LON1", "room": "Hall A", "grid": [
      ". . + + + + . .",
      ". . A01:S A02:S A03:S A04:S . .",
      ". . P P P P . .",
      ". . P P P P . .",
      ". . P P P P . .",
      ". . B01:N B02:N B03:N B04:N . .",
      ". . + + + + . .",
      ". . H H H H . ."
    ] }
  ],
  "servers": [
    {
      "host": "db-a04-01", "building": "LON1", "room": "Hall A", "rack": "A04", "u": 1, "height": 2,
      "manufacturer": "Dell", "model": "PowerEdge R760", "serial": "7XK2Q93", "installed": "2025-06", "role": "Database",
      "os": "Red Hat Enterprise Linux 9.4", "kernel": "5.14",
      "cpu": { "model": "Intel Xeon Gold 6448Y", "sockets": 2, "cores": 32, "ghz": 2.1 },
      "memory": { "gb": 1024, "dimms": 32, "type": "DDR5-4800 RDIMM" },
      "ip": [{ "address": "10.130.4.11/24", "vlan": 130, "gateway": "10.130.4.1", "interface": "bond0" }],
      "oob": { "type": "iDRAC", "ip": "10.250.4.11", "mac": "00:14:22:01:02:03", "switch": "oob-a04", "port": "Gi1/0/1" },
      "nics": [
        { "name": "ens2f0", "speed": "25G", "mac": "00:0a:f7:01:02:03", "switch": "tor-a04-a", "port": "Ethernet1/1", "bond": "bond0" },
        { "name": "ens2f1", "speed": "25G", "mac": "00:0a:f7:01:02:04", "switch": "tor-a04-b", "port": "Ethernet1/1", "bond": "bond0" }
      ],
      "localDisks": [{ "type": "NVMe", "size": "3.84 TB", "count": 8, "raid": "RAID 10" }],
      "attachedDisks": [{ "type": "SAN", "array": "pure-x70", "protocol": "FC", "size": "40 TB", "lun": 1, "name": "db-a04-01-data" }]
    }
  ]
}
```

**Halls.** `building` and `room` name the hall; `grid` is its floor, one string per row of 0.6 m tiles, tokens separated by spaces, north at the top:

| Token | Tile |
| --- | --- |
| `.` | Floor |
| `P` | Vented tile: the cold aisle |
| `H` | Contained hot aisle: containment is built over each area of these, out to the rack rears either side |
| `ID:S` / `ID:N` | A rack named ID whose front faces south (down the grid) or north |
| `+` | The back half of a rack: a rack is one tile wide and two deep, its own tile at the front and this one behind |

Rows run across the grid (east to west); racks face north or south. A rack's workload (for the simulation) is the one most of its servers have. The editor writes grids for you.

**Servers.** Only `rack` and `u` are needed (plus `building` and `room` when the file has more than one hall); everything else is optional:

| Field | What it is |
| --- | --- |
| `host` | Hostname (also `hostname`) |
| `building`, `room` | The hall it is in (or `hallId`, matching a hall's `id`) |
| `rack`, `u`, `height` | Rack name, lowest U it takes, and height in U (1–4; default from the model, else 2) |
| `manufacturer`, `model` | Make and model. Dell and HPE get their own faces; anything else the generic chassis. Known models fill in what the record leaves out: PowerEdge R7725, R7725xd, R7715, R6725, R6715, R770, R770AP, R670, R570, R470, R760, R660, and ProLiant DL380, DL360, DL385, DL365, DL345, DL325 and DL560 Gen11 |
| `serial`, `installed`, `role`, `os`, `kernel` | Serial or service tag; in-service date; role (web, API, database or batch words pick the simulated workload); operating system |
| `cpu` | `{ model, sockets, cores, ghz }` (cores per socket), or just the model as a string |
| `memory` | `{ gb, dimms, type }`, or just the size (`768`, `"1 TB"`) |
| `ip` | An address (`"10.0.0.5/24"`), a list of them, or `[{ address, vlan, gateway, interface }]` |
| `oob` | The out-of-band controller: `{ type, ip, mac, switch, port }`, or just its address. `ilo`, `idrac` and `bmc` work too; the type defaults to iDRAC for Dell, iLO for HPE and BMC for anything else |
| `nics` | `[{ name, speed, mac, switch, port, bond }]`; the first two are cabled to the ToR switches |
| `localDisks` | `[{ type, size, count, raid, model }]`: sizes like `960`, `"960 GB"`, `"7.68 TB"` |
| `attachedDisks` | SAN or other attached storage: `[{ type, array, protocol, size, lun, name }]` |
| `power` | `[idle, flat-out]` watts, if you know them |

**Settings.** `domain` builds the FQDNs; `oobUrl` is the console link (`{ip}` is the out-of-band address, `{host}` the hostname; the older `idracUrl` and `iloUrl` work too).

**Live telemetry.** `telemetry` points at a live feed (`url`, `intervalSeconds`). It is polled, and every server and rack it reports shows its real figures instead of simulated ones: `cpu` in %, `memGB`, `tempC` (hottest CPU), `powerW`, `netGbps`, and a rack's `inletC`. Values can be numbers or numeric strings; anything else is ignored and that figure stays simulated. `data/telemetry.example.json` shows the shape. Anything the feed stops reporting for three intervals falls back to the simulation; the header chip shows how many servers are live.

**Older files.** Files that only list `racks.<rack>.servers.U<n>` with flat fields (`host`, `serial`, `ip`, `idrac`, `mac`, …) still work: with no halls they fill in the demo hall's servers at those slots.

Warning and critical states follow ASHRAE A1 guidance: 27 °C recommended and 32 °C allowable inlet limits, plus 85% / 95% CPU thresholds.

## Run it

No build step, but the page uses ES modules, so it has to be served over HTTP (opening `index.html` straight from disk won't load the modules):

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

Everything the page needs is in the repository, so it also works on a network without internet access: three.js 0.169.0 and the add-ons it uses (OrbitControls, RoomEnvironment, EffectComposer, GTAOPass, UnrealBloomPass, OutputPass and their dependencies) are in `vendor/three` (MIT licence) and load through an import map, and the Barlow Condensed and IBM Plex Mono fonts are in `vendor/fonts` (SIL Open Font License).

Ambient occlusion runs at half resolution. Phones and tablets (narrow screens or touch-only pointers) skip it and use smaller shadow maps. Add `?quality=low` to the address to get that on any machine, for example a slow laptop, or `?quality=high` to force everything on.

## Code layout

| File | What it does |
| --- | --- |
| `index.html` | Markup for the HUD and the import map |
| `layout.html`, `js/editor.js`, `css/editor.css` | The layout editor |
| `css/style.css` | Viewer styles |
| `js/site.js` | The site file format: grid parsing, server normalisation and the model catalogue, validation, the hall's layout in metres, the demo hall |
| `js/data.js` | Loads the site file (the browser's copy or `data/hall.json`) and picks the hall to show |
| `js/store.js` | The browser's copy of a loaded site file (IndexedDB) |
| `js/sitebar.js` | Hall picker, data source, Load file and drag-and-drop, problems list |
| `js/core.js` | Renderer, scene, camera, controls, fill lighting, quality setting, colour scales, hall geometry from the layout, canvas helpers |
| `js/state.js` | Shared mutable state: world inputs, hall totals, selection, the pulled-out server |
| `js/textures.js` | Canvas-drawn textures for cabinets (worn and second-vendor variants), doors and rack-mounted hardware; server faces by maker and height |
| `js/cabling.js` | Structured cabling at the rack rears, built per cabinet from its servers |
| `js/racks.js` | Cabinets, servers, switches, panels, doors, selection outline and inventory highlight |
| `js/hall.js` | Tiled floor and vented tiles, walls, ceiling, hot-aisle containment, trays, risers, busway, uplink panel |
| `js/lights.js` | Ceiling fixtures and their light baked into a grid at start-up, shadow-casting lights that follow the viewed aisle, light shafts in the haze |
| `js/thermal.js` | Thermal camera: the air-temperature field, per-server surface temperatures and the false-colour material |
| `js/particles.js` | Hot and cold air particles, network packets |
| `js/server.js` | Pulled-out server model and its per-core telemetry |
| `js/sim.js` | Telemetry simulation and rack/hall roll-ups |
| `js/visuals.js` | Per-frame visual updates driven by the telemetry |
| `js/camera.js` | Camera flights and the orbit toggle |
| `js/hud.js` | KPI strip, rack and server panels, inventory, legend |
| `js/post.js` | Post-processing: ambient occlusion and bloom |
| `js/faults.js` | Hardware fault state and descriptions read by the panels |
| `js/live.js` | Polls the optional telemetry feed and applies it over the simulation |
| `js/main.js` | Wiring, picking, search, deep links, boot and the frame loop |
| `vendor/` | three.js and the fonts, served with the page |
