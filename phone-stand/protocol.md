# Phone stand: Bluetooth protocol

How an app drives the [phone stand](README.md) and its [pan-tilt variant](../phone-stand-pan-tilt/README.md): one custom GATT service on its ESP32, over Bluetooth Low Energy (Web Bluetooth from a page, or any BLE stack). Why this path: [ADR 0001](../docs/adr/0001-phone-stand-web-bluetooth.md). This file is the one source of the protocol for both stands: protocol 1 below (the roll, portrait and landscape), [protocol 2](#protocol-2-pan-and-tilt) on top of it (pan, tilt, teach), for the variant.

**Draft, protocols 1 and 2.** No firmware and no client implement them yet.

## Angles

- 0 degrees: portrait, upright.
- 90 degrees: landscape, after a counter-clockwise quarter turn as seen by the user.
- Integer degrees, 0 to 90. The mechanical stops sit 5 degrees beyond each end.
- On the stand, the orange index on the dial points at the notch at the top of the drum's rim at 0, and at the one on the user's left at 90.

## Device

- Advertised name: `phone-stand`.
- Service: `754edee7-0cf2-4100-8b14-29e9a088ae99`, advertised, so a client can filter on it.

| Characteristic | UUID | Properties |
|---|---|---|
| `command` | `cf280d30-1918-46de-8bde-a7c52548226e` | write, write without response |
| `state` | `6e81cdd8-f23b-4f91-8b8b-bcfefa320865` | read, notify |
| `info` | `754edee7-0cf2-4100-8b14-29e9a088ae9a` | read |

## `command`

One opcode byte, then its argument:

| Bytes | Command |
|---|---|
| `00` | Portrait: go to 0 |
| `01` | Landscape: go to 90 |
| `02 aa` | Angle: go to `aa`, a uint8, 0 to 90 |
| `03` | Stop: hold where it is |

- A write of the wrong length, an unknown opcode or an angle over 90 is ignored.
- A new command replaces the current one, even mid-move.
- The firmware ramps the move itself (acceleration and speed): the client sends targets, not steps.

## `state`

Four bytes:

| Byte | Field | Values |
|---|---|---|
| 0 | orientation | `0` portrait (at 0), `1` landscape (at 90), `2` other |
| 1 | angle | current angle, 0 to 90 |
| 2 | target | the angle it is going to |
| 3 | flags | bit 0: moving; other bits 0, reserved |

Notified on every change, and every 2 s while moving.

## `info`

UTF-8 JSON:

```json
{ "protocol": 1, "firmware": "0.1.0", "min": 0, "max": 90 }
```

A client reads it on connection. It refuses a device whose `min_protocol` (`protocol` when absent) is above the newest protocol it knows; a device whose `protocol` is newer still speaks every protocol down to its `min_protocol`, and the client uses the one it knows. A protocol 1 client of a protocol 2 stand drives the roll as before.

## Example

From a page, in Chrome on Android or desktop:

```ts
const SERVICE = '754edee7-0cf2-4100-8b14-29e9a088ae99'
const COMMAND = 'cf280d30-1918-46de-8bde-a7c52548226e'
const STATE = '6e81cdd8-f23b-4f91-8b8b-bcfefa320865'

const device = await navigator.bluetooth.requestDevice({ filters: [{ name: 'phone-stand', services: [SERVICE] }] })
const service = await device.gatt!.connect().then((server) => server.getPrimaryService(SERVICE))
const command = await service.getCharacteristic(COMMAND)
await command.writeValueWithoutResponse(new Uint8Array([0x01])) // landscape

const state = await service.getCharacteristic(STATE)
state.addEventListener('characteristicvaluechanged', () => {
  const [orientation, angle, target, flags] = new Uint8Array(state.value!.buffer)
  console.log({ orientation, angle, target, moving: (flags & 1) === 1 })
})
await state.startNotifications()
```

## Protocol 2: pan and tilt

The [pan-tilt stand](../phone-stand-pan-tilt/README.md) adds two Feetech STS3215 serial bus servos, pan and tilt, to the roll of protocol 1. Protocol 2 is protocol 1 plus what follows: the same device name, service and characteristics, the same opcodes 0 to 3, the same first four bytes of `state`. A protocol 1 client drives the roll of a pan-tilt stand unchanged; a protocol 2 client of a protocol 1 stand sees `"protocol": 1` and drives the roll alone.

### Angles

- Pan and tilt are signed integers in tenths of a degree, int16, little-endian.
- Pan: 0 faces the base's front; positive turns the stand counter-clockwise seen from above. Tilt: 0 holds the screen upright; positive leans it back (the screen faces up).
- Each axis has hardware limits (in `info`: pan -1350 to 1350, tilt -150 to 300 on the stand as designed), also written into the servos' own angle limit registers, and software limits inside them (`limits`, stored on the device). A pan or tilt target outside the software limits is clamped to them; `state` shows the clamped target.
- The roll keeps protocol 1's whole degrees, 0 to 90.

### `command`, protocol 2

| Bytes | Command |
|---|---|
| `10 pp pp` | Pan: go to `pp pp` (int16) |
| `11 tt tt` | Tilt: go to `tt tt` (int16) |
| `12 pp pp tt tt` | Aim: pan and tilt together, both arriving at once |
| `13 ax ss ss` | Speed: axis `ax` (`0` roll, `1` pan, `2` tilt) moves at most `ss ss` (uint16) tenths of a degree per second; `0` is the device's default |
| `14 mm on` | Torque: the axes in the mask `mm` (bit 0 roll, bit 1 pan, bit 2 tilt) on (`1`) or off (`0`); off, an axis is free to turn by hand, and the roll servo's pulses stop |
| `15` | Home: pan 0, tilt 0, roll 0 (portrait), torque on |
| `16 ax lo lo hi hi` | Limits: the software limits of axis `ax` (`1` pan, `2` tilt) to `lo lo` and `hi hi` (int16), inside the hardware ones; stored |
| `20 md` | Teach: pan and tilt follow the hand. `md` `0`: torque off; `1`: soft, a low torque limit that lets a hand move the axis but holds it where it is left (for a drum that droops with torque off) |
| `21 sl` | Store: the current pan, tilt (read from the servos' encoders) and roll as preset `sl`, 0 to 7; stored |
| `22 sl` | Recall: go to preset `sl` (torque on) |
| `23` | Teach end: torque on, hold where it is |
| `24 sl` | Delete preset `sl` |

- `03` (stop) stops every axis where it is.
- A write of the wrong length, an unknown opcode, an unknown axis or preset slot, or a recall of an empty slot is ignored.
- Any move command (`00` to `02`, `10` to `12`, `15`, `22`) ends teach mode first.

### `state`, protocol 2

Twenty bytes: protocol 1's four, then:

| Byte | Field | Values |
|---|---|---|
| 4-5 | pan | current pan, int16 |
| 6-7 | tilt | current tilt, int16 |
| 8-9 | pan target | int16 |
| 10-11 | tilt target | int16 |
| 12-13 | pan load | int16, thousandths of the servo's maximum torque, signed by direction (the STS3215's load register) |
| 14-15 | tilt load | int16, as pan load |
| 16 | pan temperature | uint8, degrees Celsius |
| 17 | tilt temperature | uint8, degrees Celsius |
| 18 | flags 2 | bit 0: pan moving; bit 1: tilt moving; bit 2: pan torque on; bit 3: tilt torque on; bit 4: teach mode; bit 5: a servo reports an error (overload, overheat, voltage); bit 6: supply too low, torque held off; bit 7: 0, reserved |
| 19 | supply | uint8, the bus voltage in tenths of a volt |

- Twenty bytes fit the default ATT MTU (23) in one notification.
- A protocol 1 client reads the first four bytes and ignores the rest.
- Notified on every change, every 2 s while moving, and at 10 Hz at most in teach mode (the encoders as the hand moves the stand).

### `presets`

| Characteristic | UUID | Properties |
|---|---|---|
| `presets` | `754edee7-0cf2-4100-8b14-29e9a088ae9b` | read, notify |

UTF-8 JSON, the stored presets, notified when one is stored or deleted:

```json
[{ "slot": 0, "pan": -300, "tilt": 120, "roll": 0 }, { "slot": 3, "pan": 450, "tilt": 0, "roll": 90 }]
```

### `info`, protocol 2

```json
{
  "protocol": 2,
  "min_protocol": 1,
  "firmware": "0.2.0",
  "min": 0,
  "max": 90,
  "capabilities": ["roll", "pan", "tilt", "speed", "torque", "home", "limits", "teach", "presets"],
  "pan": { "min": -1350, "max": 1350 },
  "tilt": { "min": -150, "max": 300 },
  "presets": 8
}
```

`min` and `max` stay the roll's, as in protocol 1; `pan` and `tilt` are the hardware limits. A client checks `capabilities` before it offers a command.

### Teaching

1. Send `20 01` (soft) or `20 00` (torque off), and show the live pan and tilt from `state`.
2. The user aims the phone by hand; the roll still turns by command.
3. Send `21 sl` to store the aim as preset `sl`, as often as needed; then `23`.
4. Later, `22 sl` goes back to it.

### Example, protocol 2

```ts
const aim = new DataView(new ArrayBuffer(5))
aim.setUint8(0, 0x12)
aim.setInt16(1, -300, true) // pan -30.0 degrees
aim.setInt16(3, 120, true) // tilt +12.0 degrees, leaning back
await command.writeValueWithoutResponse(aim)

state.addEventListener('characteristicvaluechanged', () => {
  const view = state.value!
  if (view.byteLength < 20) return // a protocol 1 stand
  console.log({ pan: view.getInt16(4, true) / 10, tilt: view.getInt16(6, true) / 10 })
})
```

### On the device

The ESP32 talks to the servos over their half-duplex bus at 1 Mbit/s (the pan servo is ID 1, the tilt ID 2): goal position, speed and acceleration out, present position, load, temperature and voltage in. An STS3215 position is 0 to 4095 over a turn: tenths of a degree = (position - 2048) × 3600 / 4096, each servo's 2048 set at its axis's 0 during assembly.

## Future work

The ESP32 firmware (this service, the servo's ramp, angle to pulse, and for protocol 2 the bus servos, the limits, the presets) and a client library (connect, command, state) are to be written.
