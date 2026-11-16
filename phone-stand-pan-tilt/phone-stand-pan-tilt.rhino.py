"""
Motorized pan-tilt phone stand - parametric Rhino model, a variant of ../phone-stand/.

Run inside Rhino 8/9 (CPython 3, RhinoCommon):

    RunPythonScript <this folder>/phone-stand-pan-tilt.rhino.py

Re-runnable: it wipes the objects on its own layers (all prefixed PT_) and
rebuilds everything. With EXPORT on, it writes, next to this file:

  phone-stand-pan-tilt.rhino.step  the eleven printed parts as named solids
                          (Base, Lid, Column, Arm, Cover, Plug, Drum, Trunnion,
                          Plate, Index, Head), the part's master geometry, in git;
                          turned half a turn about Z so the phone faces -Y, the
                          repository's front
  stl/<part>.stl          print-ready meshes in print orientation, out of git

With POSE_DIR set (a folder outside the repository), it also writes posed
meshes for the renders: one folder per pose, one STL per part and reference.

Shared geometry. The ball-joint stand's script (../phone-stand/phone-stand.rhino.py)
is the one source of the drum, the roll servo, the dial plate, its stops, the
index, the Quad Lock head, the base and the lid: this script runs it as a
library (PHONE_STAND_LIBRARY), with the few parameters the variant changes
(PHONE_STAND_OVERRIDES: the base's height and centre, the axis height, the
ballast cavity...), and calls its builders. Nothing is copied: a change to the
dial, the head or the drum's servo pocket reaches both stands. A separate
parameter module would have meant moving every parameter and builder out of a
script that must still run on its own in Rhino; importing it keeps that script
unchanged but for three lines.

Frame: the base script's. mm, Z up, desk at Z=0, phone faces +Y (user at +Y).
The roll and tilt axes meet in one point, (0, TILT_Y, AXIS_Z): roll along Y
(the servo in the drum, as in the base stand), tilt along X; the pan axis is
vertical, PAN_BACK behind it.

Design: the Braun language of the base stand (Rams, Lubs): circles and
cylinders, one body colour, one orange accent on the dial's index, shadow gaps
where parts meet, no fastener visible from the front or the sides. One arm, on
one side, as on a handheld gimbal: the joints are the design (the column over
the pan servo, the housing round the tilt servo, both cylinders coaxial with
their axes, both 44 across, half the drum), and the segments between them are
slim connectors (the bar and the upright, 32 across). The drum hangs from a
single trunnion in the housing, carried by two bearings, so the tilt servo
only turns it: its output carries the torque, never the overhung weight.

Parts (layers):
  PT_BASE      printed - low disc, the pan servo hangs under its top skin; bay
               for the ESP32, the power board and the USB-C PD trigger; ballast
               cavity, tripod nut (the base stand's builder, reshaped)
  PT_LID       printed - ballast lid (the base stand's builder)
  PT_COLUMN    printed - turns on the pan servo's horn; the cable's arc slot in
               its floor, a cradle in its top for the bar
  PT_ARM       printed - the L: the bar from the column, the upright, the tilt
               housing (two 6704 bearings, the tilt servo's pocket); the plug
               over the bar's one screw
  PT_COVER     printed - the arm's outer face, behind a shadow gap
  PT_DRUM      printed - the base stand's drum without the ball's belly; a
               socket in its side for the trunnion
  PT_TRUNNION  printed - the tube the drum hangs from, in the two bearings;
               the tilt horn's dogs drive its end; the roll lead in its bore
  PT_PLATE, PT_INDEX, PT_HEAD   the base stand's dial, index and head, unchanged
  PT_SERVO_REF reference - MG996R (roll), 2 x STS3215 (pan, tilt), bearings
  PT_PHONE     reference - phone envelope

Print orientations (no supports; the script checks every downward face):
  base upside down, lid flat, column upright, arm on its outer face (the bar
  up), cover on its outer face, drum on its back, trunnion upright on its
  horn end, plug upright, plate dial face down, index on its side, head lug
  face down (vendor, not checked).
"""

import math
import os
import types

import Rhino
from Rhino.Geometry import (
    Point3d, Vector3d, Plane, Circle, Cylinder, Brep, Transform, Polyline,
    PolylineCurve, Surface, Mesh, MeshingParameters, VolumeMassProperties, BoundingBox,
)

try:
    doc = __rhino_doc__  # injected by the Rhino MCP script runner
except NameError:
    doc = Rhino.RhinoDoc.ActiveDoc

HERE = os.path.dirname(os.path.abspath(__file__))
BASE_SCRIPT = os.path.join(HERE, "..", "phone-stand", "phone-stand.rhino.py")

# --------------------------------------------------------------------------
# Parameters
# --------------------------------------------------------------------------
P = dict(
    OUT_DIR=HERE,
    EXPORT=True,
    POSE_DIR="",              # set to a folder (outside the repository) to write the posed meshes for the renders

    # the roll and tilt axes meet at X=0, Y=TILT_Y, Z=AXIS_Z. TILT_Y as close to the centre of mass of what tilts as
    # the drum allows: the trunnion's socket must stay in the drum's side wall, behind its front face (checked)
    TILT_Y=54.0,
    # the pan axis (the column, the base's centre) sits PAN_BACK behind the tilt axis: tilted forward, the phone's
    # lower edge swings back under the drum, where a bar under the tilt axis would be; the upright leans back to it
    PAN_BACK=24.0,

    # the arm: joints 44 across (the column, the tilt housing), connectors 32 (the bar, the upright)
    ARM_GAP=0.75,             # the drum's widest point to the housing's face: a shadow gap
    HOUSING_R=22.0,           # the tilt housing, a cylinder on the tilt axis
    ARM_R=16.0,               # the upright's half depth: its ends are half circles of this radius
    BAR_R=16.0,               # the bar from the column to the upright, a cylinder along X
    BAR_DROP=80.0,            # tilt axis to the bar's axis: the drum's back edge clears the bar at the back tilt
    BAR_BORE=14.0,            # the bar's bore: the cables, the cover screws' driver
    BAR_BORE_X=(-12.0, 85.0), # the bore's ends: closed at the column's far side, into the upright
    UPRIGHT_WALL=4.0,         # the upright's inner wall, to the tilt servo's case
    COVER_T=8.0,
    COVER_WALL=2.0,           # the cover's wall over the servo's case end
    COLUMN_SHOW=10.0,         # the column seen between the base's top and the bar
    COLUMN_BORE=38.0,         # the column's bore: the cable's loop, the bar's screw
    COLUMN_FLOOR=6.0,
    # one M4 down the pan axis, from the bar's top (hidden under the drum) into an insert in the column's floor
    BAR_SCREW_CB=8.5, BAR_SCREW_CB_DEPTH=7.0, M4_INSERT=5.6, M4_INSERT_DEPTH=4.5,
    PLUG_T=3.0,               # a printed plug over the screw's head, flush with the bar: no fastener shows
    PAN_SKIN=2.0,             # the base's top skin over the pan servo
    COVER_SCREW_DY=7.0,       # 2 x M3, from inside the bar's bore, into inserts in the cover
    BAR_CABLE_X=9.0,          # the cable's hole from the column's bore up into the bar's, beside the screw
    BAR_CABLE_D=9.0,

    # the single trunnion: a printed tube in two bearings, its inner end in a socket in the drum's side
    TRUN_D=20.0, TRUN_BORE=11.0,   # the bore: the roll servo's lead, its JR plug first (8.5 across)
    TRUN_RING_D=23.0,         # the ring between the journals spaces the bearings' inner races
    TRUN_FIT=0.05,            # on the radius, in the drum's socket
    SOCKET_X0=41.0,           # the socket's floor in the drum's side wall (the bore is R 40, the drum R 44)
    TRUN_SCREW_R=7.75,        # 3 x M3 from inside the drum's bore into inserts in the trunnion's end
    TRUN_SCREW_ANGLES=(120.0, 180.0, 240.0),   # about the tilt axis, from +Y toward +Z: all behind the dial's tabs
    PAD=(36.5, 38.0, 54.5, 11.0),  # the boss inside the bore under the screws' heads: X0, Y0, Y1, half height
    LIP_T=1.0, LIP_D=21.5,    # the housing's lip, the inner bearing's outer race against it
    # 6704-2RS thin section bearing, 20 x 27 x 4, two of them, BRG_SPAN apart (centre to centre)
    BRG_OD=27.0, BRG_ID=20.0, BRG_W=4.0, BRG_G=5.0,
    BRG_C0=730.0,             # N, static radial rating (unverified: catalogue value of a generic 6704)
    BRG_SEAT=0.05,            # on the radius, the seat over the bearing (bonded)
    RING_L=6.0,               # the ring's length: the bearings' spacing is RING_L + BRG_W
    CHAMBER_R=13.75,          # the coupling's chamber, from the outer bearing to the cover: the bearings go in this way
    # the coupling: two pins in the horn (M3 shoulders, unverified) in a slot across the trunnion's end; a groove
    # beside them lets the roll lead out of the bore. Torque passes, the overhung moment does not
    DOG_W=3.2, DOG_DEPTH=3.0, PIN_D=3.0, PIN_L=2.5,
    LEAD_GROOVE=(4.0, 2.5),   # width, depth
    LEAD_CHANNEL_D=4.5,       # the roll lead from the chamber down the upright to the bar's bore
    BUS_CHANNEL_D=8.0,        # the bus cable from the bar's bore up to the tilt servo

    # Feetech STS3215 serial bus servo (7.4 V, 1:345, 12-bit magnetic encoder): case L along the shaft's
    # end-to-end line, W across, H along the shaft (case and output boss); horn: the servo's round metal horn
    STS_L=45.2, STS_W=24.7, STS_H=35.0,
    STS_SHAFT_FROM_END=11.5,  # unverified: the shaft's distance from the case's near end
    STS_HORN_D=22.0, STS_HORN_T=3.0, STS_BOSS=1.0,   # unverified
    STS_HORN_HOLE_R=7.0, STS_HORN_HOLES=4,           # unverified: 4 x M3 on a 14 mm circle
    STS_G=55.0,
    STS_STALL=1.9,            # N m at 7.4 V (19.5 kg cm)
    STS_SCREW_D=2.2,          # the pan servo's 4 x M2 from above, into its case's top face (unverified pattern)
    STS_SCREWS=((7.0, 9.0), (7.0, -9.0), (-17.0, 9.0), (-17.0, -9.0)),

    # ranges
    TILT_SPEC=(-15.0, 30.0),  # + leans the screen back
    TILT_EXTRA=5.0,           # the arm must stay clear this far beyond the range (the servo's limits are software)
    PAN_SPEC=90.0,            # at least +-90
    PAN_LIMIT=135.0,          # software and servo angle limits: the cable's loop allows this much
    # the cable through the pan axis: 5 conductors (bus V+, GND, data; roll servo 6 V, PWM), in a loop
    CABLE_ENV_D=5.0,
    CABLE_HOLE_R=16.0,        # the base's cable hole, behind the pan axis, at this radius
    SLOT_R=(13.0, 19.0),      # the column floor's arc slot the cable rises through (its outer radius the bore's)

    # electronics (clearance boxes, in the bay): ESP32 DevKit (the base stand's box), a power board (2 x Mini560
    # bucks, 7.4 V and 6.0 V, and the 74HC126 half-duplex buffer on perfboard), a USB-C PD trigger (9 V)
    # (Y relative to the pan axis)
    POWER_BOX=(-25.0, 25.0, -62.0, -45.0, 0.5, 12.5),
    PD_BOX=(-13.0, 13.0, -66.0, -55.0, 15.0, 21.0),
    ELECTRONICS_G=45.0,

    MG996R_STALL=0.94,        # N m at 6 V (9.4 kg cm), the roll servo
    TAP_N=3.0,                # a firm tap on the screen, at the phone's farthest edge
    TORQUE_FACTOR=3.0,        # stall over the worst load, at least
    TIP_MARGIN_MIN=10.0,      # CoM to the base rim, at worst
    TAP_TIP_MIN=1.0,          # a tap at the phone's top must not tip the stand over its rim
    CLEAR_MARGIN=8.0,         # the phone above the base's top, everywhere
    BRIDGE_MAX=26.0,          # a downward face is printable as a bridge up to this width
    PART_MAX=220.0,
    BEARING_LOAD_MAX=40.0,    # N, axial on the pan servo's output, at most (unverified rating)

    # the cantilever: printed PETG, assumptions (not measured)
    PETG_E=1800.0,            # MPa, printed (2.0 to 2.1 GPa moulded)
    PETG_G=640.0,             # MPa, E / (2 (1 + 0.4))
    PETG_ALLOW=10.0,          # MPa: about 50 tensile, halved across layers, over 2.5 for creep and fatigue
    DEFLECT_MAX=0.5,          # mm, at the phone's top, gravity and a tap together
    BRG_FACTOR=5.0,           # the bearings' static rating over their worst load, at least
)

