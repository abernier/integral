# Phone stand: Bluetooth protocol

How an app drives the [phone stand](README.md): one custom GATT service on its ESP32, over Bluetooth Low Energy (Web Bluetooth from a page, or any BLE stack). Why this path: [ADR 0001](../docs/adr/0001-phone-stand-web-bluetooth.md).

**Draft, protocol 1.** No firmware and no client implement it yet.

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

A client reads it on connection and refuses a `protocol` it does not know.

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

## Future work

The ESP32 firmware (this service, the servo's ramp, angle to pulse) and a client library (connect, command, state) are to be written.
