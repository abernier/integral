# The pan-tilt phone stand aims with two STS3215 bus servos

The [phone stand](../../phone-stand/README.md) is aimed by hand, on a lockable ball joint. Its [pan-tilt variant](../../phone-stand-pan-tilt/README.md) aims itself, so an app can point the screen at the user, and so a user can set an aim by hand and get it back: it replaces the ball with **two Feetech STS3215 serial bus servos**, pan and tilt, on one arm, and keeps the base stand's MG996R for the roll ([protocol 2](../../phone-stand/protocol.md#protocol-2-pan-and-tilt)).

## Why not a motorized ball

A ball moved about its centre by motors (a spherical motor, or a ball driven by friction wheels) would keep the base stand's silhouette. Spherical motors are research devices, not parts one can buy; a friction-driven ball slips, holds nothing with the power off, and knows its position only through an extra sensor. Two axes of rotation, each on its own motor, are what can be built: the arm shows them.

## The motor

- **Feetech STS3215 (chosen)**: 19.5 kg cm (1.9 N m) at 7.4 V, a 1:345 metal gearbox, a 12-bit magnetic encoder that reads the position with the torque on or off, position, speed, load, temperature and voltage over one daisy-chained three-wire bus, angle limits stored in the servo. About 15 euros, and the servo of open robot arms (SO-100, SO-101), so it is easy to get and documented by use. The encoder makes teaching possible: torque off, aim by hand, read back. The bus keeps the cable through the pan axis to three conductors for both servos.
- **MG996R (a second and third, as for the roll)**: cheap and already in the stand, but a hobby servo knows no position it can report, turns 180 degrees at most, jitters when it holds a load, and needs its own signal wire through each axis. Fine for a roll between two hard stops; not to aim and be taught.
- **Dynamixel (XL330, XL430)**: the same idea (bus, encoder, limits, telemetry) with better documentation and a finer protocol, at three to five times the price; the XL330 is weaker than the STS3215, the XL430 dearer. Nothing here needs what the price buys.
- **Worm gear and DC or stepper motor**: self-locking with the power off, which teaching does not want (the hand could not move the axis), and an encoder, a driver and end stops to add for each axis.
- **BLDC gimbal motors (as in DJI Osmo stands)**: smooth and silent, made to hold a phone; but each needs an encoder, a field-oriented controller and tuning, and they hold nothing with the power off. The right path for a product that tracks a face while it moves; too much for a stand that aims and stays.

## One arm, not a fork

The first model hung the drum in a fork: two arms leaning back from a bar, the tilt servo in the left one, a bearing in the right, the drum on a trunnion each side. It worked, but it read as heavy: 179 wide over a Ø 142 base, 203 high, 468 cm³ of printed fork. A handheld gimbal shows the other way: the motors are the joints and the design, the segments between them slim connectors, and the payload hangs from one side. The stand now does the same in its own language: the column over the pan servo and a housing round the tilt servo, both cylinders on their axes, 44 across; a bar and an upright between them, 32.

- **The tilt joint on the drum's side (chosen)**: the tilt axis stays where it was, 15 mm behind the centre of mass of what tilts, so gravity costs 0.07 N m and the drum nearly balances for teach mode. The arm adds 57 mm on one side: 145 wide over the base, 191 high (no bar under the drum's sides, so the axes come down 12 mm, the phone still 11 mm over the base), 193 cm³ of printed arm.
- **The tilt joint behind the drum**: the narrowest front view, 88 wide, but the axis lands 84 mm behind the centre of mass: 0.37 N m of gravity, five times more, a drum that falls when the torque is off, and a phone whose lower edge drops 18 mm further when it tilts forward, which raises the whole stand to keep it over the base.
- **A pancake housing holding the whole servo on the tilt axis (D 76)**: the STS3215 is a long box with its shaft near one end, so a cylinder round it all is nearly as large as the drum, a second drum beside the first. Letting its far end run down into the upright keeps the housing at 44.

A single side carries the drum as a cantilever, and a servo's output shaft is not made to carry a moment: the drum hangs from a printed trunnion in two 6704 thin section bearings, 10 mm apart in the housing (31 N and 26 N with a 3 N tap, against a 730 N rating), and the servo, outboard of them, turns it through two pins in a slot across the trunnion's end, a dog coupling that passes the torque and lets the shaft float. Printed PETG, at 1800 MPa and 10 MPa allowable (assumed), sees 0.5 MPa at worst and the phone's top moves 0.2 mm under its weight and a tap. The roll lead runs out of the drum through the trunnion's bore, on the axis.

## Consequences

- The tilt axis runs through the drum's side, 15 mm behind the centre of mass of what tilts, so the servo holds 0.07 N m against gravity at most (×6 margin with a tap on the screen), and the drum nearly balances with the torque off.
- The pan servo stands in the base, the arm turns on it, and the cable winds a loop inside the column: pan is limited to ±135 degrees (the servo's limits and the firmware's), not continuous; a slip ring would cost more than the travel it adds.
- Power comes from a USB-C PD charger at 9 V, stepped down to 7.4 V for the bus and 6 V for the MG996R.
- Keeping the MG996R for the roll keeps the base stand's drum, dial, stops and head unchanged. A third STS3215 on the same bus would give the roll an encoder and a single supply, at the cost of a new drum interior and dial mounting; it is the next step if the roll ever needs more than two positions.