# What the variant changes in the base stand's parameters. The base: 40 high (the pan servo stands in it), centred on
# the pan axis; the column turns over it; the bay and the ballast cavity make room for the servo.
COLUMN_SHOW, BAR_R, BAR_DROP = P["COLUMN_SHOW"], P["BAR_R"], P["BAR_DROP"]
PAN_Y = P["TILT_Y"] - P["PAN_BACK"]
BASE_OVERRIDES = dict(
    BASE_H=40.0, BASE_CY=PAN_Y, PIVOT_Y=PAN_Y,
    AXIS_ABOVE_BASE=COLUMN_SHOW + BAR_R + 0.75 + BAR_DROP,   # 0.75: the shadow gap in the column's cradle
    COLUMN_RECESS=0.0, COLUMN_INSERT_ANGLES=(),               # the column floats over the base, a shadow gap under it
    BAY_Y_MAX=PAN_Y - 14.5, ESP32_Y0=PAN_Y - 44.0, PWR_ZC=18.0,
    BALLAST_CY=PAN_Y + 44.0, BALLAST_R=17.0, LID_R=24.5, LID_SCREW_R=20.5, BALLAST_G=100.0,
)


def load_base(overrides):
    """The base stand's script, run as a library with the variant's overrides: its parameters, builders and helpers."""
    mod = types.ModuleType("phone_stand")
    mod.__dict__.update({"__file__": os.path.abspath(BASE_SCRIPT), "__rhino_doc__": doc,
                         "PHONE_STAND_LIBRARY": True, "PHONE_STAND_OVERRIDES": overrides})
    with open(BASE_SCRIPT) as f:
        exec(compile(f.read(), BASE_SCRIPT, "exec"), mod.__dict__)
    return mod


B = load_base(BASE_OVERRIDES)
BP = B.P
TOL = doc.ModelAbsoluteTolerance

# --------------------------------------------------------------------------
# Derived values
# --------------------------------------------------------------------------
TY = P["TILT_Y"]
AXIS_Z = B.AXIS_Z
BASE_TOP = B.BASE_TOP
DRUM_R = B.DRUM_R
GAP = BP["SHADOW_GAP"]
CLR = BP["CLR"]
CENTER = Point3d(0, TY, AXIS_Z)
PAN_C = Point3d(0, PAN_Y, AXIS_Z)
Z_BAR = AXIS_Z - BAR_DROP
LEAN = math.atan2(P["PAN_BACK"], BAR_DROP)          # the upright leans back by this, from the tilt axis to the bar
COLUMN_R = BP["COLUMN_D"] / 2.0
COLUMN_Z0 = BASE_TOP + GAP                          # the column floats over the base
# the X stack on the tilt axis, from the drum outward: shadow gap, lip, bearing, ring, bearing, coupling, servo, cover
ARM_IN = DRUM_R + P["ARM_GAP"]                      # the housing's face
BRG_A = (ARM_IN + P["LIP_T"], ARM_IN + P["LIP_T"] + P["BRG_W"])
BRG_B = (BRG_A[1] + P["RING_L"], BRG_A[1] + P["RING_L"] + P["BRG_W"])
TRUN_X1 = BRG_B[1] + 0.25                           # the trunnion's end, its dogs' slot
HORN_X0 = TRUN_X1 + 0.25
STS_X0 = HORN_X0 + P["STS_HORN_T"] + P["STS_BOSS"]  # the case's shaft face
STS_X1 = STS_X0 + P["STS_H"]
ARM_OUT = STS_X1 + P["COVER_WALL"]
SEAM_X = ARM_OUT - P["COVER_T"]
ARM_X1 = SEAM_X - GAP / 2.0
COVER_X0 = SEAM_X + GAP / 2.0
UP_X0 = STS_X0 - CLR - P["UPRIGHT_WALL"]            # the upright's inner face
STS_Z1 = AXIS_Z + P["STS_SHAFT_FROM_END"]
STS_Z0 = STS_Z1 - P["STS_L"]
# pan servo: case under the base's top skin, shaft up on the pan axis, its length toward -X
PAN_CASE_Z1 = BASE_TOP - P["PAN_SKIN"]
PAN_CASE_Z0 = PAN_CASE_Z1 - P["STS_H"]
PAN_HORN_Z1 = PAN_CASE_Z1 + P["STS_BOSS"] + P["STS_HORN_T"]


# --------------------------------------------------------------------------
# Geometry helpers (the base script's, plus X-axis ones)
# --------------------------------------------------------------------------
box, cyl_y, cyl_z, union, diff, inter, intersects, solid = B.box, B.cyl_y, B.cyl_z, B.union, B.diff, B.inter, B.intersects, B.solid


def cyl_x(cy, cz, r, x0, x1):
    pl = Plane(Point3d(x0, cy, cz), Vector3d(1, 0, 0))
    return Cylinder(Circle(pl, r), x1 - x0).ToBrep(True, True)


def prism_x(pts_yz, x0, x1):
    """A prism along X from a closed polygon in the YZ plane."""
    pts = [Point3d(x0, y, z) for (y, z) in pts_yz] + [Point3d(x0, pts_yz[0][0], pts_yz[0][1])]
    srf = Surface.CreateExtrusion(PolylineCurve(pts), Vector3d(x1 - x0, 0, 0))
    return solid(srf.ToBrep().CapPlanarHoles(TOL))


def prism_z(pts_xy, z0, z1):
    pts = [Point3d(x, y, z0) for (x, y) in pts_xy] + [Point3d(pts_xy[0][0], pts_xy[0][1], z0)]
    srf = Surface.CreateExtrusion(PolylineCurve(pts), Vector3d(0, 0, z1 - z0))
    return solid(srf.ToBrep().CapPlanarHoles(TOL))


def moved(geom, xf):
    if isinstance(geom, Point3d):
        return xf * geom
    g = geom.DuplicateBrep()
    g.Transform(xf)
    return g


