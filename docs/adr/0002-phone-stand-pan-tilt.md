# The pan-tilt phone stand aims with two STS3215 bus servos

The [phone stand](../../phone-stand/README.md) is aimed by hand, on a lockable ball joint. Its [pan-tilt variant](../../phone-stand-pan-tilt/README.md) aims itself, so an app can point the screen at the user, and so a user can set an aim by hand and get it back: it replaces the ball with **two Feetech STS3215 serial bus servos**, pan and tilt, in a fork, and keeps the base stand's MG996R for the roll ([protocol 2](../../phone-stand/protocol.md#protocol-2-pan-and-tilt)).

## Why not a motorized ball

A ball moved about its centre by motors (a spherical motor, or a ball driven by friction wheels) would keep the base stand's silhouette. Spherical motors are research devices, not parts one can buy; a friction-driven ball slips, holds nothing with the power off, and knows its position only through an extra sensor. Two axes of rotation, each on its own motor, are what can be built: the fork shows them.

## The motor

- **Feetech STS3215 (chosen)**: 19.5 kg cm (1.9 N m) at 7.4 V, a 1:345 metal gearbox, a 12-bit magnetic encoder that reads the position with the torque on or off, position, speed, load, temperature and voltage over one daisy-chained three-wire bus, angle limits stored in the servo. About 15 euros, and the servo of open robot arms (SO-100, SO-101), so it is easy to get and documented by use. The encoder makes teaching possible: torque off, aim by hand, read back. The bus keeps the cable through the pan axis to three conductors for both servos.
- **MG996R (a second and third, as for the roll)**: cheap and already in the stand, but a hobby servo knows no position it can report, turns 180 degrees at most, jitters when it holds a load, and needs its own signal wire through each axis. Fine for a roll between two hard stops; not to aim and be taught.
- **Dynamixel (XL330, XL430)**: the same idea (bus, encoder, limits, telemetry) with better documentation and a finer protocol, at three to five times the price; the XL330 is weaker than the STS3215, the XL430 dearer. Nothing here needs what the price buys.
- **Worm gear and DC or stepper motor**: self-locking with the power off, which teaching does not want (the hand could not move the axis), and an encoder, a driver and end stops to add for each axis.
- **BLDC gimbal motors (as in DJI Osmo stands)**: smooth and silent, made to hold a phone; but each needs an encoder, a field-oriented controller and tuning, and they hold nothing with the power off. The right path for a product that tracks a face while it moves; too much for a stand that aims and stays.

## Consequences

- The tilt axis runs through the drum's sides, 15 mm behind the centre of mass of what tilts, so the servo holds 0.07 N m against gravity at most (×6 margin with a tap on the screen), and the drum nearly balances with the torque off.
- The pan servo stands in the base, the fork turns on it, and the cable winds a loop inside the column: pan is limited to ±135 degrees (the servo's limits and the firmware's), not continuous; a slip ring would cost more than the travel it adds.
- Power comes from a USB-C PD charger at 9 V, stepped down to 7.4 V for the bus and 6 V for the MG996R.
- Keeping the MG996R for the roll keeps the base stand's drum, dial, stops and head unchanged. A third STS3215 on the same bus would give the roll an encoder and a single supply, at the cost of a new drum interior and dial mounting; it is the next step if the roll ever needs more than two positions.
