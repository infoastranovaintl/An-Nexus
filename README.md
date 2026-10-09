# Astra Nexus Command — Hydropower Field Dashboard

Web dashboard for the Astranova hydropower mesh network. Connects over Web Bluetooth to the
AN-Forest-Master base station and monitors field nodes (water level, signal quality, routing),
handles visitor messages / emergency alerts, and manages a fleet of ESP32-CAM CCTV nodes.

## Stack

- Vite 7 + React 19 + TypeScript (strict)
- Tailwind CSS 4, framer-motion, recharts
- Zustand with persisted state (mesh + camera positions)
- Vitest for unit tests
- ESLint + Prettier

## Getting started

```bash
npm install
npm run dev        # http://localhost:5174
```

## Scripts

| Command              | Description                   |
| -------------------- | ----------------------------- |
| `npm run dev`        | Start the Vite dev server     |
| `npm run build`      | Type-check + production build |
| `npm run preview`    | Preview the production build  |
| `npm run typecheck`  | `tsc --noEmit`                |
| `npm run lint`       | ESLint                        |
| `npm run format`     | Prettier (write)              |
| `npm run test`       | Vitest (single run)           |
| `npm run test:watch` | Vitest (watch mode)           |

## Hardware protocol

The base station (ESP32 + BLE) speaks a line-based protocol over a BLE notify characteristic.
Incoming lines are parsed in `src/lib/nexus/parser.ts`:

| Line                                                      | Meaning                             |
| --------------------------------------------------------- | ----------------------------------- |
| `HELLO:mac:rssi:paired:id:ssid`                           | Node discovery                      |
| `DATA:mac:id:...:payload=…`                               | Sensor reading (water level parsed) |
| `MSG:id:from:to:prio:text`                                | Visitor message                     |
| `MSG_ACK:id:node` / `MSG_SENT`                            | Outbound message confirmation       |
| `EMERGENCY:node:text:lat:lon`                             | Distress alert                      |
| `CONV_START/CONV_MSG/CONV_END`                            | Conversation history dump           |
| `PONG`, `OFFLINE`, `CMD_ACK`, `STATUS`, `LIST_*`, `NODE:` | Health / mesh state                 |

Outbound commands: `SENDMSG:<node>:<prio>:<text>`, `GETMSGS:<node>`, `SEARCH:<q>`,
`CMD:<mac>:<hex>`, `PING:<mac>`, `PAIR:<mac>:<power>`, `LIST`, `STATUS`.

## Project layout

```
src/
  components/        UI kit (primitives, modal/dialog, water level card, layout)
  lib/
    cctv/            ESP32-CAM tile engine (MJPEG pull, recording, audio)
    nexus/           BLE transport, protocol parser, sensor payload parsing, canvas renderer
    utils.ts         Formatting / RF helpers
  store/             Zustand stores (nexus mesh, cctv, positions)
  views/             dashboard, connections, messages, cctv, settings
```

## Notes

- Web Bluetooth and Web Serial require Chrome / Edge on desktop.
- Persisted state is written to `localStorage` (`an-nexus-mesh-v1`, `an-nexus-positions-v1`)
  and throttled so telemetry bursts coalesce into a single write.
- The legacy single-file prototypes live in `legacy/` (not versioned).