def stadium_x(x0, x1):
    """The upright's outline (YZ): half circles of ARM_R about the tilt axis and the bar's axis, joined; along X."""
    r = P["ARM_R"]
    ny, nz = math.cos(LEAN), -math.sin(LEAN)        # normal to the upright's centre line (toward the front)
    quad = [(TY + r * ny, AXIS_Z + r * nz), (PAN_Y + r * ny, Z_BAR + r * nz),
            (PAN_Y - r * ny, Z_BAR - r * nz), (TY - r * ny, AXIS_Z - r * nz)]
    return union([cyl_x(TY, AXIS_Z, r, x0, x1), cyl_x(PAN_Y, Z_BAR, r, x0, x1), prism_x(quad, x0, x1)], "upright")


def arm_outline(x0, x1, upright_x0):
    """The arm's silhouette along X: the housing on the tilt axis from x0, the upright from upright_x0."""
    return union([cyl_x(TY, AXIS_Z, P["HOUSING_R"], x0, x1), stadium_x(upright_x0, x1)], "arm outline")


def lean_xf():
    """The tilt servo's case leans with the upright: turned about the tilt axis."""
    return Transform.Rotation(-LEAN, Vector3d(1, 0, 0), CENTER)


def cyl_between(a, b, r):
    pl = Plane(a, b - a)
    return Cylinder(Circle(pl, r), (b - a).Length).ToBrep(True, True)


def polar_yz(r, deg):
    """A point about the tilt axis, the angle from +Y toward +Z."""
    a = math.radians(deg)
    return TY + r * math.cos(a), AXIS_Z + r * math.sin(a)


# --------------------------------------------------------------------------
# References: servos, bearings, phone
# --------------------------------------------------------------------------
def build_tilt_case():
    """The STS3215's case and output boss: what stays with the arm when the drum tilts."""
    hw = P["STS_W"] / 2.0
    case = box(STS_X0, STS_X1, TY - hw, TY + hw, STS_Z0, STS_Z1)
    case.Transform(lean_xf())
    boss = cyl_x(TY, AXIS_Z, 5.0, HORN_X0 + P["STS_HORN_T"] - 0.2, STS_X0 + 0.2)
    return union([case, boss], "tilt servo case")


def build_tilt_servo():
    """The STS3215 in the housing, its horn on the axis, two pins (the coupling's dogs) toward the trunnion."""
    case = build_tilt_case()
    horn = cyl_x(TY, AXIS_Z, P["STS_HORN_D"] / 2.0, HORN_X0, HORN_X0 + P["STS_HORN_T"])
    pins = [cyl_x(TY, AXIS_Z + s * P["STS_HORN_HOLE_R"], P["PIN_D"] / 2.0, HORN_X0 - P["PIN_L"], HORN_X0 + 0.2)
            for s in (-1, 1)]
    return union([case, horn] + pins, "tilt servo")


def build_pan_servo():
    hw, e = P["STS_W"] / 2.0, P["STS_SHAFT_FROM_END"]
    case = box(-(P["STS_L"] - e), e, PAN_Y - hw, PAN_Y + hw, PAN_CASE_Z0, PAN_CASE_Z1)
    boss = cyl_z(0, PAN_Y, 5.0, PAN_CASE_Z1 - 0.2, PAN_CASE_Z1 + P["STS_BOSS"] + 0.2)
    horn = cyl_z(0, PAN_Y, P["STS_HORN_D"] / 2.0, PAN_HORN_Z1 - P["STS_HORN_T"], PAN_HORN_Z1)
    return union([case, boss, horn], "pan servo")


def build_bearing(x0):
    ring = cyl_x(TY, AXIS_Z, P["BRG_OD"] / 2.0, x0, x0 + P["BRG_W"])
    return diff(ring, [cyl_x(TY, AXIS_Z, P["BRG_ID"] / 2.0, x0 - 1, x0 + P["BRG_W"] + 1)], "bearing")


def build_phone():
    w2, l2 = BP["PHONE_W"] / 2.0, BP["PHONE_L"] / 2.0
    return box(-w2, w2, B.PHONE_Y0, B.PHONE_Y1, AXIS_Z - l2, AXIS_Z + l2)


# --------------------------------------------------------------------------
# Printed parts
# --------------------------------------------------------------------------
def trunnion_screws():
    return [polar_yz(P["TRUN_SCREW_R"], a) for a in P["TRUN_SCREW_ANGLES"]]


def build_drum():
    """The base stand's drum, without the ball's belly, with the trunnion's socket in its +X side.

    The socket's floor is the drum's wall, thickened inside the bore by a pad
    behind the dial's tabs; 3 x M3 from inside the bore (before the dial goes
    on) through the pad into the trunnion's end; the roll servo's lead through
    the floor on the tilt axis. The -X side stays a plain cylinder.
    """
    drum = B.build_drum(belly=False)
    x0, y0, y1, hz = P["PAD"]
    pad = box(x0, P["SOCKET_X0"], y0, y1, AXIS_Z - hz, AXIS_Z + hz)
    drum = union([drum, pad], "drum + pad")
    rs = P["TRUN_D"] / 2.0 + P["TRUN_FIT"]
    cutters = [cyl_x(TY, AXIS_Z, rs, P["SOCKET_X0"], DRUM_R + 1.0),
               cyl_x(TY, AXIS_Z, P["TRUN_BORE"] / 2.0, x0 - 1.0, P["SOCKET_X0"] + 0.5)]
    for (y, z) in trunnion_screws():
        cutters.append(cyl_x(y, z, BP["M3_CLEAR"] / 2.0, x0 - 1.0, P["SOCKET_X0"] + 0.5))
    return diff(drum, cutters, "drum socket")


def build_trunnion():
    """The tube the drum hangs from: journals for the two bearings, the ring between them, the coupling's slot.

    Inner end in the drum's socket (3 inserts in its end face), outer end a slot
    across it for the horn's two pins and a groove beside them for the roll
    lead, which runs out of the drum along the bore.
    """
    x0, x1 = P["SOCKET_X0"] + 0.1, TRUN_X1
    tube = union([cyl_x(TY, AXIS_Z, P["TRUN_D"] / 2.0, x0, x1),
                  cyl_x(TY, AXIS_Z, P["TRUN_RING_D"] / 2.0, BRG_A[1], BRG_B[0])], "trunnion")
    cutters = [cyl_x(TY, AXIS_Z, P["TRUN_BORE"] / 2.0, x0 - 1, x1 + 1)]
    for (y, z) in trunnion_screws():
        cutters.append(cyl_x(y, z, BP["M3_INSERT"] / 2.0, x0 - 1, x0 + BP["M3_INSERT_DEPTH"]))
    r = P["TRUN_D"] / 2.0 + 1.0
    hw = P["DOG_W"] / 2.0
    cutters.append(box(x1 - P["DOG_DEPTH"], x1 + 1, TY - hw, TY + hw, AXIS_Z - r, AXIS_Z + r))
    gw, gd = P["LEAD_GROOVE"]
    cutters.append(box(x1 - gd, x1 + 1, TY - r, TY, AXIS_Z - gw / 2.0, AXIS_Z + gw / 2.0))
    return diff(tube, cutters, "trunnion cuts")


def pocket_box(x0, x1):
    hw = P["STS_W"] / 2.0 + CLR
    b = box(x0, x1, TY - hw, TY + hw, STS_Z0 - CLR, STS_Z1 + CLR)
    b.Transform(lean_xf())
    return b


def build_arm():
    """The L in one print: the bar from the column's cradle, the upright, the tilt housing (to the seam).

    The housing holds the two bearings (the inner one against the lip), the
    coupling's chamber and the tilt servo's pocket, all open toward the cover:
    the trunnion with its bearings goes in from that side, then the servo.
    """
    arm = arm_outline(ARM_IN, ARM_X1, UP_X0)
    bar = cyl_x(PAN_Y, Z_BAR, BAR_R, -COLUMN_R, UP_X0 + 1.0)
    part = union([arm, bar], "arm")
    cutters = [cyl_x(TY, AXIS_Z, P["LIP_D"] / 2.0, ARM_IN - 1, BRG_A[0] + 0.01),
               cyl_x(TY, AXIS_Z, P["BRG_OD"] / 2.0 + P["BRG_SEAT"], BRG_A[0], BRG_B[1] + 0.01),
               cyl_x(TY, AXIS_Z, P["CHAMBER_R"], BRG_B[1], ARM_X1 + 1),
               pocket_box(STS_X0 - CLR, ARM_X1 + 1)]
    # the bar's bore; the cable's hole from the column's bore; the bus cable's channel up the upright to the pocket's
    # far end; the roll lead's channel from the coupling's chamber down to the bar's bore
    bx0, bx1 = P["BAR_BORE_X"]
    cutters.append(cyl_x(PAN_Y, Z_BAR, P["BAR_BORE"] / 2.0, bx0, bx1))
    cutters.append(cyl_z(P["BAR_CABLE_X"], PAN_Y, P["BAR_CABLE_D"] / 2.0, Z_BAR - BAR_R - 2, Z_BAR))
    xm = (STS_X0 + ARM_X1) / 2.0
    top = lean_xf() * Point3d(xm, TY, STS_Z0 + 1.0)
    cutters.append(cyl_between(Point3d(xm, PAN_Y, Z_BAR), top, P["BUS_CHANNEL_D"] / 2.0))
    xl = UP_X0 + P["LEAD_CHANNEL_D"] / 2.0 + 0.6
    lead_top = lean_xf() * Point3d(xl, TY, AXIS_Z - (P["CHAMBER_R"] - 1.0))
    cutters.append(cyl_between(lead_top, Point3d(xl + 4.0, PAN_Y, Z_BAR), P["LEAD_CHANNEL_D"] / 2.0))
    # the cover's 2 screws, from the bore's end face; the bar's M4 down the pan axis, counterbored from the top
    for sy in (-1, 1):
        cutters.append(cyl_x(PAN_Y + sy * P["COVER_SCREW_DY"], Z_BAR, 1.6, bx1 - 1, ARM_X1 + 1))
    cutters.append(cyl_z(0, PAN_Y, 2.2, Z_BAR - BAR_R - 2, Z_BAR + BAR_R + 2))
    cutters.append(cyl_z(0, PAN_Y, P["BAR_SCREW_CB"] / 2.0, Z_BAR + BAR_R - P["BAR_SCREW_CB_DEPTH"], Z_BAR + BAR_R + 2))
    return diff(part, cutters, "arm cuts")


