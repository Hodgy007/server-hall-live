# Server Hall Live

A three.js animation of a server room that shows how the servers are performing. The halls, racks and servers come from a site file you supply (JSON: each building and hall's floor layout, and every server with its rack, U position, make, model, CPU, memory, addresses, out-of-band controller, NICs and disks); with no file it shows a generated demo hall. Performance figures come from a simulation that runs in the page unless you point it at a live telemetry feed. The page has two modes: **inventory mode** (a map and inventory of which server is in which cabinet, with nothing made up) and **monitoring mode** (the simulated or live figures too); see [Inventory and monitoring modes](#inventory-and-monitoring-modes).

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
- **Server LEDs**: activity lights blink faster under load; status lights go amber for a warning and flash red when critical. The colour tab beside each server (see **Colour racks by** below) flashes red with them.
- **Hot-aisle particles**: exhaust air, brighter and redder as it heats up. In the contained aisles it rises to the roof, drifts to the nearest chimney and leaves through it; rows A and H exhaust towards the end walls.
- **Cold-aisle particles**: supply air rising from the perforated floor tiles.
- **Packets**: network traffic climbing each rack's riser and running along the trays to the uplink panel, denser with more traffic.

## Inventory and monitoring modes

- **Inventory mode** is for a site with no telemetry. It hides everything driven by simulated numbers: the KPI strip, the "Simulated telemetry" chip, the needs-attention chip and list, the Live tab and its trends, the CPU, inlet and power colour modes, the thermal camera, the airflow and packet particles, the stress test and per-core figures in the server panel, and the simulated status lights (server and switch LEDs, busway tap-offs and the uplink panel are steady, and the pulled-out server's fans, heatsinks and lights stand still). The rack panel opens on its Inventory tab, without load or power columns. The server panel keeps every record field (server, location, processor, OS, memory, disks, network, NICs, OOB and the console link). The capacity finder looks for free U only.
- **Monitoring mode** is the page as it was: everything above is back, and the simulation (or the live feed) drives it.
- **Which mode you get**: the address wins (`?mode=inventory` or `?mode=monitoring`), then `"mode": "inventory"` or `"monitoring"` in the site file, then the file itself: a file that configures a `telemetry` feed is monitoring, any other (including the generated demo hall) is inventory. The header says which mode is on and has a link to switch it for that visit. In inventory mode the telemetry feed is not polled.
- `data/hall.example.json` has no `telemetry` entry, so it opens in inventory mode; add one (see [Live telemetry](#the-file-format)) or use `?mode=monitoring` to see the monitoring page with it.

## Getting around

- **Drag** to orbit, **scroll** to zoom.
- **Move** across the hall: <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> (or the arrow keys, outside rack view), **right-drag** or **shift-drag** with the mouse, or two fingers on a touch screen. The view slides along the floor and stays inside the hall; moving stops the camera rotation.
- **Reset view** (or <kbd>Esc</kbd> when no server is pulled out) flies back to the whole-hall overview with everything visible.
- **Find** (or press <kbd>/</kbd>): type anything you know about a server or rack. It looks in the hostname, rack ID, serial or service tag, IP addresses, MAC addresses (NIC and OOB; case and separators do not matter, so `00-0A-F7-01-02-03` finds `00:0a:f7:01:02:03`; give at least three bytes), OOB address, model, manufacturer, role, OS and in-service date, in every hall in the file. Several words must all match (`dell r760`). An exact hostname or rack ID, or a single match, goes straight there: a host pulls that server out, a rack opens rack view. When more than one thing matches, a list opens under the field with each match's host, rack, U, hall and the field that matched. Use <kbd>↓</kbd> <kbd>↑</kbd> and <kbd>Enter</kbd>, or click; <kbd>Esc</kbd> closes the list. A match in another hall switches to that hall.
- **Plan view** (header button, or **Back to 3D**): a flat top-down map of the hall with north up, the same as the layout grid, drawn from the rack tops. Rack IDs and row letters are printed on it, racks take the current colours (banded by their mix of servers in the Role, Make, Model and Age colours, and dimmed for the rack filter), vented and hot-aisle tiles are tinted. Click a rack, or focus it and press <kbd>Enter</kbd>, to open it in 3D rack view. The wheel and the **+** / **−** buttons along the bottom zoom, dragging pans, **Fit** shows the whole hall.
- **Rack IDs from afar**: every rack carries its ID above it, kept the same size on screen so it reads from the default overview; the IDs fade out as you come close or open a rack. Where racks stand closer together on screen than a label is wide, only some are labelled (the ends of each row first, then every eighth, fourth and second rack) and the rest appear as you zoom in, so labels never overlap. Each row's letter is painted on the floor at both ends.
- **Inventory table**: the header button, <kbd>I</kbd> or `#inventory` in the address; see [Inventory table](#inventory-table).
- **Click a rack** (front or back) for **rack view**: the camera flies to a spot 2.9 m in front of it so the whole 42U front fits on screen, the door swings open, and everything between you and the rack (the opposite row, containment glass) is cut away so you can see how the rack is filled. Click a server in it to pull it out. In rack view <kbd>←</kbd> / <kbd>→</kbd> walk along the row (in the direction you are facing) and the panel's ‹ › arrows step through every rack. You can slide along the row and keep the cut-away; zoom or orbit more than about 4.5 m away, or move off across the aisle, and it switches off by itself, so the rest of the hall comes back; **Reset view** leaves rack view altogether.
- Searching for a rack ID also opens rack view.
- **Links**: the address follows what you are looking at, so it can be copied and shared. `#rack=B03` opens rack view for B03 and `#host=db-e04-07` pulls that server out; Reset view clears it.

## Inspect a single server

Click a server in an open rack (or a cell in the rack panel's server strip, a row in the inventory, or search for it) and it slides out on its rails while the camera flies in. It is shown at true scale with the lid off, built for its record (its maker's face, 1U to 4U, one to four sockets, AMD or Intel, its DIMM count). From front to back: eight NVMe drives in their carriers and the backplane, with cables running down the left wall to the board; the fan wall (six 60 mm fans in 2U, eight 40 mm fans in 1U); the CPU sockets, each in its carrier frame (orange on AMD, dark on Intel) under a copper-based heatsink with heat pipes and a label naming the processor; the DIMMs either side of each socket; VRM chokes; PCIe risers with blue handles (Dell's touch points); the OCP NIC, BOSS-N1 boot module, CMOS battery and the two power supplies. A label behind the front grille, in the maker's colour, names the model, serial (Dell's service tag) and host. In monitoring mode the hardware animates from that server's own telemetry (in inventory mode it stands still):

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

In monitoring mode, below that it shows per-core load for every core (one block per socket), CPU temperatures, fan speed, memory, IOPS, network and power, plus a 2-minute CPU trend. **Run 20 s stress test** pins the cores at 100% so you can watch the temperatures and fans respond. Click the pulled-out server again, press **Back** or <kbd>Esc</kbd> to slide it back in like a drawer; the camera stays where it is. Flying to a rack or opening a server stops the camera rotation until you press **Start rotation**. The **▾** button in the rack and server panels' headers folds a panel down to its header (**▴** opens it again), so the hall behind it shows; the panel stays folded as you move between racks and servers.

## Panels and controls

Items marked (monitoring) are hidden in inventory mode.

- (monitoring) KPI strip: average CPU, network, IT load and the hottest inlet temperature.
- (monitoring) **Needs attention** (a chip under the title, red when anything is critical, amber for warnings, green **All OK** when nothing is): click it for every rack and server in this hall in warning or critical state, worst first and grouped by rack, each with why: CPU load, CPU temperature, inlet temperature, a failed part or a top-of-rack switch down. Click a rack to fly to it, or a server to pull it out. The list keeps itself up to date every second.
- **Find space for** a server (in Controls): in inventory mode pick its height (1U to 4U) and **Find**: racks with that many free U in one run (U1–38) light up blue, the one with the most free U in green, the rest go dark; the list gives each rack's lowest free slot and free U. In monitoring mode also give its peak power in watts. Pick its height (1U to 4U) and peak power in watts, then **Find**. A rack has room when it has that many free U in one run (U1–38) and its 12 kW budget still covers every server in it running flat out, both switches at full traffic and the new server. Racks with room light up blue, the one with the most power to spare in green, and the rest go dark; light columns show how much power is left. The list gives each rack's lowest free slot and spare kW; click one to fly there with the slot outlined. **Clear**, or picking a colour mode, puts the colours back.
- (monitoring) Rack detail, **Live** tab: CPU, memory, power and network are rolled up from the rack's 12 servers (power also includes the two switches), with a count of servers in warning or critical state, inlet/exhaust temperature and 2-minute trends. A rack also turns amber when any of its servers is critical. Click a rack or use the arrow buttons.
- Rack detail, **Inventory** tab: everything in the rack from U42 down (ToR switches, patch panel, OOB switch, free space, each server with model, drives, serial and in-service date, both PDUs), with live load and power per device and a rack total. **Hover a row** to outline that device in the rack; click a server row to pull it out.
- **Print elevation** (in the rack panel's Inventory tab): prints a clean page for the rack, U42 down to U1, with each device's host, model and serial in its U positions (a multi-U server spans its units), the three switches and patch panel in U39–42, and the rack ID, building and hall, and date. It uses the browser's print dialog (save as PDF there); everything else on the page is left out of the print.
- Controls: colour mode, the capacity finder, **Thermal camera**, **Start/Stop rotation** for the camera orbit and **Show/Hide airflow** for the air particles (both start off), and **Graphics** (see [Run it](#run-it)). The simulation runs at a steady 60% traffic demand with both cooling units healthy.
- **Colour by** (inventory mode): **Fill** (used U out of the 38 usable, as a scale, one colour per rack), **Role**, **Make**, **Model** and **Age** (years in service, as a scale, grey for no date). Racks usually hold a mix of models and roles, so for the last four the colour belongs to the server, not the rack:
  - **each server** carries its colour on a glowing tab over the left mounting rail beside its front, visible in rack view and through the door's perforations;
  - **the light column over each rack** is stacked into segments, one per model (or role, make, or year of age) in it, sized by the U each takes and always in the legend's order; its height is still the fill level;
  - **the cabinet** is tinted only when everything in it is the same (for Age it takes its oldest server); a mixed cabinet stays neutral;
  - **plan view** bands each rack the same way, from its front to its rear;
  - **the rack panel** marks each server's row with its colour (hover the row for what it stands for).

  The legend lists every role, make or model in the hall with its number of servers: the eight most common get a colour each, the rest share "Other", and "Not recorded" is grey.
- **Highlight racks holding** (Controls, both modes): type anything Find understands (`R760`, `database`, `2021`, a serial). Racks with a match keep their colour and their column shows how much of the rack matches (stacked by what the matching servers are, in the Role, Make, Model and Age colours); the rest go dark, and so do the colour tabs of servers that do not match. The count of servers and racks is shown, and in rack view the matching servers are bright (and their LEDs lit) while the others dim, and the rack panel's rows mark them. Starting the capacity finder clears the filter and the other way round. **Clear** (or <kbd>Esc</kbd> in the field) removes it.
- (monitoring) **Colour racks by** CPU load, inlet temperature or **power** (draw against each rack's 12 kW budget, which shows where there is capacity to add servers). A rack is a mix of servers, so each server also carries a glowing tab over the left mounting rail beside its front, coloured from its own figure: its CPU load, its power draw against its own flat-out figure, or, for inlet temperature (which is a rack figure), its CPU temperature. The tabs repaint a few times a second, flash red while the server is critical, go dark for servers the rack filter does not match, and drop out with the thermal camera and the capacity finder. The legend's note says what they show.
- **Thermal camera** switches the hall to a false-colour infrared view (the ironbow palette, 16–46 °C): every surface takes the colour of the air where it stands, so cold aisles, rack fronts at their inlet temperature, rears and hot aisles at their exhaust and the warm ceiling plenum all read at a glance, and each server's face shows its own inlet and exhaust. Glass, the perforated doors, labels and the light columns drop out so the racks behind them show.

## Inventory table

The header's **Inventory table** button (or <kbd>I</kbd>, or `#inventory` in the address) opens a table of every server across all halls: host, building, hall, rack, U, height, make, model, serial, IP, OOB address, role, OS and in-service date. Click a column heading to sort (again for descending, a third time for the physical order of building, hall, rack and U from the top down; blanks always last). The filter box narrows the rows as you type with the same matching as Find, and the count shows how many rows are shown. Click a row, or focus it and press <kbd>Enter</kbd>, to go to that server (switching hall if needed). Only the rows in view are drawn, so thousands of servers stay quick. **Export CSV** writes the rows currently shown, in the table's order, as `server-inventory.csv` (UTF-8 with a byte order mark so Excel reads it); the file loads back through [CSV import](#csv-import). Values a spreadsheet would run as formulas (starting with `=`, `+`, `-` or `@`) are written with a leading `'`, which the import takes off again.

## Your own data centre

The page reads `data/hall.json` at start-up, or a file you load into the browser. Out of the box `data/hall.json` lists no halls, so the demo hall is generated. `data/hall.example.json` is a worked example (two buildings, Dell, HPE and Supermicro servers from 1U to 4U, SAN volumes, and three deliberate mistakes so the problems list has something to show): load it with **Load file** to see it.

### Loading a file

- **Load file** in the header (or drop a `.json` or `.csv` file anywhere on the page) checks the file and keeps a copy in this browser, which is used instead of `data/hall.json` from then on, on every visit, until you press **Use server file**. The header says which file is on show. The copy lives only in this browser.
- To give everyone the same view, put the file on the server as `data/hall.json`.
- **The hall picker** lists every building and hall in the file with its rack and server counts; the page shows one hall at a time (`?hall=` in the address). **Find** knows every host and rack in the file and switches to the hall it is in.
- **Problems in the data** (a chip in the header when there are any) lists what could not be placed, and why: a server whose rack is not in any hall's grid, two servers in the same rack units, a hostname used twice, a U position outside U1–38 (U39–42 hold the switches), a grid token it does not understand, a rack with no room behind it. Everything else is still shown.

### CSV import

A `.csv` (or `.tsv`) file is a list of servers, one row per server, loaded the same way as a site file (**Load file**, drag and drop, and **Open file** in the layout editor). `data/servers.example.csv` is a worked example for `data/hall.example.json` (two deliberate mistakes at the end).

- **Columns**: the first row names them, matched without regard to case, spaces or punctuation. Only a hostname column is required; rack and U are needed to put a server in a rack. Unknown columns are ignored and listed.

| Field | Accepted column names |
| --- | --- |
| host | host, hostname, name, server |
| rack | rack, cab, cabinet |
| U | u, position, u position, rack position |
| height | height, size, ru, u height (`2` or `2U`) |
| building | building, site |
| room (hall) | room, hall |
| make | manufacturer, make, vendor |
| model | model |
| serial | serial, service tag, asset tag, sn |
| IP | ip, ip address (several separated by `;`, `,` or spaces) |
| OOB | oob, idrac, ilo, bmc, ipmi (the management address) |
| OOB MAC / NIC MACs | oob mac, idrac mac…; mac (several separated as for IPs) |
| role, OS | role, function, workload; os, operating system |
| in service | installed, in service, install date |
| CPU, memory | cpu, processor; memory, ram |

  A U cell may be `12`, `U12` or a range `12-13` (which also gives the height). Dates may be `2021-03-15`, `2021-03`, `2021` or `15/03/2021`.
- **Format**: the delimiter (comma, semicolon or tab) is taken from the header line. Quoted values may hold the delimiter, line breaks and doubled quotes; a byte order mark and CRLF or LF line ends are fine.
- **Into a site that already has halls**: the page asks whether to **Replace all servers** (the file's servers become exactly the list) or **Merge by hostname** (a listed hostname takes the list's values for the columns it has and keeps its other fields, such as disks, cabling and VLANs; new hostnames are added; servers not in the list stay). Halls, layout and settings are kept either way, and the choice shows how many rows fit in a rack. The result is kept in this browser like a loaded file.
- **Into a site with no halls**: the servers are saved and the layout editor opens with an empty hall for each building and room they name, to place their racks.
- **Problems**: rows are turned into server records and checked like any others, so the **Problems in the data** list reports what could not be used, with the CSV row (the header is row 1): a missing hostname, a hostname repeated on an earlier row, a U or height that is not a number, a rack that is in no hall, servers in the same units, a U outside U1–38. Ignored columns are listed there too. The import's own notes are kept in the file as `importNotes` until another import replaces them.

### The layout editor

**Layout editor** (`layout.html`, linked from the header) draws each hall's floor plan on a grid of 0.6 m floor tiles. It opens the file this browser is using (or `data/hall.json`), and:

- **Rack ↓ / Rack ↑** place racks whose fronts face south or north; drag along a row to place a run of them. New racks are named from the prefix and the next free number, except that racks the file's servers name but no grid has yet are placed first, under those names. Each rack shows how many servers the file puts in it.
- **Vented tile** paints the cold aisle in front of racks, **Hot aisle** the contained aisle between rack rears, **Floor / erase** clears tiles and removes racks.
- **Select** a rack to rename it (its servers move with it), turn it round or delete it. Halls can be added, renamed (their servers move with them), resized and deleted; **Undo** (or Ctrl+Z) steps back.
- **Open file** also takes a `.csv` server list (see [CSV import](#csv-import)): its servers replace or merge into the file's, and the halls stay.
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

**Settings.** `mode` (`"inventory"` or `"monitoring"`) sets the [mode](#inventory-and-monitoring-modes); `domain` builds the FQDNs; `oobUrl` is the console link (`{ip}` is the out-of-band address, `{host}` the hostname; the older `idracUrl` and `iloUrl` work too).

**Live telemetry.** `telemetry` (at the top of the file) points at a live feed (`url`, `intervalSeconds`) and makes the page open in monitoring mode. It is polled, and every server and rack it reports shows its real figures instead of simulated ones: `cpu` in %, `memGB`, `tempC` (hottest CPU), `powerW`, `netGbps`, and a rack's `inletC`. Values can be numbers or numeric strings; anything else is ignored and that figure stays simulated. `data/telemetry.example.json` shows the shape. Anything the feed stops reporting for three intervals falls back to the simulation; the header chip shows how many servers are live.

**Older files.** Files that only list `racks.<rack>.servers.U<n>` with flat fields (`host`, `serial`, `ip`, `idrac`, `mac`, …) still work: with no halls they fill in the demo hall's servers at those slots.

Warning and critical states follow ASHRAE A1 guidance: 27 °C recommended and 32 °C allowable inlet limits, plus 85% / 95% CPU thresholds.

## Run it

No build step, but the page uses ES modules, so it has to be served over HTTP (opening `index.html` straight from disk won't load the modules):

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

Everything the page needs is in the repository, so it also works on a network without internet access: three.js 0.169.0 and the add-ons it uses (OrbitControls, RoomEnvironment, EffectComposer, GTAOPass, UnrealBloomPass, OutputPass and their dependencies) are in `vendor/three` (MIT licence) and load through an import map, and the Barlow Condensed and IBM Plex Mono fonts are in `vendor/fonts` (SIL Open Font License).

**Graphics** in Controls picks how much the page draws; the page reloads to apply it, and this browser remembers the choice:

- **High** (the default on computers): everything, with ambient occlusion at half resolution.
- **Medium** (the default on phones and tablets, meaning narrow screens or touch-only pointers): no ambient occlusion, and smaller shadow maps.
- **Low**, for slow machines: Medium without shadows or the glow round LEDs and lights, drawn at one pixel per screen pixel on high-density displays.

`?quality=low`, `medium` or `high` in the address overrides the choice for that visit.

## Tests

The pure logic (CSV parsing and writing, header names, search matching, the inventory table's model, colour categories and mode choice) has no three.js or DOM in it and is tested with Node's built-in runner, no dependencies:

```sh
node --test
```

`package.json` only marks the folder as ES modules and names that script; the page does not use it.

## Code layout

| File | What it does |
| --- | --- |
| `index.html` | Markup for the HUD and the import map |
| `layout.html`, `js/editor.js`, `css/editor.css` | The layout editor |
| `css/style.css` | Viewer styles |
| `js/csv.js` | CSV parser and writer, header aliases, turning rows into server records and laying them into a site file (no DOM) |
| `js/search.js` | One matcher for Find, the table filter and the rack filter (no DOM) |
| `js/sheet.js` | The inventory table's columns, rows, filter, sort and export rows (no DOM) |
| `js/colorby.js` | Inventory colour modes: fill, age, category buckets and palettes (no DOM) |
| `js/mode.js` | Inventory or monitoring mode, put on `<html>` as `data-mode` |
| `js/rackcolor.js` | Rack colours by mode and the rack filter state |
| `js/finder.js` | Find box and its results list |
| `js/table.js` | Inventory table overlay (windowed rows, sort, filter, Export CSV) |
| `js/plan.js` | Plan view (SVG) |
| `js/print.js` | Print elevation |
| `js/labels.js` | Rack ID labels and floor row letters for the overview |
| `js/choose.js`, `css/dialog.css` | The in-page replace / merge choice dialog |
| `css/print.css` | Print stylesheet for the elevation |
| `test/*.test.js`, `package.json` | `node --test` tests |
| `data/servers.example.csv` | Worked example of a server list |
| `js/site.js` | The site file format: grid parsing, server normalisation and the model catalogue, validation, the hall's layout in metres, the demo hall |
| `js/data.js` | Loads the site file (the browser's copy or `data/hall.json`) and picks the hall to show |
| `js/store.js` | The browser's copy of a loaded site file (IndexedDB) |
| `js/sitebar.js` | Hall picker, data source, Load file and drag-and-drop, problems list |
| `js/attention.js` | The needs-attention chip and its list of racks and servers in warning or critical state |
| `js/capacity.js` | Capacity finder: racks with room and power for another server |
| `js/core.js` | Renderer, scene, camera, controls, fill lighting, graphics level, colour scales, hall geometry from the layout, canvas helpers |
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
