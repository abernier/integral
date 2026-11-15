# The phone stand is driven over Web Bluetooth

A media app that alternates portrait and landscape media (a video feed) fills the screen with each one only if the phone itself turns. The [phone stand](../../phone-stand/README.md) turns it, and the app drives it from a web page over **Web Bluetooth**, talking to an **ESP32** that runs a custom GATT service ([protocol](../../phone-stand/protocol.md)). Any app can be a client; covrflow, a PWA, is the first one meant to.

## Nothing off the shelf does it

- **No web standard** rotates a device by its content.
- **Samsung The Sero** turned its screen to match the content; it is discontinued.
- **Apple DockKit** stands track subjects; a roll command is not honoured.
- **DJI Osmo Mobile 2 to 4** can be driven from a page over Web Bluetooth ([alkersan/om-research](https://github.com/alkersan/om-research)), but a gimbal is a costly, indirect fit, and later models are not covered.

## The chosen path

- The page, in **Chrome on Android**, connects with Web Bluetooth: no native app, no server.
- The ESP32 exposes one custom GATT service, in the style of Improv Wi-Fi: a **write** characteristic for the command (a target angle), a **notify** characteristic for the state (angle, target, moving), a **read** one for the protocol's version.
- The app derives the target orientation from the aspect of the current and next media. It may turn the phone ahead, during a transition, and group media by orientation to turn less often.

## Alternatives considered

- **A native app (Capacitor)**: native BLE everywhere, but a second app to build and ship for each client.
- **An Android system-wide service** (`DisplayListener`, the page calling `screen.orientation.lock`): works for any app, but needs a native companion.
- **An iOS ReplayKit broadcast extension**: watches the screen to infer the orientation; heavy, and a native app anyway.
- **A cloud relay (WSS or MQTT)** for iOS: the stand on Wi-Fi, the page talking to a relay; adds a server and latency.

iOS Safari has no web hardware API (no Web Bluetooth, no Web Serial, no WebUSB), so iOS stays out until one of the native or relay paths is worth it.

## Future work

The ESP32 firmware and a client library (connect, command, state) do not exist yet; the stand is modelled, not printed.