def build_plug():
    """The cap over the bar's screw head, flush with the bar: its top is the bar's cylinder (pressed in)."""
    r = P["BAR_SCREW_CB"] / 2.0 - 0.1
    z0 = Z_BAR + BAR_R - P["PLUG_T"]
    return inter(cyl_z(0, PAN_Y, r, z0, Z_BAR + BAR_R + 2), cyl_x(PAN_Y, Z_BAR, BAR_R, -10, 10), "plug")


def build_cover():
    """The arm's outer face, behind the seam's shadow gap: the servo case's end, 2 inserts."""
    cover = arm_outline(COVER_X0, ARM_OUT, COVER_X0)
    cutters = [pocket_box(COVER_X0 - 1, STS_X1 + CLR), cyl_x(TY, AXIS_Z, P["CHAMBER_R"], COVER_X0 - 1, STS_X1 + CLR)]
    for sy in (-1, 1):
        cutters.append(cyl_x(PAN_Y + sy * P["COVER_SCREW_DY"], Z_BAR, BP["M3_INSERT"] / 2.0, COVER_X0 - 1,
                             COVER_X0 + BP["M3_INSERT_DEPTH"]))
    return diff(cover, cutters, "cover cuts")


def slot_wedge(half_span):
    """The bridge left in the arc slot: a wedge about the pan axis, centred on +Y (the slot is centred on -Y)."""
    keep = math.radians(180.0 - half_span)
    r = P["SLOT_R"][1] + 3.0
    pts = [(0.0, PAN_Y)] + [(r * math.sin(a), PAN_Y + r * math.cos(a)) for a in
                         [-keep + 2 * keep * k / 8.0 for k in range(9)]]
    return pts


def slot_half_span():
    """Half the slot's arc: the pan limit, plus the cable's half width at the slot's radius, plus 3 degrees."""
    rc = (P["SLOT_R"][0] + P["SLOT_R"][1]) / 2.0
    return P["PAN_LIMIT"] + math.degrees(P["CABLE_ENV_D"] / 2.0 / rc) + 3.0


def build_column():
    """Turns on the pan horn: a tube, its floor screwed to the horn, the cable's arc slot, the bar's cradle on top."""
    z0, zf = COLUMN_Z0, COLUMN_Z0 + P["COLUMN_FLOOR"]
    body = cyl_z(0, PAN_Y, COLUMN_R, z0, Z_BAR)
    r0, r1 = P["SLOT_R"]
    ring = diff(cyl_z(0, PAN_Y, r1, z0 - 1, zf + 1), [cyl_z(0, PAN_Y, r0, z0 - 2, zf + 2)], "slot ring")
    slot = diff(ring, [prism_z(slot_wedge(slot_half_span()), z0 - 3, zf + 3)], "slot")
    cutters = [cyl_x(PAN_Y, Z_BAR, BAR_R + GAP, -COLUMN_R - 5, COLUMN_R + 5),
               cyl_z(0, PAN_Y, P["COLUMN_BORE"] / 2.0, zf, Z_BAR + 1),
               cyl_z(0, PAN_Y, P["STS_HORN_D"] / 2.0 + CLR, z0 - 1, PAN_HORN_Z1),
               cyl_z(0, PAN_Y, P["M4_INSERT"] / 2.0, zf - P["M4_INSERT_DEPTH"], zf + 1),
               slot]
    for k in range(P["STS_HORN_HOLES"]):
        a = 2 * math.pi * (k + 0.5) / P["STS_HORN_HOLES"]
        rr = P["STS_HORN_HOLE_R"]
        cutters.append(cyl_z(rr * math.cos(a), PAN_Y + rr * math.sin(a), 1.6, z0 - 1, zf + 1))
    return diff(body, cutters, "column cuts")


def build_base(tripod_y):
    """The base stand's base, reshaped by the overrides, plus the pan servo's pocket, horn hole, screws, cable hole."""
    base = B.build_base(tripod_y)
    hw, e = P["STS_W"] / 2.0 + CLR, P["STS_SHAFT_FROM_END"]
    cutters = [box(-(P["STS_L"] - e) - CLR, e + CLR, PAN_Y - hw, PAN_Y + hw, -1, PAN_CASE_Z1),
               cyl_z(0, PAN_Y, P["STS_HORN_D"] / 2.0 + 0.5, PAN_CASE_Z1 - 1, BASE_TOP + 1),
               cyl_z(0, PAN_Y - P["CABLE_HOLE_R"], P["CABLE_ENV_D"] / 2.0 + 0.5, B.CAVITY_TOP_Z - 1, BASE_TOP + 1)]
    floor = BASE_TOP
    for (x, y) in P["STS_SCREWS"]:
        cutters.append(cyl_z(x, PAN_Y + y, P["STS_SCREW_D"] / 2.0, PAN_CASE_Z1 - 1, floor + 1))
        cutters.append(cyl_z(x, PAN_Y + y, 2.1, floor - 1.2, floor + 1))
    return diff(base, cutters, "base pan cuts")


# --------------------------------------------------------------------------
# Poses
# --------------------------------------------------------------------------
def roll_xf(theta):
    """The roll servo's angle, the base script's model angle (0 portrait, -90 landscape)."""
    return Transform.Rotation(math.radians(theta), B.ROT_AXIS, B.AX)


def tilt_xf(t):
    """+ leans the screen back: about X through the common point."""
    return Transform.Rotation(math.radians(t), Vector3d(1, 0, 0), CENTER)


def pan_xf(p):
    return Transform.Rotation(math.radians(p), Vector3d(0, 0, 1), PAN_C)


# --------------------------------------------------------------------------
# The cantilever: section properties and the load path, in N and mm
# --------------------------------------------------------------------------
def rect_I(rects, axis):
    """Second moment of a section of rectangles (u0, u1, v0, v1) about its centroid, bending with u as the depth."""
    a = sum((u1 - u0) * (v1 - v0) for u0, u1, v0, v1 in rects)
    uc = sum((u1 - u0) * (v1 - v0) * (u0 + u1) / 2.0 for u0, u1, v0, v1 in rects) / a
    i = sum((v1 - v0) * (u1 - u0) ** 3 / 12.0 + (u1 - u0) * (v1 - v0) * ((u0 + u1) / 2.0 - uc) ** 2
            for u0, u1, v0, v1 in rects)
    c = max(max(abs(u0 - uc), abs(u1 - uc)) for u0, u1, v0, v1 in rects)
    return i, c


def tube_I(d, di):
    return math.pi / 64.0 * (d ** 4 - di ** 4)


# --------------------------------------------------------------------------
# Print checks
# --------------------------------------------------------------------------
def print_mesh(brep, xform):
    mp = MeshingParameters.QualityRenderMesh
    mp.Tolerance = 0.05
    mesh = Mesh()
    for m in Mesh.CreateFromBrep(brep, mp):
        mesh.Append(m)
    mesh.Weld(math.pi)
    mesh.Transform(xform)
    bb = mesh.GetBoundingBox(True)
    mesh.Translate(Vector3d(-bb.Min.X, -bb.Min.Y, -bb.Min.Z))
    mesh.Faces.ConvertQuadsToTriangles()
    mesh.FaceNormals.ComputeFaceNormals()
    return mesh


def overhangs(mesh):
    """Downward faces steeper than 45 degrees, off the bed, grouped; each group's narrower width (a bridge's span)."""
    idx = []
    v = mesh.Vertices
    for i in range(mesh.Faces.Count):
        n = mesh.FaceNormals[i]
        if n.Z > -0.7072:
            continue
        f = mesh.Faces[i]
        if max(v[f.A].Z, v[f.B].Z, v[f.C].Z) < 0.3:
            continue
        idx.append(i)
    if not idx:
        return []
    from System.Collections.Generic import List
    sub = mesh.Faces.ExtractFaces(List[int](idx))
    widths = []
    for piece in (sub.SplitDisjointPieces() or [sub]):
        # the span: the narrower of its box's sides, and 4 A / perimeter (a ring's width, a disc's diameter)
        bb = piece.GetBoundingBox(True)
        span = min(bb.Max.X - bb.Min.X, bb.Max.Y - bb.Min.Y)
        edges = piece.GetNakedEdges() or []
        perim = sum(pl.Length for pl in edges)
        area = Rhino.Geometry.AreaMassProperties.Compute(piece).Area
        if perim > 0:
            span = min(span, 4.0 * area / perim)
        widths.append(span)
    return widths


# --------------------------------------------------------------------------
# Document
# --------------------------------------------------------------------------
LAYERS = {
    "PT_BASE": (200, 200, 200), "PT_LID": (120, 120, 120), "PT_COLUMN": (230, 227, 220),
    "PT_ARM": (230, 227, 220), "PT_COVER": (215, 212, 205), "PT_DRUM": (230, 227, 220),
    "PT_TRUNNION": (150, 150, 150), "PT_PLATE": (210, 207, 200), "PT_INDEX": (226, 83, 31),
    "PT_HEAD": (190, 187, 180), "PT_SERVO_REF": (90, 90, 200), "PT_PHONE": (60, 160, 230),
}
FORMER_LAYERS = ("PT_YOKE", "PT_AXLE")      # the fork's, wiped too when rebuilding over an older run


def layer_index(name):
    lay = doc.Layers.FindName(name)
    if lay is None or lay.IsDeleted:
        nl = Rhino.DocObjects.Layer()
        nl.Name = name
        r, g, b = LAYERS[name]
        import System
        nl.Color = System.Drawing.Color.FromArgb(r, g, b)
        return doc.Layers.Add(nl)
    return lay.Index


def clear_layers():
    for name in list(LAYERS) + list(FORMER_LAYERS):
        lay = doc.Layers.FindName(name)
        if lay is None:
            continue
        for obj in doc.Objects.FindByLayer(lay) or []:
            doc.Objects.Delete(obj, True)


def add(brep, layer, name):
    attr = Rhino.DocObjects.ObjectAttributes()
    attr.LayerIndex = layer_index(layer)
    attr.Name = name
    return doc.Objects.AddBrep(brep, attr)


def write_world_stl(brep, path):
    """A mesh in the repository's frame (turned half a turn about Z), not moved: for the posed renders."""
    mp = MeshingParameters.QualityRenderMesh
    mp.Tolerance = 0.05
    mesh = Mesh()
    for m in Mesh.CreateFromBrep(brep, mp):
        mesh.Append(m)
    mesh.Transform(Transform.Rotation(math.pi, Vector3d(0, 0, 1), Point3d.Origin))
    mesh.Faces.ConvertQuadsToTriangles()
    mesh.FaceNormals.ComputeFaceNormals()
    import struct
    v = mesh.Vertices
    with open(path, "wb") as f:
        f.write(b"\0" * 80)
        f.write(struct.pack("<I", mesh.Faces.Count))
        for i in range(mesh.Faces.Count):
            fc = mesh.Faces[i]
            n = mesh.FaceNormals[i]
            f.write(struct.pack("<3f", n.X, n.Y, n.Z))
            for k in (fc.A, fc.B, fc.C):
                f.write(struct.pack("<3f", v[k].X, v[k].Y, v[k].Z))
            f.write(b"\0\0")


# --------------------------------------------------------------------------


# --------------------------------------------------------------------------
# Build
# --------------------------------------------------------------------------
def main():
    doc.ModelUnitSystem = Rhino.UnitSystem.Millimeters
    clear_layers()
    report, failures = [], []

    roll_servo = B.build_servo()
    tilt_servo = build_tilt_servo()
    tilt_case = build_tilt_case()
    pan_servo = build_pan_servo()
    bearing_a = build_bearing(BRG_A[0])
    bearing_b = build_bearing(BRG_B[0])
    drum = build_drum()
    trunnion = build_trunnion()
    plate = B.build_plate()
    index = B.build_index()
    head = B.build_head()
    arm = build_arm()
    cover = build_cover()
    column = build_column()
    plug = build_plug()
    phone = build_phone()

    k = BP["PETG_DENSITY"] * BP["PRINT_FILL"]

    def printed(brep, dens=k):
        vol, c = B.volume_centroid(brep)
        return (vol * dens, c)

    def com_of(masses):
        m = sum(q for q, _ in masses)
        return m, Point3d(sum(q * c.X for q, c in masses) / m, sum(q * c.Y for q, c in masses) / m,
                          sum(q * c.Z for q, c in masses) / m)

    # the masses that tilt (and roll, the phone), those that pan, those that stay
    tilting = [printed(drum), printed(trunnion), printed(plate), printed(index),
               (BP["SERVO_G"], B.volume_centroid(roll_servo)[1]), (BP["HEAD_G"], B.volume_centroid(head)[1])]
    phone_m = (BP["PHONE_G"], Point3d(0, (B.PHONE_Y0 + B.PHONE_Y1) / 2.0, AXIS_Z))
    panning = [printed(arm), printed(cover), printed(column), printed(plug),
               (P["STS_G"], B.volume_centroid(tilt_servo)[1]),
               (P["BRG_G"], B.volume_centroid(bearing_a)[1]), (P["BRG_G"], B.volume_centroid(bearing_b)[1])]
    m_tilt, c_tilt = com_of(tilting + [phone_m])
    pre_base = build_base(BP["BALLAST_CY"])
    lid0 = B.build_lid(BP["BALLAST_CY"])
    t_lo = BP["BALLAST_CY"] - BP["BALLAST_R"] + 2.0
    t_hi = BP["BALLAST_CY"] + BP["BALLAST_R"] - (BP["TRIPOD_BOSS_D"] / 2 + 6.0)
    _, c_all0 = com_of(tilting + [phone_m] + panning + [printed(pre_base), printed(lid0)])
    tripod_y = min(max(c_all0.Y, t_lo), t_hi)
    base = build_base(tripod_y)
    lid = B.build_lid(tripod_y)
    fixed = [printed(base), printed(lid), (P["STS_G"], B.volume_centroid(pan_servo)[1]),
             (P["ELECTRONICS_G"], Point3d(0, PAN_Y - 40.0, 10.0)),
             (BP["BALLAST_G"], Point3d(0, BP["BALLAST_CY"], BP["LID_T"] + 8.0))]

    parts = [("PT_BASE", "Base", base), ("PT_LID", "Lid", lid), ("PT_COLUMN", "Column", column),
             ("PT_ARM", "Arm", arm), ("PT_COVER", "Cover", cover), ("PT_ARM", "Plug", plug),
             ("PT_DRUM", "Drum", drum), ("PT_TRUNNION", "Trunnion", trunnion), ("PT_PLATE", "Plate", plate),
             ("PT_INDEX", "Index", index), ("PT_HEAD", "Head", head)]
    refs = [("PT_SERVO_REF", "roll_servo_mg996r", roll_servo), ("PT_SERVO_REF", "tilt_servo_sts3215", tilt_servo),
            ("PT_SERVO_REF", "pan_servo_sts3215", pan_servo), ("PT_SERVO_REF", "bearing_6704_inner", bearing_a),
            ("PT_SERVO_REF", "bearing_6704_outer", bearing_b), ("PT_PHONE", "phone", phone)]
    for layer, name, brep in parts + refs:
        add(brep, layer, name)
        report.append("%-19s solid=%s valid=%s  %s" % (name, brep.IsSolid, brep.IsValid, B.bbox_str(brep)))
        if not (brep.IsSolid and brep.IsValid):
            failures.append("%s not a valid solid" % name)

    # ---- the roll mechanism, the base stand's, re-checked in its new drum -------------------------------------
    stop = B.stop_block(B.FLANGE_BACK_Y)
    tab_a, tab_b, _ = B.stop_contact_angles()
    tabs = [B.build_tab(tab_a), B.build_tab(tab_b)]
    lo, hi, ot = BP["ROT_RANGE"][0], BP["ROT_RANGE"][1], BP["OVERTRAVEL"]
    travel = (lo - ot + 0.5, lo, (lo + hi) / 2.0, hi, hi + ot - 0.5)
    roll_free = [th for th in travel if any(intersects(B.rotated(t, th), stop) for t in tabs)]
    roll_blocked = [th for th in (lo - ot - 0.5, hi + ot + 0.5) if not any(intersects(B.rotated(t, th), stop) for t in tabs)]
    plate_drum = [th for th in travel if intersects(B.rotated(plate, th), drum)]
    roll_servo_drum = intersects(roll_servo, drum)
    if roll_free or roll_blocked or plate_drum or roll_servo_drum:
        failures.append("roll: stops %s / %s, plate vs drum %s, servo vs drum %s"
                        % (roll_free, roll_blocked, plate_drum, roll_servo_drum))
    report.append("roll (MG996R, the base stand's dial): stops clash inside travel %s, free beyond %s, plate vs drum %s, servo vs drum %s"
                  % (roll_free or "none", roll_blocked or "none", plate_drum or "none", roll_servo_drum))

    # ---- assembled at rest: nothing overlaps; the servos and the bearings in their seats ---------------------
    named = dict((n, b) for _, n, b in parts)
    pairs = [("Base", "Column"), ("Base", "Lid"), ("Column", "Arm"), ("Arm", "Cover"), ("Drum", "Arm"),
             ("Drum", "Cover"), ("Drum", "Column"), ("Drum", "Plate"), ("Trunnion", "Arm"), ("Trunnion", "Drum"),
             ("Trunnion", "Cover"), ("Plate", "Arm"), ("Plug", "Arm"), ("Plug", "Drum"), ("Plug", "Column")]
    rest = ["%s/%s" % (a, b) for (a, b) in pairs if intersects(named[a], named[b])]
    seats = [("tilt servo", tilt_servo, (arm, cover, drum, trunnion)), ("pan servo", pan_servo, (base, column)),
             ("inner bearing", bearing_a, (arm, drum, cover)), ("outer bearing", bearing_b, (arm, drum, cover))]
    seat_hits = ["%s" % n for (n, s, others) in seats if any(intersects(s, o) for o in others)]
    if rest or seat_hits:
        failures.append("overlap at rest: %s" % ", ".join(rest + seat_hits))
    report.append("at rest, overlaps: %s; servos and bearings clear of their seats: %s"
                  % (rest or "none", seat_hits or "yes"))
    # electronics in the bay
    def rel(b):
        x0, x1, y0, y1, z0, z1 = b
        return box(x0, x1, PAN_Y + y0, PAN_Y + y1, z0, z1)
    elec = [("ESP32", B.esp32_box()), ("power board", rel(P["POWER_BOX"])), ("PD trigger", rel(P["PD_BOX"]))]
    elec_hits = [n for n, b in elec if intersects(b, base) or intersects(b, pan_servo)]
    if elec_hits:
        failures.append("electronics do not fit the bay: %s" % elec_hits)
    report.append("electronics (ESP32 56x29x15, power board 50x17x12, PD trigger 26x11x6) clear of the base: %s"
                  % (elec_hits or "yes"))
    # the socket stays in the drum's side, behind its front face and the dial's tabs
    sock_front = TY + P["TRUN_D"] / 2.0 + P["TRUN_FIT"]
    pad_tabs = B.PLATE_BACK_Y - BP["TAB_LEN"] - P["PAD"][2]
    screw_y = max(y for y, _ in trunnion_screws()) + 2.75
    if sock_front > B.DRUM_FRONT_Y - 1.0 or pad_tabs < 0.5 or screw_y > B.PLATE_BACK_Y - BP["TAB_LEN"] - 0.5:
        failures.append("the trunnion's socket in the dial's way")
    report.append("trunnion's socket: D %.1f, its front edge Y %.1f (the drum's face %.1f); pad and screw heads behind Y %.1f, the dial's tabs from Y %.1f"
                  % (2 * (P["TRUN_D"] / 2.0 + P["TRUN_FIT"]), sock_front, B.DRUM_FRONT_Y, max(P["PAD"][2], screw_y),
                     B.PLATE_BACK_Y - BP["TAB_LEN"]))

    # ---- the tilt envelope: everything that tilts against everything that pans --------------------------------
    t0, t1 = P["TILT_SPEC"]
    ex = P["TILT_EXTRA"]
    tilts = [t0 - ex, t0, t0 / 2.0, 0.0, t1 / 2.0, t1, t1 + ex]
    rolls = [0.0, -15.0, -30.0, -45.0, -60.0, -75.0, -90.0]
    fork = [("Arm", arm), ("Cover", cover), ("Column", column), ("Plug", plug)]
    hits = []
    for t in tilts:
        xt = tilt_xf(t)
        for nm, g in (("Drum", drum), ("Trunnion", trunnion)):
            hits += ["%s@%+.1f/%s" % (nm, t, fn) for fn, f in fork if intersects(moved(g, xt), f)]
        if intersects(moved(trunnion, xt), tilt_case):     # the horn and its pins turn with the trunnion
            hits.append("Trunnion@%+.1f/servo case" % t)
        for r in rolls:
            xf = xt * roll_xf(r)
            for nm, g in (("Plate", plate), ("Head", head), ("Phone", phone)):
                if nm != "Phone" and r not in (0.0, -45.0, -90.0):
                    continue
                hits += ["%s@%+.1f,%.0f/%s" % (nm, t, r, fn) for fn, f in fork if intersects(moved(g, xf), f)]
    if hits:
        failures.append("tilt envelope: " + ", ".join(hits[:8]))
    report.append("tilt %+.0f..%+.0f (checked %+.0f..%+.0f), roll 0..90 every 15: drum, trunnion, plate, head, phone clear of the arm, the cover and the column: %s"
                  % (t0, t1, t0 - ex, t1 + ex, hits or "yes"))

    # the phone above the base's top (pan turns everything about the base's own centre: it changes nothing)
    corners = []
    l2, w2 = BP["PHONE_L"] / 2.0, BP["PHONE_W"] / 2.0
    for y in (B.PHONE_Y0, B.PHONE_Y1):
        for sx in (-1, 1):
            for sz in (-1, 1):
                corners.append(Point3d(sx * w2, y, AXIS_Z + sz * l2))
    low = []
    t = t0 - ex
    while t <= t1 + ex + 1e-9:
        r = 0.0
        while r >= -90.0 - 1e-9:
            xf = tilt_xf(t) * roll_xf(r)
            low.append((min((xf * p).Z for p in corners) - BASE_TOP, t, r))
            r -= 5.0
        t += 2.5
    spec_low = min(q for q in low if t0 <= q[1] <= t1)
    all_low = min(low)
    if spec_low[0] < P["CLEAR_MARGIN"]:
        failures.append("phone too close to the base")
    report.append("phone above the base's top: worst %.1f at tilt %+.1f roll %.0f over the range (required %.0f); %.1f at tilt %+.1f over the extra %.0f deg; above the desk %.1f"
                  % (spec_low[0], spec_low[1], -spec_low[2], P["CLEAR_MARGIN"], all_low[0], all_low[1], ex,
                     spec_low[0] + BASE_TOP))
    # the bar's drop: the drum's back edge over the bar at the back tilt
    bar_top = cyl_x(PAN_Y, Z_BAR, BAR_R + 2.0, -DRUM_R - 1, DRUM_R + 1)
    drum_bar = [t for t in tilts if intersects(moved(drum, tilt_xf(t)), bar_top)]
    if drum_bar:
        failures.append("drum within 2 mm of the bar at %s" % drum_bar)
    report.append("drum 2 mm clear of the bar over tilt %+.0f..%+.0f: %s" % (t0 - ex, t1 + ex, drum_bar or "yes"))

    # ---- torque margins ------------------------------------------------------------------------------------
    g = 9.81e-3
    grav = []
    for t in tilts[1:-1]:
        c = tilt_xf(t) * c_tilt
        grav.append((m_tilt * g * abs(c.Y - TY) / 1000.0, t))
    grav_max = max(grav)
    tap_tilt = P["TAP_N"] * l2 / 1000.0            # a tap at the phone's top, portrait: the lever is in the screen's plane
    tap_pan = P["TAP_N"] * l2 / 1000.0             # at a landscape end: the lever about the pan axis
    tap_roll = P["TAP_N"] * l2 / 1000.0            # at a landscape end, along the screen: about the roll axis
    tilt_load = grav_max[0] + tap_tilt
    m_pan = m_tilt + sum(q for q, _ in panning)
    margin_tilt = P["STS_STALL"] / tilt_load
    margin_pan = P["STS_STALL"] / tap_pan
    margin_roll = P["MG996R_STALL"] / tap_roll
    for n, mg in (("tilt", margin_tilt), ("pan", margin_pan), ("roll", margin_roll)):
        if mg < P["TORQUE_FACTOR"]:
            failures.append("%s torque margin %.1f" % (n, mg))
    axial = m_pan * 9.81e-3
    if axial > P["BEARING_LOAD_MAX"]:
        failures.append("pan servo's axial load")
    _, c_pan = com_of(tilting + [phone_m] + panning)
    pan_offset = math.hypot(c_pan.X, c_pan.Y - PAN_Y)
    report += [
        "tilting mass %.0f g (phone %.0f), its CoM X=%.1f Y=%.1f Z=%.1f: %.1f mm ahead of the tilt axis, %.1f below"
        % (m_tilt, BP["PHONE_G"], c_tilt.X, c_tilt.Y, c_tilt.Z, c_tilt.Y - TY, AXIS_Z - c_tilt.Z),
        "tilt (STS3215, stall %.1f N m): gravity at most %.3f N m (tilt %+.0f), a %.0f N tap at the phone's top %.3f: %.2f N m, margin x%.1f (required x%.0f)"
        % (P["STS_STALL"], grav_max[0], grav_max[1], P["TAP_N"], tap_tilt, tilt_load, margin_tilt, P["TORQUE_FACTOR"]),
        "pan (STS3215): no gravity on a vertical axis; a tap at a landscape end %.3f N m, margin x%.1f; on its output %.1f N (%.0f g) axially, its CoM %.1f mm off the axis: %.3f N m overhung"
        % (tap_pan, margin_pan, axial, m_pan, pan_offset, axial * pan_offset / 1000.0),
        "roll (MG996R, stall %.2f N m at 6 V): the phone on its axis; a tap along a landscape end %.3f N m, margin x%.1f"
        % (P["MG996R_STALL"], tap_roll, margin_roll),
    ]

    # ---- the cantilever: the trunnion, the bearings, the arm -----------------------------------------------
    # Loads: the tilting weight W at its CoM, and the tap F at the phone's top (horizontal, along -Y), both carried
    # from the drum's side to the housing by the trunnion, then down the upright and along the bar to the column.
    # Elastic, small deflections, the parts as beams; the bearings' play and the gearbox's backlash not included.
    E, G, allow = P["PETG_E"], P["PETG_G"], P["PETG_ALLOW"]
    W, F = m_tilt * g, P["TAP_N"]
    h_tap = l2                                     # the tap's height over the tilt axis (portrait)
    xa, xb = sum(BRG_A) / 2.0, sum(BRG_B) / 2.0
    span = xb - xa
    a = xa - c_tilt.X                              # the overhang, from the load to the inner bearing
    load = math.hypot(W, F)
    r_a, r_b = load * (a + span) / span, load * a / span
    brg_factor = P["BRG_C0"] / r_a
    # the trunnion at the inner bearing: bending (both loads) and torsion (the tilt servo's worst load)
    i_t = tube_I(P["TRUN_D"], P["TRUN_BORE"])
    m_t = load * a
    sig_t = m_t * (P["TRUN_D"] / 2.0) / i_t
    tau_t = tilt_load * 1000.0 * (P["TRUN_D"] / 2.0) / (2.0 * i_t)
    vm_t = math.hypot(sig_t, math.sqrt(3.0) * tau_t)
    a_s = xa - P["SOCKET_X0"]
    d_t = load * a_s ** 3 / (3 * E * i_t) + load * (a - a_s) * a_s ** 2 / (2 * E * i_t)   # the socket's drop
    # the 3 screws into the trunnion's end: the moment at the socket, carried on their circle
    m_s = load * (P["SOCKET_X0"] - c_tilt.X)
    screw_n = m_s / (1.5 * P["TRUN_SCREW_R"])
    # the upright (U section where the pocket is: its back wall and two flanges) and the bar (a tube)
    x_up = (UP_X0 + ARM_X1) / 2.0
    lu = AXIS_Z - Z_BAR
    lb = x_up
    hw = P["STS_W"] / 2.0 + CLR
    px0 = STS_X0 - CLR
    u_x = [(UP_X0, px0, -P["ARM_R"], P["ARM_R"]), (px0, ARM_X1, hw, P["ARM_R"]), (px0, ARM_X1, -P["ARM_R"], -hw)]
    i_uy, c_uy = rect_I(u_x, "x")                  # bending in XZ (gravity's overhang): X is the depth
    i_ux, c_ux = rect_I([(v0, v1, u0, u1) for (u0, u1, v0, v1) in u_x], "y")   # bending in YZ (the tap): Y the depth
    i_b = tube_I(2 * BAR_R, P["BAR_BORE"])
    j_b = 2 * i_b
    m_uy = W * (x_up - c_tilt.X)                   # the overhang's moment, constant up the upright
    m_ux = F * (lu + h_tap)                        # the tap's, at the upright's foot
    sig_u = m_uy * c_uy / i_uy + m_ux * c_ux / i_ux
    m_b = W * lb + m_uy                            # at the bar's root, in the column's cradle (conservative)
    t_b = F * (lu + h_tap)                         # the tap twists the bar
    sig_b = math.hypot(m_b * BAR_R / i_b, math.sqrt(3.0) * t_b * BAR_R / j_b)
    # gravity: the phone's drop. The bar bends under W and the overhang's moment, the upright under the moment,
    # and both turn the drum about Y: the drop is their rotation times the overhang, plus the bar's own sag
    th_b = (W * lb ** 2 / 2.0 + m_uy * lb) / (E * i_b)
    th_u = m_uy * lu / (E * i_uy)
    sag = W * lb ** 3 / (3 * E * i_b) + m_uy * lb ** 2 / (2 * E * i_b) + (th_b + th_u) * (x_up - c_tilt.X) + d_t
    # the tap: the upright bends in YZ, the bar twists, the trunnion's share is in d_t
    d_up = F * lu ** 3 / (3 * E * i_ux) + F * h_tap * lu ** 2 / (2 * E * i_ux)
    th_up = F * lu ** 2 / (2 * E * i_ux) + F * h_tap * lu / (E * i_ux)
    phi_b = t_b * lb / (G * j_b)
    push = d_up + th_up * h_tap + phi_b * (lu + h_tap)
    sig_max = max(vm_t, sig_u, sig_b)
    if sig_max > allow:
        failures.append("arm stress %.2f MPa" % sig_max)
    if sag + push > P["DEFLECT_MAX"]:
        failures.append("arm deflection %.2f mm" % (sag + push))
    if brg_factor < P["BRG_FACTOR"]:
        failures.append("bearing load")
    report += [
        "cantilever (PETG E %.0f MPa, G %.0f, allowable %.0f MPa; tilting weight %.2f N at X %.1f, a %.0f N tap at the phone's top):"
        % (E, G, allow, W, c_tilt.X, F),
        "  bearings 6704 at X %.2f and %.2f, %.1f apart, the load %.1f mm outboard: inner %.1f N, outer %.1f N; static rating %.0f N, x%.0f (required x%.0f)"
        % (xa, xb, span, a, r_a, r_b, P["BRG_C0"], brg_factor, P["BRG_FACTOR"]),
        "  trunnion D %.0f/%.0f at the inner bearing: %.0f N mm bending, %.2f MPa, with the tilt torque %.2f MPa von Mises; the socket drops %.4f mm; the 3 screws %.1f N each"
        % (P["TRUN_D"], P["TRUN_BORE"], m_t, sig_t, vm_t, d_t, screw_n),
        "  upright (U section, I %.0f / %.0f mm4): %.0f N mm overhang, %.0f N mm tap, %.2f MPa; bar D %.0f/%.0f at the column: %.2f MPa"
        % (i_uy, i_ux, m_uy, m_ux, sig_u, 2 * BAR_R, P["BAR_BORE"], sig_b),
        "  deflection: the drum's centre sags %.3f mm under gravity, a tap pushes the phone's top %.3f mm: %.3f mm (max %.1f); worst stress %.2f MPa, x%.0f under allowable"
        % (sag, push, sag + push, P["DEFLECT_MAX"], sig_max, allow / sig_max),
    ]

    # ---- centre of mass and tip-over over every aim --------------------------------------------------------
    m_all = m_tilt + sum(q for q, _ in panning) + sum(q for q, _ in fixed)
    rows = []
    pans = range(-int(P["PAN_LIMIT"]), int(P["PAN_LIMIT"]) + 1, 15)
    for p in pans:
        xp = pan_xf(p)
        for t in (t0 - ex, t0, 0.0, t1, t1 + ex):
            xt = xp * tilt_xf(t)
            mov = [(q, xt * c) for q, c in tilting + [phone_m]] + [(q, xp * c) for q, c in panning]
            _, cm = com_of(mov + fixed)
            dist = math.hypot(cm.X, cm.Y - BP["BASE_CY"])
            # a tap at the phone's top, pushing the screen away from the user, horizontal: tips about the rim
            top = max((xt * pt for pt in corners), key=lambda q: q.Z)
            u = Vector3d(0, -1, 0)
            u.Transform(xp)
            lever = BP["BASE_R"] - (u.X * cm.X + u.Y * (cm.Y - BP["BASE_CY"]))
            ratio = (m_all * 9.81e-3 * lever) / (P["TAP_N"] * top.Z)
            rows.append((BP["BASE_R"] - dist, B.feet_hull_margin(cm.X, cm.Y), ratio, p, t, cm))
    worst_rim = min(rows, key=lambda r: r[0])
    worst_feet = min(rows, key=lambda r: r[1])
    worst_tap = min(rows, key=lambda r: r[2])
    if worst_rim[0] < P["TIP_MARGIN_MIN"]:
        failures.append("centre of mass too close to the rim")
    if worst_tap[2] < P["TAP_TIP_MIN"]:
        failures.append("a tap tips the stand over")
    _, c_rest = com_of(tilting + [phone_m] + panning + fixed)
    report += [
        "mass %.0f g (ballast %.0f); CoM at rest X=%.1f Y=%.1f Z=%.1f; tripod nut at Y %.1f"
        % (m_all, BP["BALLAST_G"], c_rest.X, c_rest.Y, c_rest.Z, tripod_y),
        "CoM to the base's rim, any pan within +-%.0f, tilt %+.0f..%+.0f: worst %.1f mm (pan %+d tilt %+.0f, min %.0f); to the feet's square %.1f mm"
        % (P["PAN_LIMIT"], t0 - ex, t1 + ex, worst_rim[0], worst_rim[3], worst_rim[4], P["TIP_MARGIN_MIN"], worst_feet[1]),
        "a %.0f N tap at the phone's top: restoring over tipping x%.2f at worst (pan %+d tilt %+.0f, required x%.1f)"
        % (P["TAP_N"], worst_tap[2], worst_tap[3], worst_tap[4], P["TAP_TIP_MIN"]),
    ]

    # ---- the cable: the pan axis's loop, the tilt axis's trunnion ------------------------------------------
    cable = cyl_z(0, PAN_Y - P["CABLE_HOLE_R"], P["CABLE_ENV_D"] / 2.0, COLUMN_Z0 - 2.0, COLUMN_Z0 + P["COLUMN_FLOOR"] + 2.0)
    pinch = [p for p in range(-int(P["PAN_LIMIT"]), int(P["PAN_LIMIT"]) + 1, 15) if intersects(cable, moved(column, pan_xf(p)))]
    pinch += [p for p in (-P["PAN_LIMIT"], P["PAN_LIMIT"]) if intersects(cable, moved(column, pan_xf(p)))]
    lim = P["PAN_LIMIT"]
    hit_at = None
    a = lim
    while a < 180.0:
        if intersects(cable, moved(column, pan_xf(a))):
            hit_at = a
            break
        a += 2.0
    if pinch or P["PAN_LIMIT"] < P["PAN_SPEC"]:
        failures.append("pan cable pinched within the limits: %s" % pinch)
    loop = math.radians(2 * lim) * P["CABLE_HOLE_R"]
    jr_plug = math.hypot(7.6, 3.9)
    if P["TRUN_BORE"] < jr_plug + 1.0:
        failures.append("the roll servo's plug does not pass the trunnion")
    # the lead's way out of the trunnion: its groove turns with the tilt inside the chamber, never against the pocket
    sweep = math.radians((t1 + ex) - (t0 - ex)) * (P["TRUN_D"] / 2.0)
    report += [
        "pan: required +-%.0f, limits +-%.0f (software and the servo's angle limits); the cable (D %.0f) free in the column's slot over the limits: %s; it would meet the slot's end at %s deg; its loop needs about %.0f mm of slack in the column's bore (D %.0f)"
        % (P["PAN_SPEC"], lim, P["CABLE_ENV_D"], pinch or "yes", hit_at, loop, P["COLUMN_BORE"]),
        "tilt: the roll servo's lead runs out of the drum on the axis, through the trunnion's bore (D %.1f, its plug %.1f across), out of its groove into the chamber (the groove's mouth sweeps %.0f mm over the tilt), down the upright's channel (D %.1f) to the bar"
        % (P["TRUN_BORE"], jr_plug, sweep, P["LEAD_CHANNEL_D"]),
    ]

    # ---- sizes and proportions ------------------------------------------------------------------------------
    bb_all = BoundingBox.Empty
    for _, _, b in parts:
        bb_all.Union(b.GetBoundingBox(True))
    vol_parts = sum(B.volume_centroid(b)[0] for _, _, b in parts)
    vol_arm = sum(B.volume_centroid(named[n])[0] for n in ("Column", "Arm", "Cover", "Plug", "Trunnion"))
    report += [
        "roll and tilt axes meet at Y=%.1f Z=%.2f (%.2f above the base's top); pan axis Y=%.1f (%.0f behind); upright leans %.1f deg; bar axis Z=%.2f; column %.2f..%.2f, %.1f seen"
        % (TY, AXIS_Z, AXIS_Z - BASE_TOP, PAN_Y, P["PAN_BACK"], math.degrees(LEAN), Z_BAR, COLUMN_Z0, Z_BAR, COLUMN_SHOW),
        "overall %.1f wide (X %.1f..%.1f), %.1f deep (Y), %.1f high (drum's top); base D %.0f x %.0f; drum D %.0f; joints D %.0f, connectors %.0f"
        % (bb_all.Max.X - bb_all.Min.X, bb_all.Min.X, bb_all.Max.X, bb_all.Max.Y - bb_all.Min.Y, AXIS_Z + DRUM_R,
           2 * BP["BASE_R"], BASE_TOP, BP["DRUM_D"], 2 * P["HOUSING_R"], 2 * P["ARM_R"]),
        "volume: printed parts %.0f cm3, of which the arm (column, arm, cover, plug, trunnion) %.0f cm3"
        % (vol_parts / 1000.0, vol_arm / 1000.0),
        "X stack: drum %.1f, housing %.2f, lip to %.2f, bearings %.2f..%.2f and %.2f..%.2f, trunnion to %.2f, horn %.2f, tilt servo %.2f..%.2f, seam %.2f, cover to %.2f; upright from %.2f"
        % (DRUM_R, ARM_IN, BRG_A[0], BRG_A[0], BRG_A[1], BRG_B[0], BRG_B[1], TRUN_X1, HORN_X0, STS_X0, STS_X1, SEAM_X,
           ARM_OUT, UP_X0),
    ]

    # ---- print: every part under PART_MAX, no overhang past 45 degrees but bridges ---------------------------
    rx = lambda deg: Transform.Rotation(math.radians(deg), Vector3d(1, 0, 0), Point3d.Origin)
    ry = lambda deg: Transform.Rotation(math.radians(deg), Vector3d(0, 1, 0), Point3d.Origin)
    orient = [("Base", base, rx(180)), ("Lid", lid, Transform.Identity), ("Column", column, Transform.Identity),
              ("Arm", arm, ry(90)), ("Cover", cover, ry(90)), ("Plug", plug, Transform.Identity),
              ("Drum", drum, rx(90)), ("Trunnion", trunnion, ry(90)), ("Plate", plate, rx(-90)),
              ("Index", index, ry(90)), ("Head", head, rx(-90))]
    bad_print = []
    for name, brep, xf in orient:
        mesh = print_mesh(brep, xf)
        bb = mesh.GetBoundingBox(True)
        size = (bb.Max.X, bb.Max.Y, bb.Max.Z)
        widths = [] if name == "Head" else overhangs(mesh)
        wide = [w for w in widths if w > P["BRIDGE_MAX"]]
        report.append("print %-10s %.1f x %.1f x %.1f, downward faces off the bed: %d groups, widest %.1f%s"
                      % (name, size[0], size[1], size[2], len(widths), max(widths) if widths else 0.0,
                         " (vendor print-in-place, not checked)" if name == "Head" else ""))
        if max(size) > P["PART_MAX"]:
            failures.append("%s larger than %.0f mm" % (name, P["PART_MAX"]))
        if wide:
            bad_print.append(name)
        if P["EXPORT"]:
            stl_dir = os.path.join(P["OUT_DIR"], "stl")
            if not os.path.isdir(stl_dir):
                os.makedirs(stl_dir)
            B.write_stl(brep, os.path.join(stl_dir, name.lower() + ".stl"), xf)
    if bad_print:
        failures.append("needs support: %s" % ", ".join(bad_print))

    if P["EXPORT"]:
        stl_dir = os.path.join(P["OUT_DIR"], "stl")
        names = set(n.lower() + ".stl" for _, n, _ in parts)
        for f in os.listdir(stl_dir):
            if f.endswith(".stl") and f not in names:
                os.remove(os.path.join(stl_dir, f))      # a part that no longer exists
        B.write_step(os.path.join(P["OUT_DIR"], "phone-stand-pan-tilt.rhino.step"), [(n, b) for _, n, b in parts])
        report.append("phone-stand-pan-tilt.rhino.step written")

    if P["POSE_DIR"]:
        write_poses(dict(named), dict(roll=roll_servo, tilt=tilt_servo, pan=pan_servo, bearing_a=bearing_a,
                                      bearing_b=bearing_b, phone=phone))
        report.append("poses written to %s" % P["POSE_DIR"])

    report.append("checks: %s" % ("all passed" if not failures else "FAILED: " + ", ".join(failures)))
    doc.Views.Redraw()
    print("\n".join(report))


TILTING = ("Drum", "Trunnion")
ROLLING = ("Plate", "Index", "Head")
PANNING = ("Column", "Arm", "Cover", "Plug")


def write_poses(parts, refs):
    """Posed meshes for the renders: neutral, tilted back, panned in landscape, exploded, and a section."""
    poses = [("neutral", 0.0, 0.0, 0.0, False), ("tilt30", 0.0, 30.0, 0.0, True),
             ("pan45-landscape", 45.0, 0.0, -90.0, True)]
    for name, p, t, r, with_phone in poses:
        out = os.path.join(P["POSE_DIR"], name)
        os.makedirs(out, exist_ok=True)
        xp, xt, xr = pan_xf(p), tilt_xf(t), roll_xf(r)
        for n, b in parts.items():
            xf = Transform.Identity
            if n in PANNING:
                xf = xp
            if n in TILTING:
                xf = xp * xt
            if n in ROLLING:
                xf = xp * xt * xr
            write_world_stl(moved(b, xf), os.path.join(out, n + ".stl"))
        if with_phone:
            write_world_stl(moved(refs["phone"], xp * xt * xr), os.path.join(out, "Phone.stl"))
    # exploded: every part moved off along its own axis, the servos and bearings shown
    out = os.path.join(P["POSE_DIR"], "exploded")
    os.makedirs(out, exist_ok=True)
    off = {"Base": (0, 0, -60), "Lid": (0, 0, -95), "Column": (0, 0, -25), "Arm": (40, 0, 0), "Cover": (110, 0, 0),
           "Plug": (0, 0, 20), "Drum": (-30, 0, 0), "Trunnion": (5, 0, 0), "Plate": (-30, 60, 0),
           "Index": (-30, 80, 0), "Head": (-30, 105, 0)}
    ref_off = {"ServoTilt": ("tilt", (80, 0, 0)), "ServoPan": ("pan", (0, 0, -35)), "ServoRoll": ("roll", (-30, 0, 0)),
               "BearingInner": ("bearing_a", (15, 0, 0)), "BearingOuter": ("bearing_b", (25, 0, 0))}
    for n, b in parts.items():
        write_world_stl(moved(b, Transform.Translation(*off[n])), os.path.join(out, n + ".stl"))
    for n, (key, o) in ref_off.items():
        write_world_stl(moved(refs[key], Transform.Translation(*o)), os.path.join(out, n + ".stl"))
    # section: the front cut away, on the pan axis's plane up to the bar and on the tilt axis's above it
    out = os.path.join(P["POSE_DIR"], "section")
    os.makedirs(out, exist_ok=True)
    zc = Z_BAR + BAR_R + 1.0
    keep = union([box(-200, 200, -100, PAN_Y, -10, zc + 0.5), box(-200, 200, -100, TY, zc, 300)], "section keep")
    items = list(parts.items()) + [("ServoTilt", refs["tilt"]), ("ServoPan", refs["pan"]),
                                   ("ServoRoll", refs["roll"]), ("BearingInner", refs["bearing_a"]),
                                   ("BearingOuter", refs["bearing_b"])]
    for n, b in items:
        res = Brep.CreateBooleanIntersection(b, keep, TOL)
        if not res:
            continue
        for i, piece in enumerate(res):
            write_world_stl(piece, os.path.join(out, "%s.%d.stl" % (n, i)))


main()
