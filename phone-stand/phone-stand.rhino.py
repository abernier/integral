"""
Motorized phone stand (portrait <-> landscape) - parametric Rhino model.

Run inside Rhino 8/9 (CPython 3, RhinoCommon):

    RunPythonScript <this folder>/phone-stand.rhino.py

Re-runnable: it wipes the objects on its own layers and rebuilds everything
from the parameters below. With EXPORT on, it writes, next to this file:

  phone-stand.rhino.step  the ten printed parts as named solids (Base, Column,
                          Drum, Ball, Shoe, Knob, Plate, Head, Lid, Index), the
                          part's master geometry,
                          in git; turned half a turn about Z so the phone faces
                          -Y, the repository's front (the build imports it as it is)
  stl/<part>.stl          print-ready meshes in print orientation, generated,
                          out of git

Frame: mm, Z up, desk at Z=0, phone faces +Y (user at +Y), rotation axis is
parallel to Y through (X=0, Z=AXIS_Z).

Design: after the Braun product language of the 1960s and 70s (Dieter Rams,
Dietrich Lubs): circles and cylinders only, one body colour and one accent on
the one functional detail, here the orientation index. A low disc base, a slim
column with a flat back, a drum that encloses the servo; the turning plate is a
dial set flush in the drum's face behind a thin shadow gap, its orange index
pointing at one of two notches in the rim (portrait, landscape). Proportions:
base diameter : drum diameter = drum diameter : visible column = phi; column
width = drum diameter / pi; the support under the drum is one drum diameter
tall, the socket collar half one wide. No fastener shows from the front or the
sides: the column is screwed from inside the base's bay, the lid from below,
the servo behind the plate, the ball under the drum's belly; the one control,
the joint's knob, and the one cable leave at the back.

Ball joint: under the servo, between the column and the drum, so the whole drum
(servo, dial, head, phone) aims about the ball's centre while the servo still
turns the phone about the normal to its screen (a joint between dial and head
would swing the phone off-axis between portrait and landscape). A hollow ball
hangs from the drum's belly on a neck; the column's collar is the socket. One
knob at the back drives an M4 screw (heat-set insert in the collar) onto a
printed shoe, which presses the ball against the socket's front: a friction
lock on all three axes. The neck meeting the socket's rim stops the tilt at
TILT_MAX in every direction; swivel is free. The servo lead runs through the
drum's belly, the hollow ball and a 45 deg cone into the column's channel.

Parts (layers):
  SERVO_REF          reference only, MG996R-class servo + round horn
  DRUM               printed - holds the servo by its flange on a bulkhead
                     inside, carries the stop block; the ball screws under it
  COLUMN             printed - column + socket collar; screwed onto the base
                     from below
  BALL               printed - hollow ball, neck and flange (2 x M3 into the drum)
  SHOE               printed - pad between the knob's screw and the ball
  KNOB               printed - knurled knob, an M4 hex head pressed in
  PLATE              printed - the dial: turning disc bolted to the servo horn,
                     flush in the drum face, carries the stop tabs
  INDEX              printed - accent key pressed into the dial face
  BASE               printed - electronics bay, ballast cavity, tripod nut trap, feet
  LID                printed - ballast cavity lid (M3, from below)
  HEAD               printed - Quad Lock compatible head (vendor STEP, jimmysinkers,
                     CC BY 4.0) + 2 anti-rotation pins added on its back
  PHONE_ENVELOPE     reference - phone in portrait and landscape
  REF_CURVES         reference - swept circle of the phone

Print orientations used for STL export (no supports anywhere):
  base upside down (top face on bed), drum on its flat back face, column upside
  down (collar top face on bed: the socket narrows away from the bed at 45 deg at
  most), ball upright on its flat bottom (the flat is cut where the sphere would
  overhang past 45 deg, the flange rises from the neck on a 45 deg cone), shoe
  and knob on their backs, plate dial face down, index on its side, lid flat, head lug
  face down (the vendor's own print-in-place orientation: the sliding sleeve
  and its 45 deg flange chamfer only print without support that way).

Head mounting (plate <-> head are two parts on purpose):
  The head is a print-in-place mechanism: a fixed core (back boss, cone, spring
  hub, front plunger disc) and an axially sliding release sleeve (lugs + wall +
  flange) joined only by the ortho-planar spring. The sleeve flange must stay
  free to travel back toward the plate, so nothing may be fused around the
  boss. Fusing head + plate also leaves no support-free print orientation. So
  the head stays a separate part, fixed by one M3 button-head screw from the
  plate back into the head's central 2.8 mm hole (thread-forming), with 2
  printed pins on the head back in 2 blind holes in the plate front for
  anti-rotation (the Quad Lock twist torque). The horn then screws onto the
  plate back, over that screw head, and the plate goes onto the spline last.
  Consequence: the servo spline screw is not used; the rotor is held on the
  spline by the horn clamp only (see report).
"""

import math
import os
import struct

import System
import Rhino
from Rhino.Geometry import (
    Point3d, Vector3d, Plane, Circle, Cylinder, BoundingBox, Brep, Transform,
    Line, Polyline, PolylineCurve, Curve, Surface, Mesh, MeshingParameters,
    VolumeMassProperties, RevSurface, ArcCurve, Arc,
)
from System.Collections.Generic import List

try:
    doc = __rhino_doc__  # injected by the Rhino MCP script runner
except NameError:
    doc = Rhino.RhinoDoc.ActiveDoc

# Every path is relative to this file's folder (the part's folder).
HERE = os.path.dirname(os.path.abspath(__file__))

# --------------------------------------------------------------------------
# Parameters
# --------------------------------------------------------------------------
P = dict(
    OUT_DIR=HERE,
    EXPORT=True,

    # print / fit
    CLR=0.25,                 # clearance on fits
    M3_CLEAR=3.2,             # M3 through hole
    M3_INSERT=4.0,            # M3 heat-set insert hole
    M3_INSERT_DEPTH=6.0,
    SHADOW_GAP=0.75,          # visible gap between parts that meet (plate in drum, column in base)

    # phone envelope (case included)
    PHONE_L=155.0, PHONE_W=75.0, PHONE_T=12.0,
    CLEAR_MARGIN=8.0,         # required gap below the swept circle

    # base: a low disc (Y=0 is the stand's back reference)
    BASE_R=71.0,              # 142 = 88 * phi (drum diameter)
    BASE_CY=70.0,             # disc centre (Y)
    BASE_H=22.0,
    BASE_TOP_CHAMFER=3.0,     # 45 deg, prints on the bed (no overhang, unlike a round)
    BASE_FOOT_CHAMFER=1.0,
    BASE_TOP_SKIN=4.0,
    BASE_WALL=3.0,
    AXIS_ABOVE_BASE=132.0,    # axis height above base top: the support under the drum shows 88, the drum's diameter

    # electronics bay (open to the bottom, at the back of the disc)
    BAY_X=(-34.0, 34.0), BAY_Y_MAX=62.0,
    # ESP32 DevKit lying across the bay (clearance box, X along its length); its own
    # USB port is reached from below, through the open bay, for flashing
    ESP32_L=56.0, ESP32_W=29.0, ESP32_H=15.0,
    ESP32_X0=-28.0, ESP32_Y0=16.0,
    # the one cable: 5 V USB-C breakout, a stadium port centred at the back, under the column
    PWR_W=12.5, PWR_H=7.0, PWR_X=0.0, PWR_ZC=9.0,

    # ballast cavity + round lid, ahead of the bay
    BALLAST_CY=98.0, BALLAST_R=26.0,
    LID_R=34.0, LID_T=3.0,
    LID_SCREW_R=30.0, LID_SCREW_ANGLES=(45.0, 135.0, 225.0, 315.0),
    LID_CBORE_D=6.0, LID_CBORE_DEPTH=1.7,
    BALLAST_G=150.0,          # assumed ballast mass for the CoM estimate

    # tripod 1/4"-20 nut trap
    NUT_AF=11.1, NUT_H=5.6, TRIPOD_HOLE=6.6, TRIPOD_BOSS_D=24.0,
    TRIPOD_FLOOR=3.0,         # boss material under the nut (takes the tripod pull)

    # rubber feet
    FOOT_D=10.0, FOOT_DEPTH=1.0, FOOT_R=60.0, FOOT_ANGLES=(45.0, 135.0, 225.0, 315.0),

    # servo (MG996R class) - servo frame: L along Z, W along X, H along Y
    SERVO_L=40.7, SERVO_W=19.7, SERVO_H=42.9,
    FLANGE_L=54.5, FLANGE_T=2.5, FLANGE_Z_FROM_BOTTOM=27.0,
    FLANGE_HOLE_D=4.5, FLANGE_HOLES_L=49.5, FLANGE_HOLES_W=10.0,
    SHAFT_FROM_END=10.0,
    SERVO_BOSS_D=13.0, SERVO_BOSS_H=1.5,     # gear housing boss on top face
    HORN_D=20.0, HORN_T=2.5, HORN_HUB_D=9.0,
    HORN_TOP_ABOVE_BODY=8.0,                 # horn front face above servo top face
    SERVO_G=55.0,

    # body: column + drum
    DRUM_D=88.0,              # holds the servo with its flange (corner at R 38.9)
    DRUM_BACK_Y=8.0,          # flat back of drum and column, the body's print face
    DRUM_FRONT_ROUND=2.0,     # outer front edge of the drum
    BULKHEAD_FRONT_Y=38.0,    # flange seat: the servo goes in from the front
    BORE_R=40.0,              # the drum's front opening, servo and flange pass through
    COLUMN_W=28.0,            # D section: flat back, half-round front (88 / pi)
    COLUMN_RECESS=1.0,        # column foot sunk into a socket in the base top
    SERVO_SCREW_PILOT=3.4,    # M4 self-tapping pilot (or M3 + nut)
    SERVO_SCREW_DEPTH=12.0,
    COLUMN_INSERTS=[(-9.0, 13.0), (9.0, 13.0), (0.0, 32.0)],
    CABLE_X=10.0, CABLE_Y=(18.0, 28.0),     # the servo lead's channel down the column, into the bay
    DRUM_CABLE_D=10.5,        # the lead's hole from the servo pocket down through the drum's belly

    # ball joint, under the drum: the ball hangs from the drum, the socket caps the
    # column, so the whole drum (servo, dial, head, phone) aims about the ball's
    # centre and the servo still turns the phone about the screen's normal.
    PIVOT_Y=23.0,             # ball centre (X=0); its height follows from the drum: AXIS_Z - DRUM_R - NECK_TO_DRUM
    NECK_TO_DRUM=24.0,        # ball centre to the drum's lowest line
    BALL_D=24.0,
    BALL_CLR=0.15,            # socket radius over the ball's: a friction joint, close fitting
    BALL_FLAT_LAT=45.0,       # the ball's bottom is cut flat at this latitude: prints upright without support
    BALL_BORE=10.5,           # hollow ball: the servo lead's JR plug (about 15 x 7.6 x 3.9) passes lengthwise
    NECK_D=14.0,              # its contact with the socket rim is the tilt stop
    BALL_FLANGE_D=26.0,       # neck flange, set in a recess in the drum's belly
    BALL_FLANGE_T=3.0,        # flange depth into the drum
    BALL_FLANGE_CONE=6.0,     # 45 deg cone from the neck out to the flange (no overhang upright)
    BALL_SCREW_R=9.75,        # 2 x M3 from below, through the flange into inserts in the drum
    BALL_SCREW_CB_D=6.0,
    COLLAR_D=44.0,            # socket collar on the column top, half the drum's diameter
    COLLAR_DOWN=13.0,         # collar below the ball centre
    COLLAR_UP=7.0,            # collar above the ball centre
    TILT_MAX=31.0,            # physical tilt limit, any direction: sets the rim height (neck on rim)
    RIM_FLARE=40.0,           # the socket mouth flares above the rim (deg from vertical), > TILT_MAX
    CABLE_CONE_FLOOR=11.0,    # the lead's 45 deg cone under the ball, down to the column channel
    # lock: one knob at the back; its M4 screw, in a heat-set insert in the collar's back
    # wall, pushes a printed shoe onto the ball (the shoe sits above the ball's equator:
    # it also keeps the ball in the socket when the knob is loose)
    SHOE_Z=1.5,               # shoe axis above the ball centre
    SHOE_D=7.4, SHOE_BORE=7.6, SHOE_TRAVEL=0.35,
    KNOB_INSERT_D=5.6, KNOB_INSERT_DEPTH=5.0,   # M4 heat-set insert
    KNOB_D=12.0, KNOB_L=9.0, KNOB_GAP=1.0, KNOB_FLUTES=12, KNOB_FLUTE_R=0.9,
    KNOB_HEX_AF=7.15, KNOB_HEX_DEPTH=3.0,      # M4 x 6 hex head screw pressed into the knob
    # holding torque estimate (assumptions)
    MU_PETG=0.3,              # PETG on PETG, dry, static (conservative)
    KNOB_TORQUE=0.25,         # N m, a finger-tight turn of a 12 mm knob
    SCREW_K=0.2,              # nut factor, steel screw in a brass insert
    SCREW_D=4.0,
    TAP_N=3.0,                # a firm tap on the screen, at the phone's top edge
    # required range (the physical cone is TILT_MAX all round, swivel is free)
    TILT_SPEC=(-15.0, 30.0),  # pitch: + leans the screen back
    SWIVEL_SPEC=45.0,
    TIP_MARGIN_MIN=10.0,      # CoM to the base rim, at worst, inside the required range
    CABLE_ENV_D=4.0,          # the servo lead's envelope for the pinch check
    NOTCH_W=1.6, NOTCH_DEPTH=1.0,           # portrait / landscape notches in the drum rim
    NOTCH_PHI=(90.0, 0.0),                 # plate-local angles the index meets at 0 and -90

    # rotating plate (the dial), flush in the drum face
    PLATE_T=6.0,
    PLATE_FRONT_ROUND=0.6,
    HORN_RECESS_D=20.5, HORN_RECESS_DEPTH=1.5,
    HORN_HOLE_D=2.4, HORN_HOLE_BC=14.0, HORN_HOLE_N=4,
    DIAL_RING_R=25.0, DIAL_RING_W=0.8, DIAL_RING_DEPTH=0.5,   # fine groove framing the head
    # head fixing: central M3 button head (ISO 7380) from the back, counterbored
    # into the horn recess floor, + 2 anti-rotation pins on the head back
    M3_HEAD_CLEAR=3.2,
    HEAD_SCREW_CB_D=6.2, HEAD_SCREW_CB_DEPTH=2.0,
    PIN_D=3.0, PIN_H=2.5, PIN_HOLE_D=3.5, PIN_HOLE_DEPTH=3.0,
    PIN_R=11.0, PIN_ANGLES=(45.0, 225.0),   # plate-local, from +X toward +Z

    # orientation index: accent key pressed into the dial face, at portrait it points up
    INDEX_PHI=90.0, INDEX_R=(27.5, 36.5), INDEX_W=3.2, INDEX_DEPTH=2.0, INDEX_FIT=0.08,

    # mechanical stops: 2 tabs on the plate back, 1 block hanging from the bore wall
    STOP_R=(27.0, 41.0), STOP_HALF_W=3.0, STOP_GAP_TO_PLATE=3.0,
    TAB_R=(24.0, 37.5), TAB_HALF_W=2.0, TAB_LEN=5.0,
    # plate travel, model angle: 0 is portrait, -90 landscape. A negative model
    # angle turns the phone counter-clockwise as seen by the user (who looks
    # along -Y): the stand's angle (protocol.md) is minus the model's.
    ROT_RANGE=(-90.0, 0.0), OVERTRAVEL=5.0,

    # Quad Lock head (vendor STEP, file frame: axis Z, lug face z=0, back z=HEAD_T)
    HEAD_STEP="vendor/quadlock-jimmysinkers/integrated_quadlock_v4.stp",
    HEAD_T=23.0,              # checked against the STEP bounding box at import
    HEAD_SPIN=0.0,            # extra rotation about the axis (deg); lugs on +-X / +-Z at 0
    HEAD_G=20.0,              # ~15.3 cm3 of PETG, near solid

    # masses for CoM estimate
    PETG_DENSITY=1.27e-3,     # g/mm3
    PRINT_FILL=0.45,          # effective solid fraction (walls + infill)
    PHONE_G=250.0,
)

TOL = doc.ModelAbsoluteTolerance

# --------------------------------------------------------------------------
# Derived values
# --------------------------------------------------------------------------
BASE_TOP = P["BASE_H"]
AXIS_Z = BASE_TOP + P["AXIS_ABOVE_BASE"]
DRUM_R = P["DRUM_D"] / 2.0
FLANGE_BACK_Y = P["BULKHEAD_FRONT_Y"]              # flange rests on the bulkhead
SERVO_BOTTOM_Y = FLANGE_BACK_Y - P["FLANGE_Z_FROM_BOTTOM"]
SERVO_TOP_Y = SERVO_BOTTOM_Y + P["SERVO_H"]
SERVO_TOP_Z = AXIS_Z + P["SHAFT_FROM_END"]          # shaft end of the servo points up
SERVO_BOT_Z = SERVO_TOP_Z - P["SERVO_L"]
SERVO_MID_Z = (SERVO_TOP_Z + SERVO_BOT_Z) / 2.0
HORN_TOP_Y = SERVO_TOP_Y + P["HORN_TOP_ABOVE_BODY"]
PLATE_BACK_Y = HORN_TOP_Y - P["HORN_RECESS_DEPTH"]
PLATE_FRONT_Y = PLATE_BACK_Y + P["PLATE_T"]
PLATE_R = P["BORE_R"] - P["SHADOW_GAP"]
DRUM_FRONT_Y = PLATE_FRONT_Y                       # the dial sits flush in the drum face
HEAD_FRONT_Y = PLATE_FRONT_Y + P["HEAD_T"]       # lug / plunger face of the head
PHONE_Y0 = HEAD_FRONT_Y
PHONE_Y1 = PHONE_Y0 + P["PHONE_T"]
COLUMN_BOTTOM_Z = BASE_TOP - P["COLUMN_RECESS"]
SWEPT_R = 0.5 * math.hypot(P["PHONE_L"], P["PHONE_W"])
CAVITY_TOP_Z = BASE_TOP - P["BASE_TOP_SKIN"]
FLANGE_CORNER_R = math.hypot(P["SERVO_W"] / 2.0, P["FLANGE_L"] / 2.0 + (AXIS_Z - SERVO_MID_Z))

DRUM_BOTTOM_Z = AXIS_Z - DRUM_R                    # the drum's lowest line (X=0)
PIVOT_Z = DRUM_BOTTOM_Z - P["NECK_TO_DRUM"]
PIVOT = Point3d(0, P["PIVOT_Y"], PIVOT_Z)
BALL_R = P["BALL_D"] / 2.0
SOCKET_R = BALL_R + P["BALL_CLR"]
BALL_FLAT_Z = PIVOT_Z - BALL_R * math.sin(math.radians(P["BALL_FLAT_LAT"]))
COLLAR_R = P["COLLAR_D"] / 2.0
COLLAR_BACK_Y = P["PIVOT_Y"] - COLLAR_R
SHOE_ZC = PIVOT_Z + P["SHOE_Z"]


def rim_height():
    """Height of the socket rim above the ball centre at which the neck meets it at TILT_MAX.

    The rim edge is the circle (SOCKET_R, h); the neck a cylinder of radius
    NECK_D/2 about the tilted axis. Contact when the edge point's distance to
    the axis, rho sin(phi - theta), equals the neck's radius (phi the edge's
    angle from vertical, rho its distance to the centre).
    """
    rn, th = P["NECK_D"] / 2.0, math.radians(P["TILT_MAX"])
    lo, hi = 0.0, SOCKET_R
    for _ in range(60):
        h = (lo + hi) / 2.0
        rho, phi = math.hypot(SOCKET_R, h), math.atan2(SOCKET_R, h)
        if rho * math.sin(phi - th) > rn:   # still free at TILT_MAX: the rim may rise
            lo = h
        else:
            hi = h
    return (lo + hi) / 2.0


RIM_H = rim_height()

AX = Point3d(0, 0, AXIS_Z)
ROT_AXIS = Vector3d(0, -1, 0)   # positive angle: +X rotates toward +Z (phi increases)

# --------------------------------------------------------------------------
# Geometry helpers
# --------------------------------------------------------------------------


def box(x0, x1, y0, y1, z0, z1):
    return BoundingBox(Point3d(min(x0, x1), min(y0, y1), min(z0, z1)),
                       Point3d(max(x0, x1), max(y0, y1), max(z0, z1))).ToBrep()


def cyl_y(cx, cz, r, y0, y1):
    pl = Plane(Point3d(cx, y0, cz), Vector3d(0, 1, 0))
    return Cylinder(Circle(pl, r), y1 - y0).ToBrep(True, True)


def cyl_z(cx, cy, r, z0, z1):
    pl = Plane(Point3d(cx, cy, z0), Vector3d(0, 0, 1))
    return Cylinder(Circle(pl, r), z1 - z0).ToBrep(True, True)


def solid(brep):
    if brep.SolidOrientation == Rhino.Geometry.BrepSolidOrientation.Inward:
        brep.Flip()
    return brep


def extrude_z(curve, z0, z1):
    c = curve.DuplicateCurve()
    c.Translate(Vector3d(0, 0, z0 - c.PointAtStart.Z))
    srf = Surface.CreateExtrusion(c, Vector3d(0, 0, z1 - z0))
    return solid(srf.ToBrep().CapPlanarHoles(TOL))


def revolve(corners, to3d, axis_from, axis_to):
    """Solid of revolution of an open 2D profile that starts and ends on the axis.

    corners: [(u, v, r)], r the radius rounding that corner (0: sharp); to3d maps
    (u, v) to a Point3d. Each line and arc revolves into its own face, then the
    faces are joined (one face for the whole profile defeats the booleans).
    """
    pts = [(u, v) for (u, v, _) in corners]
    segs = []   # 2D pieces: ("line", a, b) or ("arc", a, tangent, b)
    cur = pts[0]
    for i in range(1, len(pts)):
        r = corners[i][2]
        if r and i < len(pts) - 1:
            s, e, t = fillet_points(pts[i - 1], pts[i], pts[i + 1], r)
            segs.append(("line", cur, s))
            segs.append(("arc", s, t, e))
            cur = e
        else:
            segs.append(("line", cur, pts[i]))
            cur = pts[i]
    axis = Line(axis_from, axis_to)
    faces = []
    for seg in segs:
        if seg[0] == "line":
            a, b = seg[1], seg[2]
            if math.hypot(b[0] - a[0], b[1] - a[1]) < 1e-9:
                continue
            crv = Rhino.Geometry.LineCurve(to3d(*a), to3d(*b))
        else:
            _, a, t, b = seg
            p0 = to3d(*a)
            tv = to3d(a[0] + t[0], a[1] + t[1]) - p0
            crv = ArcCurve(Arc(p0, tv, to3d(*b)))
        faces.append(Brep.CreateFromRevSurface(RevSurface.Create(crv, axis), False, False))
    joined = Brep.JoinBreps(blist(faces), TOL)
    if joined is None or len(joined) != 1 or not joined[0].IsSolid:
        raise RuntimeError("revolve: not one closed solid")
    return solid(joined[0])


def fillet_points(p_prev, p, p_next, r):
    """Tangent points (start, end) and start tangent of an arc of radius r rounding corner p (2D)."""
    ax, ay = p_prev[0] - p[0], p_prev[1] - p[1]
    bx, by = p_next[0] - p[0], p_next[1] - p[1]
    la, lb = math.hypot(ax, ay), math.hypot(bx, by)
    ax, ay, bx, by = ax / la, ay / la, bx / lb, by / lb
    half = math.acos(max(-1.0, min(1.0, ax * bx + ay * by))) / 2.0
    d = r / math.tan(half)
    s = (p[0] + ax * d, p[1] + ay * d)
    e = (p[0] + bx * d, p[1] + by * d)
    return s, e, (-ax, -ay)


def d_section(hw, y0, z, grow=0.0):
    """Closed D curve in the XY plane at height z: flat back at y0, half-round front of radius hw."""
    w = hw + grow
    yb = y0 - grow
    yc = y0 + hw
    back = PolylineCurve([Point3d(-w, yc, z), Point3d(-w, yb, z), Point3d(w, yb, z), Point3d(w, yc, z)])
    front = ArcCurve(Arc(Point3d(w, yc, z), Point3d(0, yc + w, z), Point3d(-w, yc, z)))
    return Curve.JoinCurves([back, front])[0]


def hex_prism_z(cx, cy, af, z0, z1):
    rc = af / math.sqrt(3.0)          # circumradius; vertices on +/-Y, flats normal to X
    pts = [Point3d(cx + rc * math.cos(math.radians(90 + 60 * k)),
                   cy + rc * math.sin(math.radians(90 + 60 * k)), z0) for k in range(7)]
    return extrude_z(PolylineCurve(pts), z0, z1)


def blist(items):
    lst = List[Brep]()
    for b in items:
        lst.Add(b)
    return lst


def union(items, label):
    if len(items) == 1:
        return items[0]
    res = Brep.CreateBooleanUnion(blist(items), TOL)
    if res is None or len(res) != 1:
        raise RuntimeError("union failed: %s (%s)" % (label, None if res is None else len(res)))
    return res[0]


def diff(target, cutters, label):
    res = Brep.CreateBooleanDifference(blist([target]), blist(cutters), TOL)
    if res is None or len(res) != 1:
        raise RuntimeError("difference failed: %s (%s)" % (label, None if res is None else len(res)))
    return res[0]


def inter(a, b, label):
    res = Brep.CreateBooleanIntersection(a, b, TOL)
    if res is None or len(res) != 1:
        raise RuntimeError("intersection failed: %s (%s)" % (label, None if res is None else len(res)))
    return res[0]


def rotated(brep, deg):
    b = brep.DuplicateBrep()
    b.Transform(Transform.Rotation(math.radians(deg), ROT_AXIS, AX))
    return b


def polar(phi, r):
    """Point (x, z) at plate-local angle phi (deg, from +X toward +Z) and radius r about the axis."""
    a = math.radians(phi)
    return r * math.cos(a), AXIS_Z + r * math.sin(a)


def radial_key(phi, r0, r1, half_w, y0, y1):
    """Box from r0 to r1 along the radius at angle phi, half_w wide, Y from y0 to y1."""
    k = box(r0, r1, y0, y1, AXIS_Z - half_w, AXIS_Z + half_w)
    return rotated(k, phi)


def volume_centroid(brep):
    vmp = VolumeMassProperties.Compute(brep)
    return vmp.Volume, vmp.Centroid


# --------------------------------------------------------------------------
# 1. SERVO_REF
# --------------------------------------------------------------------------
def build_servo():
    hw = P["SERVO_W"] / 2.0
    body = box(-hw, hw, SERVO_BOTTOM_Y, SERVO_TOP_Y, SERVO_BOT_Z, SERVO_TOP_Z)
    fl = P["FLANGE_L"] / 2.0
    flange = box(-hw, hw, FLANGE_BACK_Y, FLANGE_BACK_Y + P["FLANGE_T"],
                 SERVO_MID_Z - fl, SERVO_MID_Z + fl)
    boss = cyl_y(0, AXIS_Z, P["SERVO_BOSS_D"] / 2.0, SERVO_TOP_Y - 0.5, SERVO_TOP_Y + P["SERVO_BOSS_H"])
    hub = cyl_y(0, AXIS_Z, P["HORN_HUB_D"] / 2.0, SERVO_TOP_Y + P["SERVO_BOSS_H"] - 0.5, HORN_TOP_Y)
    horn = cyl_y(0, AXIS_Z, P["HORN_D"] / 2.0, HORN_TOP_Y - P["HORN_T"], HORN_TOP_Y)
    servo = union([body, flange, boss, hub, horn], "servo")
    holes = []
    for sz in (-1, 1):
        for sx in (-1, 1):
            holes.append(cyl_y(sx * P["FLANGE_HOLES_W"] / 2.0,
                               SERVO_MID_Z + sz * P["FLANGE_HOLES_L"] / 2.0,
                               P["FLANGE_HOLE_D"] / 2.0, FLANGE_BACK_Y - 1, FLANGE_BACK_Y + P["FLANGE_T"] + 1))
    return diff(servo, holes, "servo flange holes")


# --------------------------------------------------------------------------
# 2. BODY: column + drum
# --------------------------------------------------------------------------
def stop_block(y0):
    hw = P["STOP_HALF_W"]
    return box(-hw, hw, y0, PLATE_BACK_Y - P["STOP_GAP_TO_PLATE"],
               AXIS_Z + P["STOP_R"][0], AXIS_Z + P["STOP_R"][1])


def build_drum():
    c = P["CLR"]
    yb, yf, R = P["DRUM_BACK_Y"], DRUM_FRONT_Y, DRUM_R
    # drum: revolved about the axis, its outer front edge rounded
    body = revolve([(0, yb, 0), (R, yb, 0), (R, yf, P["DRUM_FRONT_ROUND"]), (0, yf, 0)],
                   lambda u, v: Point3d(u, v, AXIS_Z), Point3d(0, 0, AXIS_Z), Point3d(0, 1, AXIS_Z))

    cutters = []
    # the ball's neck flange: a round recess in the belly, its 2 inserts, the lead's hole
    py, zb = P["PIVOT_Y"], DRUM_BOTTOM_Z
    cutters.append(cyl_z(0, py, P["BALL_FLANGE_D"] / 2.0 + c, zb - 6.0, zb + P["BALL_FLANGE_T"]))
    for sx in (-1, 1):
        cutters.append(cyl_z(sx * P["BALL_SCREW_R"], py, P["M3_INSERT"] / 2.0,
                             zb, zb + P["BALL_FLANGE_T"] + P["M3_INSERT_DEPTH"]))
    cutters.append(cyl_z(0, py, P["DRUM_CABLE_D"] / 2.0, zb - 1.0, SERVO_BOT_Z))
    # front bore down to the bulkhead (servo and flange go in from the front)
    cutters.append(cyl_y(0, AXIS_Z, P["BORE_R"], FLANGE_BACK_Y, yf + 1))
    # servo body pocket, behind the bulkhead face
    sw = P["SERVO_W"] / 2.0 + c
    cutters.append(box(-sw, sw, SERVO_BOTTOM_Y - c, FLANGE_BACK_Y + 1,
                       SERVO_BOT_Z - c, SERVO_TOP_Z + c))
    # flange screw pilots into the bulkhead
    for sz in (-1, 1):
        for sx in (-1, 1):
            cutters.append(cyl_y(sx * P["FLANGE_HOLES_W"] / 2.0,
                                 SERVO_MID_Z + sz * P["FLANGE_HOLES_L"] / 2.0,
                                 P["SERVO_SCREW_PILOT"] / 2.0,
                                 FLANGE_BACK_Y - P["SERVO_SCREW_DEPTH"], FLANGE_BACK_Y + 1))
    # portrait / landscape notches in the rim face
    for phi in P["NOTCH_PHI"]:
        cutters.append(radial_key(phi, P["BORE_R"] - 1.0, R + 1.0, P["NOTCH_W"] / 2.0,
                                  yf - P["NOTCH_DEPTH"], yf + 1))
    body = diff(body, cutters, "drum cuts")
    # stop block, hanging from the bore wall at the top, in front of the bulkhead
    return union([body, stop_block(FLANGE_BACK_Y - 0.5)], "drum + stop")


# --------------------------------------------------------------------------
# 2b. BALL JOINT: column + socket collar, ball + neck, shoe, knob
# --------------------------------------------------------------------------
def revolve_z(corners):
    """Solid of revolution about the vertical through the ball centre: corners [(r, z, round)]."""
    py = P["PIVOT_Y"]
    return revolve(corners, lambda u, v: Point3d(u, py, v), Point3d(0, py, 0), Point3d(0, py, 1))


def sphere(c, r):
    return solid(Rhino.Geometry.Sphere(c, r).ToBrep())


def build_column():
    """The column, its foot in the base, capped by the socket collar.

    Printed upside down, the collar's top face on the bed: the socket's sphere
    narrows away from the bed (no overhang past 45 deg), the lead's cone widens
    away from it, and the collar overhangs nothing.
    """
    c = P["CLR"]
    py, pz = P["PIVOT_Y"], PIVOT_Z
    zb, zt = pz - P["COLLAR_DOWN"], pz + P["COLLAR_UP"]
    column = extrude_z(d_section(P["COLUMN_W"] / 2.0, P["DRUM_BACK_Y"], 0), COLUMN_BOTTOM_Z, zb + 1.0)
    collar = revolve_z([(0, zb, 0), (COLLAR_R, zb, 1.5), (COLLAR_R, zt - 1.0, 0), (COLLAR_R - 1.0, zt, 0), (0, zt, 0)])
    col = union([column, collar], "column + collar")

    rs, h = SOCKET_R, RIM_H
    flare_top = rs + (zt - (pz + h)) * math.tan(math.radians(P["RIM_FLARE"]))
    fl = P["CABLE_CONE_FLOOR"]
    cutters = [
        sphere(PIVOT, rs),
        # the socket's wall rises straight from the equator to the rim, then flares
        revolve_z([(0, pz, 0), (rs, pz, 0), (rs, pz + h, 0), (flare_top, zt + 0.01, 0),
                   (flare_top + 2.0, zt + 2.0, 0), (0, zt + 2.0, 0)]),
        # the lead's cone under the ball (apex on the ball centre), then the channel
        revolve_z([(0, pz, 0), (fl, pz - fl, 0), (0, pz - fl, 0)]),
    ]
    cx = P["CABLE_X"] / 2.0
    cutters.append(box(-cx, cx, P["CABLE_Y"][0], P["CABLE_Y"][1], COLUMN_BOTTOM_Z - 1, pz - fl + 0.5))
    # heat-set inserts in the column foot (screws from inside the base bay)
    for (x, y) in P["COLUMN_INSERTS"]:
        cutters.append(cyl_z(x, y, P["M3_INSERT"] / 2.0, COLUMN_BOTTOM_Z - 1,
                             COLUMN_BOTTOM_Z + P["M3_INSERT_DEPTH"]))
    # the lock: M4 insert from the collar's back, the shoe's bore on into the socket
    y_ins = COLLAR_BACK_Y + P["KNOB_INSERT_DEPTH"]
    cutters.append(cyl_y(0, SHOE_ZC, P["KNOB_INSERT_D"] / 2.0, COLLAR_BACK_Y - 1.0, y_ins + 0.01))
    cutters.append(cyl_y(0, SHOE_ZC, P["SHOE_BORE"] / 2.0, y_ins, py))
    return diff(col, cutters, "column cuts")


def build_ball():
    """Ball, neck and flange, one part printed upright on the ball's flat bottom."""
    py, pz, zb = P["PIVOT_Y"], PIVOT_Z, DRUM_BOTTOM_Z
    rn, rf, ft, fc = P["NECK_D"] / 2.0, P["BALL_FLANGE_D"] / 2.0, P["BALL_FLANGE_T"], P["BALL_FLANGE_CONE"]
    ball = inter(sphere(PIVOT, BALL_R), box(-BALL_R - 1, BALL_R + 1, py - BALL_R - 1, py + BALL_R + 1,
                                            BALL_FLAT_Z, pz + BALL_R + 1), "ball flat")
    neck = revolve_z([(0, pz + 5.0, 0), (rn, pz + 5.0, 0), (rn, zb - (rf - rn), 0), (rf, zb, 0),
                      (rf, zb + ft, 0), (0, zb + ft, 0)])
    if rf - rn != fc:
        raise RuntimeError("BALL_FLANGE_CONE must equal the flange's overhang (45 deg)")
    part = union([ball, neck], "ball + neck")
    cutters = [cyl_z(0, py, P["BALL_BORE"] / 2.0, BALL_FLAT_Z - 1, zb + ft + 1)]
    for sx in (-1, 1):
        x = sx * P["BALL_SCREW_R"]
        cutters.append(cyl_z(x, py, P["M3_CLEAR"] / 2.0, zb - 8.0, zb + ft + 1))
        cutters.append(cyl_z(x, py, P["BALL_SCREW_CB_D"] / 2.0, zb - fc, zb + 0.5))
    return diff(part, cutters, "ball cuts")


def build_shoe():
    """The pad the knob's screw pushes onto the ball: its face is the socket's sphere."""
    y0 = COLLAR_BACK_Y + P["KNOB_INSERT_DEPTH"] + P["SHOE_TRAVEL"]
    pad = cyl_y(0, SHOE_ZC, P["SHOE_D"] / 2.0, y0, P["PIVOT_Y"] - 4.0)
    # relief for the neck: above the cone it sweeps up to the tilt stop (apex on the ball
    # centre, half-angle TILT_MAX + 1.5 + the neck's angular radius at the socket)
    a = math.radians(P["TILT_MAX"] + 1.5) + math.asin(P["NECK_D"] / 2.0 / SOCKET_R)
    r1 = 2.0 * COLLAR_R
    relief = revolve_z([(0, PIVOT_Z, 0), (r1, PIVOT_Z + r1 / math.tan(a), 0), (0, PIVOT_Z + r1 / math.tan(a), 0)])
    return diff(pad, [sphere(PIVOT, SOCKET_R), relief], "shoe face")


def build_knob():
    """Knurled knob behind the collar, an M4 hex head pressed into its front face."""
    r, y1 = P["KNOB_D"] / 2.0, COLLAR_BACK_Y - P["KNOB_GAP"]
    y0 = y1 - P["KNOB_L"]
    knob = revolve([(0, y0, 0), (r - 0.6, y0, 0), (r, y0 + 0.6, 0), (r, y1 - 0.4, 0), (r - 0.4, y1, 0), (0, y1, 0)],
                   lambda u, v: Point3d(u, v, SHOE_ZC), Point3d(0, 0, SHOE_ZC), Point3d(0, 1, SHOE_ZC))
    cutters = [hex_prism_y(0, SHOE_ZC, P["KNOB_HEX_AF"], y1 - P["KNOB_HEX_DEPTH"], y1 + 1.0)]
    for k in range(P["KNOB_FLUTES"]):
        a = 2 * math.pi * k / P["KNOB_FLUTES"]
        cutters.append(cyl_y(r * math.cos(a), SHOE_ZC + r * math.sin(a), P["KNOB_FLUTE_R"], y0 - 1.0, y1 + 1.0))
    return diff(knob, cutters, "knob cuts")


def hex_prism_y(cx, cz, af, y0, y1):
    h = hex_prism_z(0, 0, af, 0, y1 - y0)
    h.Transform(Transform.Rotation(math.radians(-90.0), Vector3d(1, 0, 0), Point3d.Origin))   # +Z -> +Y
    h.Transform(Transform.Translation(cx, y0, cz))
    return h


# --------------------------------------------------------------------------
# 3. PLATE (built at rotation 0 = portrait) + INDEX
# --------------------------------------------------------------------------
def stop_contact_angles():
    """Return the plate-local angles (deg, from +X toward +Z) of the two tabs.

    The stop block is centred at phi=90. A radial tab of half-width w meets
    the block corner (STOP_HALF_W, STOP_R[0]) when the tab centreline is
    alpha - asin(w / rho) away from the block, alpha/rho being the corner's
    polar coordinates.
    """
    sx, sz = P["STOP_HALF_W"], P["STOP_R"][0]
    rho = math.hypot(sx, sz)
    alpha = math.degrees(math.atan2(sz, sx))
    contact_right = alpha - math.degrees(math.asin(P["TAB_HALF_W"] / rho))  # < 90
    contact_left = 180.0 - contact_right                                    # > 90
    lo, hi = P["ROT_RANGE"]
    ot = P["OVERTRAVEL"]
    tab_a = contact_right - (hi + ot)   # hits the stop's right face at theta = hi + ot
    tab_b = contact_left - (lo - ot)    # hits the stop's left face at theta = lo - ot
    return tab_a, tab_b, contact_right


def build_tab(phi):
    return radial_key(phi, P["TAB_R"][0], P["TAB_R"][1], P["TAB_HALF_W"],
                      PLATE_BACK_Y - P["TAB_LEN"], PLATE_BACK_Y + 0.5)


def index_pocket(grow):
    r0, r1 = P["INDEX_R"]
    return radial_key(P["INDEX_PHI"], r0 - grow, r1 + grow, P["INDEX_W"] / 2.0 + grow,
                      PLATE_FRONT_Y - P["INDEX_DEPTH"] - grow, PLATE_FRONT_Y + (1.0 if grow else 0.0))


def build_plate():
    yb, yf, r, rr = PLATE_BACK_Y, PLATE_FRONT_Y, PLATE_R, P["PLATE_FRONT_ROUND"]
    disc = revolve([(0, yb, 0), (r, yb, 0), (r, yf, rr), (0, yf, 0)],
                   lambda u, v: Point3d(u, v, AXIS_Z), Point3d(0, 0, AXIS_Z), Point3d(0, 1, AXIS_Z))
    tab_a, tab_b, _ = stop_contact_angles()
    plate = union([disc, build_tab(tab_a), build_tab(tab_b)], "plate + tabs")
    recess_floor = yb + P["HORN_RECESS_DEPTH"]
    cutters = [
        cyl_y(0, AXIS_Z, P["HORN_RECESS_D"] / 2.0, yb - 1, recess_floor),
        # head screw: M3 clearance + button-head counterbore from the recess floor
        cyl_y(0, AXIS_Z, P["M3_HEAD_CLEAR"] / 2.0, yb - 1, yf + 1),
        cyl_y(0, AXIS_Z, P["HEAD_SCREW_CB_D"] / 2.0, yb - 1, recess_floor + P["HEAD_SCREW_CB_DEPTH"]),
        index_pocket(P["INDEX_FIT"]),
    ]
    # the dial's fine ring, framing the head
    ring_out = cyl_y(0, AXIS_Z, P["DIAL_RING_R"] + P["DIAL_RING_W"] / 2.0, yf - P["DIAL_RING_DEPTH"], yf + 1)
    ring_in = cyl_y(0, AXIS_Z, P["DIAL_RING_R"] - P["DIAL_RING_W"] / 2.0, yf - P["DIAL_RING_DEPTH"] - 1, yf + 2)
    cutters.append(diff(ring_out, [ring_in], "dial ring"))
    for k in range(P["HORN_HOLE_N"]):
        a = math.radians(360.0 * k / P["HORN_HOLE_N"])
        rr_ = P["HORN_HOLE_BC"] / 2.0
        cutters.append(cyl_y(rr_ * math.cos(a), AXIS_Z + rr_ * math.sin(a), P["HORN_HOLE_D"] / 2.0,
                             yb - 1, yf - 1.5))   # blind pilots: the horn screws come from behind
    for (x, z) in pin_positions():
        cutters.append(cyl_y(x, z, P["PIN_HOLE_D"] / 2.0, yf - P["PIN_HOLE_DEPTH"], yf + 1))
    return diff(plate, cutters, "plate cuts")


def build_index():
    return index_pocket(0.0)


def pin_positions():
    return [polar(deg, P["PIN_R"]) for deg in P["PIN_ANGLES"]]


# --------------------------------------------------------------------------
# 4. BASE + LID
# --------------------------------------------------------------------------
def base_pt(r, deg):
    a = math.radians(deg)
    return r * math.cos(a), P["BASE_CY"] + r * math.sin(a)


def build_base(tripod_y):
    R, H, cy = P["BASE_R"], P["BASE_H"], P["BASE_CY"]
    ct, cf = P["BASE_TOP_CHAMFER"], P["BASE_FOOT_CHAMFER"]
    prof = [(0, 0, 0), (R - cf, 0, 0), (R, cf, 0), (R, H - ct, 0), (R - ct, H, 0), (0, H, 0)]
    base = revolve(prof, lambda u, v: Point3d(u, cy, v), Point3d(0, cy, 0), Point3d(0, cy, 1))
    lid_t = P["LID_T"]
    inner_r = R - P["BASE_WALL"]

    # tripod boss inside the ballast cavity
    boss = cyl_z(0, tripod_y, P["TRIPOD_BOSS_D"] / 2.0, lid_t, CAVITY_TOP_Z + 0.5)

    cutters = []
    # electronics bay, open to the bottom, inside the wall at the back of the disc
    bx = P["BAY_X"]
    bay = inter(box(bx[0], bx[1], cy - R - 5, P["BAY_Y_MAX"], -1, CAVITY_TOP_Z),
                cyl_z(0, cy, inner_r, -2, CAVITY_TOP_Z + 1), "bay")
    cutters.append(bay)
    # 5 V USB-C port through the back wall: a stadium, the stand's one cable exit
    cutters.append(power_port())
    # ballast cavity + lid recess
    cutters.append(cyl_z(0, P["BALLAST_CY"], P["BALLAST_R"], lid_t - 0.5, CAVITY_TOP_Z))
    cutters.append(cyl_z(0, P["BALLAST_CY"], P["LID_R"], -1, lid_t))
    for (x, y) in lid_screw_positions():
        cutters.append(cyl_z(x, y, P["M3_INSERT"] / 2.0, lid_t - 0.5, lid_t + P["M3_INSERT_DEPTH"]))
    # column socket (a shadow gap all round the column foot), screw holes, cable passage
    sock = extrude_z(d_section(P["COLUMN_W"] / 2.0, P["DRUM_BACK_Y"], 0, P["SHADOW_GAP"]),
                     COLUMN_BOTTOM_Z, H + 1)
    cutters.append(sock)
    for (x, y) in P["COLUMN_INSERTS"]:
        cutters.append(cyl_z(x, y, P["M3_CLEAR"] / 2.0, CAVITY_TOP_Z - 1, H + 1))
    cx = P["CABLE_X"] / 2 + P["CLR"]
    cutters.append(box(-cx, cx, P["CABLE_Y"][0] - P["CLR"], P["CABLE_Y"][1] + P["CLR"],
                       CAVITY_TOP_Z - 1, H + 1))
    # rubber feet recesses
    for deg in P["FOOT_ANGLES"]:
        x, y = base_pt(P["FOOT_R"], deg)
        cutters.append(cyl_z(x, y, P["FOOT_D"] / 2.0, -1, P["FOOT_DEPTH"]))

    base = diff(base, cutters, "base cavities")
    base = union([base, boss], "base + tripod boss")

    # 1/4"-20 nut trap: hex pocket above a floor, nut slides in sideways from the cavity
    nz0 = lid_t + P["TRIPOD_FLOOR"]
    nz1 = nz0 + P["NUT_H"] + P["CLR"]
    af = P["NUT_AF"] + 2 * P["CLR"]
    nut_cut = [
        hex_prism_z(0, tripod_y, af, nz0, nz1),
        box(-af / 2, af / 2, tripod_y, tripod_y + P["TRIPOD_BOSS_D"] / 2 + 4, nz0, nz1),
        cyl_z(0, tripod_y, P["TRIPOD_HOLE"] / 2.0, -1, nz0 + 0.1),
        cyl_z(0, tripod_y, (P["TRIPOD_HOLE"] + 0.6) / 2.0, nz1 - 0.1, CAVITY_TOP_Z - 2.0),
    ]
    return diff(base, nut_cut, "tripod nut trap")


def power_port():
    """Stadium opening along Y through the back wall, rounded ends along X."""
    w, h, x, zc = P["PWR_W"] / 2.0, P["PWR_H"] / 2.0, P["PWR_X"], P["PWR_ZC"]
    y0, y1 = P["BASE_CY"] - P["BASE_R"] - 5, P["BASE_CY"] - P["BASE_R"] + P["BASE_WALL"] + 6
    return union([box(x - w + h, x + w - h, y0, y1, zc - h, zc + h),
                  cyl_y(x - w + h, zc, h, y0, y1), cyl_y(x + w - h, zc, h, y0, y1)], "power port")


def esp32_box():
    return box(P["ESP32_X0"], P["ESP32_X0"] + P["ESP32_L"], P["ESP32_Y0"], P["ESP32_Y0"] + P["ESP32_W"],
               0.5, 0.5 + P["ESP32_H"])


def lid_screw_positions():
    out = []
    for deg in P["LID_SCREW_ANGLES"]:
        a = math.radians(deg)
        out.append((P["LID_SCREW_R"] * math.cos(a), P["BALLAST_CY"] + P["LID_SCREW_R"] * math.sin(a)))
    return out


def build_lid(tripod_y):
    lid = cyl_z(0, P["BALLAST_CY"], P["LID_R"] - P["CLR"], 0, P["LID_T"])
    cutters = [cyl_z(0, tripod_y, (P["TRIPOD_HOLE"] + 1.4) / 2.0, -1, P["LID_T"] + 1)]
    for (x, y) in lid_screw_positions():
        cutters.append(cyl_z(x, y, P["M3_CLEAR"] / 2.0, -1, P["LID_T"] + 1))
        cutters.append(cyl_z(x, y, P["LID_CBORE_D"] / 2.0, -1, P["LID_CBORE_DEPTH"]))
    return diff(lid, cutters, "lid holes")


# --------------------------------------------------------------------------
# References
# --------------------------------------------------------------------------
def load_head_step():
    """Import the vendor STEP into a headless doc and return its main solid.

    The file also carries 4 loose planar faces and a few sketch curves: the
    largest closed Brep is the head.
    """
    path = os.path.join(P["OUT_DIR"], P["HEAD_STEP"])
    hd = Rhino.RhinoDoc.CreateHeadless(None)
    try:
        hd.ModelUnitSystem = Rhino.UnitSystem.Millimeters
        if not hd.Import(path):
            raise RuntimeError("STEP import failed: %s" % path)
        solids = [o.Geometry.DuplicateBrep() for o in hd.Objects
                  if isinstance(o.Geometry, Brep) and o.Geometry.IsSolid]
    finally:
        hd.Dispose()
    if not solids:
        raise RuntimeError("no solid in %s" % path)
    head = max(solids, key=lambda b: VolumeMassProperties.Compute(b).Volume)
    bb = head.GetBoundingBox(True)
    if abs(bb.Min.Z) > 0.01 or abs(bb.Max.Z - P["HEAD_T"]) > 0.01:
        raise RuntimeError("unexpected head extent Z %.3f..%.3f (HEAD_T=%.1f)"
                           % (bb.Min.Z, bb.Max.Z, P["HEAD_T"]))
    return head


def place_head(head):
    """File frame -> world: rotate +90 deg about X (file +Z -> world -Y, file +Y ->
    world +Z), then move the back face (file z=HEAD_T) to PLATE_FRONT_Y."""
    head.Transform(Transform.Rotation(math.radians(90.0), Vector3d(1, 0, 0), Point3d.Origin))
    head.Transform(Transform.Translation(0, HEAD_FRONT_Y, AXIS_Z))
    return head


def build_head():
    """Vendor head placed on the plate: back face on the plate front, axis on the rotation axis.

    Lugs end up on world +-X / +-Z (portrait), HEAD_SPIN turns them about the axis.
    The 2 anti-rotation pins are added on the back face (they print on top).
    """
    head = place_head(load_head_step())
    pins = [cyl_y(x, z, P["PIN_D"] / 2.0, PLATE_FRONT_Y - P["PIN_H"], PLATE_FRONT_Y + 0.5)
            for (x, z) in pin_positions()]
    head = union([head] + pins, "head + pins")
    if P["HEAD_SPIN"]:
        head = rotated(head, P["HEAD_SPIN"])
    return head


def build_phones():
    l2, w2 = P["PHONE_L"] / 2, P["PHONE_W"] / 2
    portrait = box(-w2, w2, PHONE_Y0, PHONE_Y1, AXIS_Z - l2, AXIS_Z + l2)
    landscape = box(-l2, l2, PHONE_Y0, PHONE_Y1, AXIS_Z - w2, AXIS_Z + w2)
    return portrait, landscape


# --------------------------------------------------------------------------
# Document helpers
# --------------------------------------------------------------------------
LAYERS = {
    "SERVO_REF": (90, 90, 200),
    "COLUMN": (230, 227, 220),
    "DRUM": (230, 227, 220),
    "BALL": (215, 212, 205),
    "SHOE": (150, 150, 150),
    "KNOB": (215, 212, 205),
    "PLATE": (210, 207, 200),
    "INDEX": (226, 83, 31),
    "BASE": (200, 200, 200),
    "LID": (120, 120, 120),
    "HEAD": (190, 187, 180),
    "PHONE_ENVELOPE": (60, 160, 230),
    "REF_CURVES": (230, 40, 40),
}


def layer_index(name):
    lay = doc.Layers.FindName(name)
    if lay is None or lay.IsDeleted:
        nl = Rhino.DocObjects.Layer()
        nl.Name = name
        r, g, b = LAYERS[name]
        nl.Color = System.Drawing.Color.FromArgb(r, g, b)
        return doc.Layers.Add(nl)
    return lay.Index


LEGACY_LAYERS = ["HEAD_PLACEHOLDER", "TMP_INSPECT", "TOWER", "BODY"]


def clear_layers():
    for name in LEGACY_LAYERS:
        lay = doc.Layers.FindName(name)
        if lay is None:
            continue
        for obj in doc.Objects.FindByLayer(lay) or []:
            doc.Objects.Delete(obj, True)
        doc.Layers.Delete(lay.Index, True)
    for name in LAYERS:
        lay = doc.Layers.FindName(name)
        if lay is None:
            continue
        for obj in doc.Objects.FindByLayer(lay) or []:
            doc.Objects.Delete(obj, True)


def add(geom, layer, name):
    attr = Rhino.DocObjects.ObjectAttributes()
    attr.LayerIndex = layer_index(layer)
    attr.Name = name
    if isinstance(geom, Brep):
        return doc.Objects.AddBrep(geom, attr)
    return doc.Objects.AddCurve(geom, attr)


def write_stl(brep, path, xform):
    mp = MeshingParameters.QualityRenderMesh
    mp.Tolerance = 0.02
    mp.JaggedSeams = False
    mesh = Mesh()
    for m in Mesh.CreateFromBrep(brep, mp):
        mesh.Append(m)
    mesh.Weld(math.pi)
    if not mesh.IsClosed:
        # the vendor STEP meshes with a few T-junction slits (< 0.05 mm) between faces
        mesh.HealNakedEdges(0.05)
    mesh.Transform(xform)
    bb = mesh.GetBoundingBox(True)
    mesh.Translate(Vector3d(-bb.Min.X, -bb.Min.Y, -bb.Min.Z))
    mesh.Faces.ConvertQuadsToTriangles()
    mesh.FaceNormals.ComputeFaceNormals()
    v = mesh.Vertices
    with open(path, "wb") as f:
        f.write(b"phone stand - %s" % os.path.basename(path).encode() + b" " * 60)
        f.seek(80)
        f.write(struct.pack("<I", mesh.Faces.Count))
        for i in range(mesh.Faces.Count):
            fc = mesh.Faces[i]
            n = mesh.FaceNormals[i]
            f.write(struct.pack("<3f", n.X, n.Y, n.Z))
            for idx in (fc.A, fc.B, fc.C):
                p = v[idx]
                f.write(struct.pack("<3f", p.X, p.Y, p.Z))
            f.write(b"\x00\x00")
    bb = mesh.GetBoundingBox(True)
    return mesh.IsClosed, mesh.Faces.Count, (bb.Max.X, bb.Max.Y, bb.Max.Z)


def bbox_str(brep):
    bb = brep.GetBoundingBox(True)
    return "X[%.1f, %.1f] Y[%.1f, %.1f] Z[%.1f, %.1f] size %.1f x %.1f x %.1f" % (
        bb.Min.X, bb.Max.X, bb.Min.Y, bb.Max.Y, bb.Min.Z, bb.Max.Z,
        bb.Max.X - bb.Min.X, bb.Max.Y - bb.Min.Y, bb.Max.Z - bb.Min.Z)


def intersects(a, b):
    res = Brep.CreateBooleanIntersection(a, b, TOL)
    if not res:
        return False
    return sum(VolumeMassProperties.Compute(r).Volume for r in res) > 1e-3


# --------------------------------------------------------------------------
# Build
# --------------------------------------------------------------------------
def pose(theta, psi=0.0, swivel=0.0):
    """The drum's orientation on the ball: tilt theta (deg) about the horizontal axis at
    psi (0: pitch, + leans the screen back; 90: roll), then swivel about the vertical,
    both through the ball centre."""
    a = math.radians(psi)
    t = Transform.Rotation(math.radians(theta), Vector3d(math.cos(a), math.sin(a), 0), PIVOT)
    s = Transform.Rotation(math.radians(swivel), Vector3d(0, 0, 1), PIVOT)
    return s * t


def moved(geom, xf):
    if isinstance(geom, Point3d):
        return xf * geom
    g = geom.DuplicateBrep()
    g.Transform(xf)
    return g


def cone_poses(theta, step=15.0):
    """Every direction at tilt theta: psi over half a turn, both signs."""
    out = []
    psi = 0.0
    while psi < 180.0 - 1e-9:
        out += [(theta, psi), (-theta, psi)]
        psi += step
    return out


def phone_disc_points(n=72):
    """Rim points of the phone's swept disc (every servo angle), on its back and front faces."""
    pts = []
    for y in (PHONE_Y0, PHONE_Y1):
        for k in range(n):
            a = 2 * math.pi * k / n
            pts.append(Point3d(SWEPT_R * math.cos(a), y, AXIS_Z + SWEPT_R * math.sin(a)))
    return pts


def cable_pipe(xf):
    """The servo lead's envelope from the servo pocket, down the ball's bore (posed), into the column."""
    a = moved(Point3d(0, P["PIVOT_Y"], DRUM_BOTTOM_Z + 12.0), xf)
    b = moved(Point3d(0, P["PIVOT_Y"], BALL_FLAT_Z + 1.0), xf)
    ch_y = 0.5 * (P["CABLE_Y"][0] + P["CABLE_Y"][1])
    c = Point3d(0, ch_y, PIVOT_Z - P["CABLE_CONE_FLOOR"] - 6.0)
    d = Point3d(0, ch_y, PIVOT_Z - P["CABLE_CONE_FLOOR"] - 30.0)
    crv = PolylineCurve([a, b, c, d])
    crv = Curve.CreateFilletCornersCurve(crv, 4.0, TOL, 0.1) or crv
    pipes = Brep.CreatePipe(crv, P["CABLE_ENV_D"] / 2.0, False, Rhino.Geometry.PipeCapMode.Flat, True, TOL, 0.1)
    if not pipes:
        raise RuntimeError("cable pipe failed")
    return pipes[0]


def feet_hull_margin(x, y):
    """Signed distance from (x, y) to the edges of the feet's convex polygon (feet in angle order)."""
    pts = [base_pt(P["FOOT_R"], deg) for deg in sorted(P["FOOT_ANGLES"])]
    m = 1e9
    for i in range(len(pts)):
        (x0, y0), (x1, y1) = pts[i], pts[(i + 1) % len(pts)]
        ex, ey = x1 - x0, y1 - y0
        m = min(m, (ex * (y - y0) - ey * (x - x0)) / math.hypot(ex, ey))
    return m


# --------------------------------------------------------------------------
# Build
# --------------------------------------------------------------------------
def main():
    doc.ModelUnitSystem = Rhino.UnitSystem.Millimeters
    clear_layers()
    report = []
    failures = []

    servo = build_servo()
    drum = build_drum()
    plate = build_plate()
    index = build_index()
    head = build_head()
    column = build_column()
    ball = build_ball()
    shoe = build_shoe()
    knob = build_knob()
    portrait, landscape = build_phones()

    # masses: the drum's side moves on the ball, the column's side stays on the desk
    k = P["PETG_DENSITY"] * P["PRINT_FILL"]
    pre_base = build_base(P["BALLAST_CY"])          # provisional; tripod moves to the CoM below
    pre_lid = build_lid(P["BALLAST_CY"])

    def printed(brep, dens=k):
        vol, c = volume_centroid(brep)
        return (vol * dens, c)

    moving = [printed(drum), printed(plate), printed(ball, P["PETG_DENSITY"] * 0.7),
              (P["SERVO_G"], volume_centroid(servo)[1]), (P["HEAD_G"], volume_centroid(head)[1]),
              (P["PHONE_G"], Point3d(0, (PHONE_Y0 + PHONE_Y1) / 2, AXIS_Z))]
    fixed_top = [printed(column), printed(knob, P["PETG_DENSITY"])]
    ballast = (P["BALLAST_G"], Point3d(0, P["BALLAST_CY"], P["LID_T"] + 5))

    def com_of(masses):
        m_tot = sum(m for m, _ in masses)
        return m_tot, Point3d(sum(m * c.X for m, c in masses) / m_tot,
                              sum(m * c.Y for m, c in masses) / m_tot,
                              sum(m * c.Z for m, c in masses) / m_tot)

    m_tot, com = com_of(moving + fixed_top + [printed(pre_base), printed(pre_lid), ballast])
    # the nut trap (it opens toward +Y) must stay inside the ballast cavity
    t_lo = P["BALLAST_CY"] - P["BALLAST_R"] + 2.0
    t_hi = P["BALLAST_CY"] + P["BALLAST_R"] - (P["TRIPOD_BOSS_D"] / 2 + 6.0)
    tripod_y = min(max(com.Y, t_lo), t_hi)

    base = build_base(tripod_y)
    lid = build_lid(tripod_y)
    fixed = fixed_top + [printed(base), printed(lid), ballast]

    parts = [("SERVO_REF", "servo_ref", servo), ("DRUM", "drum", drum),
             ("PLATE", "plate", plate), ("INDEX", "index", index),
             ("COLUMN", "column", column), ("BALL", "ball", ball),
             ("SHOE", "shoe", shoe), ("KNOB", "knob", knob),
             ("BASE", "base", base), ("LID", "lid", lid), ("HEAD", "head", head),
             ("PHONE_ENVELOPE", "phone_portrait", portrait),
             ("PHONE_ENVELOPE", "phone_landscape", landscape)]
    for layer, name, brep in parts:
        add(brep, layer, name)
        report.append("%-17s solid=%s valid=%s  %s" % (name, brep.IsSolid, brep.IsValid, bbox_str(brep)))
        if not (brep.IsSolid and brep.IsValid):
            failures.append("%s not a valid solid" % name)

    swept = Circle(Plane(Point3d(0, PHONE_Y1, AXIS_Z), Vector3d(0, 1, 0)), SWEPT_R).ToNurbsCurve()
    add(swept, "REF_CURVES", "phone_swept_circle")
    add(Rhino.Geometry.LineCurve(Point3d(0, P["DRUM_BACK_Y"], AXIS_Z), Point3d(0, PHONE_Y1 + 10, AXIS_Z)),
        "REF_CURVES", "rotation_axis")

    # stops check: tabs vs stop block across the travel
    stop = stop_block(FLANGE_BACK_Y)
    tab_a, tab_b, _ = stop_contact_angles()
    tabs = [build_tab(tab_a), build_tab(tab_b)]
    lo, hi, ot = P["ROT_RANGE"][0], P["ROT_RANGE"][1], P["OVERTRAVEL"]

    def clash(theta):
        return any(intersects(rotated(t, theta), stop) for t in tabs)

    mid = (lo + hi) / 2.0
    travel = (lo - ot + 0.5, lo, mid, hi, hi + ot - 0.5)
    free = [th for th in travel if clash(th)]
    blocked = [th for th in (lo - ot - 0.5, hi + ot + 0.5) if not clash(th)]
    # the whole plate against the whole drum: free over the travel, stopped beyond it
    plate_drum = [th for th in travel if intersects(rotated(plate, th), drum)]
    plate_drum_beyond = [th for th in (lo - ot - 0.5, hi + ot + 0.5) if not intersects(rotated(plate, th), drum)]
    # tabs vs servo: tabs (r >= TAB_R[0], outside the gear boss) stay in front of the servo top face
    tab_gap = (PLATE_BACK_Y - P["TAB_LEN"]) - SERVO_TOP_Y
    servo_drum = intersects(servo, drum)
    flange_pass = P["BORE_R"] - FLANGE_CORNER_R
    if free or blocked:
        failures.append("stops")
    if plate_drum or plate_drum_beyond:
        failures.append("plate vs drum")
    if servo_drum:
        failures.append("servo overlaps the drum")
    if flange_pass < 0.5:
        failures.append("servo flange does not pass the bore")
    if tab_gap < 1.0:
        failures.append("tabs too close to the servo")

    # head checks: seated on the plate without overlap (pins excepted), clear of
    # the drum through the whole travel, sleeve free to move back
    head_core = place_head(load_head_step())
    head_plate_clash = intersects(head_core, plate)
    pins_in_holes = not intersects(head, plate)
    head_drum_clash = [th for th in (lo - ot, lo, mid, hi, hi + ot)
                       if intersects(rotated(head, th), drum)]
    hb = head.GetBoundingBox(True)
    head_phone_gap = PHONE_Y0 - hb.Max.Y
    # sleeve flange back face is the head's planar face at file z=18 -> world Y = HEAD_FRONT_Y - 18
    sleeve_travel = (HEAD_FRONT_Y - 18.0) - PLATE_FRONT_Y
    index_flush = not intersects(index, plate) and abs(index.GetBoundingBox(True).Max.Y - PLATE_FRONT_Y) < 1e-6
    index_clear_of_head = P["INDEX_R"][0] - 0.5 * (hb.Max.X - hb.Min.X)
    if head_plate_clash or not pins_in_holes or head_drum_clash:
        failures.append("head")
    if not index_flush or index_clear_of_head < 3.0:
        failures.append("index")

    # the ESP32 must sit wholly in the bay: nothing of the base inside its clearance box
    esp_in_base = intersects(esp32_box(), base)
    if esp_in_base:
        failures.append("ESP32 does not fit the bay")
    report.append("ESP32 slot X %.1f..%.1f Y %.1f..%.1f clear of the base: %s"
                  % (P["ESP32_X0"], P["ESP32_X0"] + P["ESP32_L"], P["ESP32_Y0"], P["ESP32_Y0"] + P["ESP32_W"],
                     not esp_in_base))

    # ---- ball joint -------------------------------------------------------
    # assembled at rest: ball, shoe, column, drum, knob apart from one another
    joint_rest = [(n, a, b) for (n, a, b) in (
        ("ball/column", ball, column), ("ball/shoe", ball, shoe), ("shoe/column", shoe, column),
        ("ball/drum", ball, drum), ("knob/column", knob, column), ("drum/column", drum, column))
        if intersects(a, b)]
    if joint_rest:
        failures.append("joint parts overlap at rest: " + ", ".join(n for n, _, _ in joint_rest))
    # the tilt stop: the neck meets the rim at TILT_MAX, in every direction
    stop_dirs = [(1.0, psi) for psi in range(0, 360, 45)]
    tilt_early = [psi for (_, psi) in stop_dirs
                  if any(intersects(moved(ball, pose(P["TILT_MAX"] - 0.5, psi)), g) for g in (column, shoe))]
    tilt_unstopped = [psi for (_, psi) in stop_dirs
                      if not intersects(moved(ball, pose(P["TILT_MAX"] + 1.0, psi)), column)]
    if tilt_early or tilt_unstopped:
        failures.append("tilt stop")
    # nothing else on the drum's side touches the column or the knob before the neck stops
    poses_max = cone_poses(P["TILT_MAX"] + 1.0)
    drum_hits = [(th, psi) for (th, psi) in poses_max
                 if any(intersects(moved(drum, pose(th, psi)), g) for g in (column, knob))]
    if drum_hits:
        failures.append("drum hits the column or knob when tilted")
    # the phone's swept disc (every servo angle) over the whole physical cone: above the base top
    disc = phone_disc_points()
    gaps = []
    for (th, psi) in [(0.0, 0.0)] + cone_poses(P["TILT_MAX"]) + cone_poses(P["TILT_MAX"] / 2.0):
        xf = pose(th, psi)
        gaps.append((min(moved(p, xf).Z for p in disc) - BASE_TOP, th, psi))
    gap_min = min(gaps)
    spec_gaps = []
    for th in (P["TILT_SPEC"][0], 0.0, P["TILT_SPEC"][1]):
        xf = pose(th, 0.0)
        spec_gaps.append((min(moved(p, xf).Z for p in disc) - BASE_TOP, th))
    if gap_min[0] < P["CLEAR_MARGIN"]:
        failures.append("phone too close to the base when tilted")
    # the swept disc against the column and the knob, at the cardinal extremes
    slab = cyl_y(0, AXIS_Z, SWEPT_R, PHONE_Y0, PHONE_Y1)
    slab_hits = [(th, psi) for (th, psi) in cone_poses(P["TILT_MAX"], 90.0)
                 if any(intersects(moved(slab, pose(th, psi)), g) for g in (column, knob, base))]
    if slab_hits:
        failures.append("phone hits the column, knob or base")
    # the servo lead: a pipe of CABLE_ENV_D through the drum, the ball's bore and the column, unpinched
    pinched = []
    for (th, psi) in [(0.0, 0.0)] + [(P["TILT_MAX"], a) for a in range(0, 360, 45)]:
        xf = pose(th, psi)
        pipe = cable_pipe(xf)
        if intersects(pipe, moved(ball, xf)) or intersects(pipe, moved(drum, xf)) or intersects(pipe, column):
            pinched.append((th, psi))
    if pinched:
        failures.append("servo lead pinched")

    # holding torque and tip-over over the envelope
    g = 9.81e-3   # N per g, moments in N m with mm -> m below
    rows = []
    for th in (0.0, P["TILT_MAX"] / 2.0, P["TILT_MAX"]):
        psis = [0.0] if th == 0 else [float(a) for a in range(0, 360, 15)]
        for psi in psis:
            for sw in range(-180, 181, 15):
                xf = pose(th, psi, sw)
                mov = [(m, moved(c, xf)) for m, c in moving]
                mx = sum(m * (c.Y - PIVOT.Y) for m, c in mov)   # moment about X ~ m g y
                my = sum(m * (c.X - PIVOT.X) for m, c in mov)
                moment = g * math.hypot(mx, my) / 1000.0
                _, cm = com_of(mov + fixed)
                dist = math.hypot(cm.X, cm.Y - P["BASE_CY"])
                rows.append((th, psi, sw, moment, P["BASE_R"] - dist, feet_hull_margin(cm.X, cm.Y), cm))
    # inside the required range: pitch over TILT_SPEC (psi 0 with theta of either sign), swivel <= SWIVEL_SPEC
    spec_rows = []
    for th in (P["TILT_SPEC"][0], 0.0, P["TILT_SPEC"][1]):
        for sw in range(-int(P["SWIVEL_SPEC"]), int(P["SWIVEL_SPEC"]) + 1, 15):
            xf = pose(th, 0.0, sw)
            mov = [(m, moved(c, xf)) for m, c in moving]
            mx = sum(m * (c.Y - PIVOT.Y) for m, c in mov)
            my = sum(m * (c.X - PIVOT.X) for m, c in mov)
            _, cm = com_of(mov + fixed)
            dist = math.hypot(cm.X, cm.Y - P["BASE_CY"])
            spec_rows.append((th, 0.0, sw, g * math.hypot(mx, my) / 1000.0, P["BASE_R"] - dist,
                              feet_hull_margin(cm.X, cm.Y), cm))
    worst_moment = max(rows, key=lambda r: r[3])
    worst_tip = min(rows, key=lambda r: r[4])
    worst_feet = min(rows, key=lambda r: r[5])
    spec_tip = min(spec_rows, key=lambda r: r[4])
    spec_feet = min(spec_rows, key=lambda r: r[5])
    spec_moment = max(spec_rows, key=lambda r: r[3])
    if spec_tip[4] < P["TIP_MARGIN_MIN"]:
        failures.append("tips over inside the required range")
    # clamp: the knob's screw force F pushes the shoe on the ball, the socket's front takes F back
    f_screw = P["KNOB_TORQUE"] / (P["SCREW_K"] * P["SCREW_D"] / 1000.0)
    t_hold = P["MU_PETG"] * 2.0 * f_screw * BALL_R / 1000.0
    phone_top = math.hypot(PHONE_Y1 - P["PIVOT_Y"], AXIS_Z + P["PHONE_L"] / 2.0 - PIVOT_Z) / 1000.0
    t_tap = P["TAP_N"] * phone_top
    if t_hold < 2.0 * worst_moment[3]:
        failures.append("clamp too weak")

    gap_base = AXIS_Z - SWEPT_R - BASE_TOP
    if gap_base < P["CLEAR_MARGIN"]:
        failures.append("phone too close to the base")
    # the base must reach under the phone and the CoM, with margin, for stability
    base_front = P["BASE_CY"] + P["BASE_R"]
    if base_front - PHONE_Y1 < 20.0:
        failures.append("base front too close to the phone plane")
    _, com_rest = com_of(moving + fixed)
    report += [
        "AXIS_Z=%.2f (%.1f above base top)  swept R=%.2f  gap to base top at rest=%.2f  to desk=%.2f (required %.1f) -> %s"
        % (AXIS_Z, P["AXIS_ABOVE_BASE"], SWEPT_R, gap_base, AXIS_Z - SWEPT_R, P["CLEAR_MARGIN"],
           "OK" if gap_base >= P["CLEAR_MARGIN"] else "FAIL"),
        "Y stack: drum back %.1f, bulkhead/flange %.1f, servo top %.1f, horn top %.1f, plate %.1f..%.1f (drum face), head ..%.1f, phone %.1f..%.1f"
        % (P["DRUM_BACK_Y"], FLANGE_BACK_Y, SERVO_TOP_Y, HORN_TOP_Y, PLATE_BACK_Y, PLATE_FRONT_Y,
           HEAD_FRONT_Y, PHONE_Y0, PHONE_Y1),
        "proportions: base D %.0f / drum D %.0f = %.3f (phi 1.618); support under the drum %.1f (drum D %.0f); drum D / column W = %.2f (pi 3.14); collar D %.0f; height %.1f"
        % (2 * P["BASE_R"], P["DRUM_D"], 2 * P["BASE_R"] / P["DRUM_D"], DRUM_BOTTOM_Z - BASE_TOP, P["DRUM_D"],
           P["DRUM_D"] / P["COLUMN_W"], P["COLLAR_D"], AXIS_Z + DRUM_R),
        "servo: flange corner R %.2f in bore R %.1f (margin %.2f), servo vs drum overlap=%s"
        % (FLANGE_CORNER_R, P["BORE_R"], flange_pass, servo_drum),
        "tabs at plate-local phi=%.1f / %.1f deg; stop clash inside travel: %s; not blocked beyond overtravel: %s; tab-to-servo gap %.2f mm"
        % (tab_a, tab_b, free or "none", blocked or "none", tab_gap),
        "plate vs drum: clash inside travel: %s; free beyond overtravel: %s; shadow gap %.2f mm"
        % (plate_drum or "none", plate_drum_beyond or "none", P["SHADOW_GAP"]),
        "head: core/plate overlap=%s, pins clear in holes=%s, head vs drum clash over travel: %s, "
        "head front to phone gap %.2f, sleeve flange to plate %.2f mm (free travel)"
        % (head_plate_clash, pins_in_holes, head_drum_clash or "none", head_phone_gap, sleeve_travel),
        "index: flush and seated=%s, %.1f mm outside the head" % (index_flush, index_clear_of_head),
        "ball joint: centre Y=%.1f Z=%.1f (%.1f under the drum), ball D %.0f in socket D %.2f, bore D %.1f, neck D %.0f; "
        "rim %.2f above the centre -> tilt stop %.1f deg all round; overlap at rest: %s"
        % (PIVOT.Y, PIVOT_Z, P["NECK_TO_DRUM"], P["BALL_D"], 2 * SOCKET_R, P["BALL_BORE"], P["NECK_D"],
           RIM_H, P["TILT_MAX"], [n for n, _, _ in joint_rest] or "none"),
        "tilt stop: touches before TILT_MAX-0.5 at psi %s; not stopped at TILT_MAX+1 at psi %s; drum vs column/knob up to TILT_MAX+1: %s"
        % (tilt_early or "none", tilt_unstopped or "none", drum_hits or "none"),
        "phone disc to the base top: at rest %.1f; required pitch %+.0f / 0 / %+.0f: %s; worst over the whole cone %.1f at tilt %+.1f psi %.0f (required %.1f); disc vs column/knob/base: %s"
        % (gap_base, P["TILT_SPEC"][0], P["TILT_SPEC"][1], " / ".join("%.1f" % gq for gq, _ in spec_gaps),
           gap_min[0], gap_min[1], gap_min[2], P["CLEAR_MARGIN"], slab_hits or "none"),
        "servo lead (D %.0f envelope) pinched at: %s" % (P["CABLE_ENV_D"], pinched or "none"),
        "gravity moment on the ball: required range max %.3f N m; whole cone max %.3f N m (tilt %+.1f psi %.0f); a %.0f N tap on the phone's top %.3f N m"
        % (spec_moment[3], worst_moment[3], worst_moment[0], worst_moment[1], P["TAP_N"], t_tap),
        "clamp: knob %.2f N m -> screw %.0f N, holding torque mu %.2f x 2F x R = %.2f N m (x%.1f the worst gravity moment)"
        % (P["KNOB_TORQUE"], f_screw, P["MU_PETG"], t_hold, t_hold / worst_moment[3]),
        "CoM at rest (ballast %.0f g, total %.0f g): X=%.1f Y=%.1f Z=%.1f; tripod nut at Y=%.1f; base Y %.0f..%.0f"
        % (P["BALLAST_G"], m_tot, com_rest.X, com_rest.Y, com_rest.Z, tripod_y, P["BASE_CY"] - P["BASE_R"], base_front),
        "tip-over, CoM to the base rim: required range (pitch %+.0f..%+.0f, swivel +-%.0f) worst %.1f mm at pitch %+.0f swivel %+.0f (min %.0f); "
        "whole cone and any swivel worst %.1f mm at tilt %+.1f psi %.0f swivel %+.0f"
        % (P["TILT_SPEC"][0], P["TILT_SPEC"][1], P["SWIVEL_SPEC"], spec_tip[4], spec_tip[0], spec_tip[2],
           P["TIP_MARGIN_MIN"], worst_tip[4], worst_tip[0], worst_tip[1], worst_tip[2]),
        "tip-over, CoM to the feet's polygon: required range worst %.1f mm; whole cone and any swivel worst %.1f mm"
        % (spec_feet[5], worst_feet[5]),
    ]

    if P["EXPORT"]:
        out = P["OUT_DIR"]
        stl_dir = os.path.join(out, "stl")
        if not os.path.isdir(stl_dir):
            os.makedirs(stl_dir)
        rx = lambda deg: Transform.Rotation(math.radians(deg), Vector3d(1, 0, 0), Point3d.Origin)
        ry = lambda deg: Transform.Rotation(math.radians(deg), Vector3d(0, 1, 0), Point3d.Origin)
        exports = [("base.stl", base, rx(180)),     # top face on the bed
                   ("column.stl", column, rx(180)),  # upside down, the collar's top face on the bed
                   ("drum.stl", drum, rx(90)),      # flat back face on the bed
                   ("ball.stl", ball, Transform.Identity),  # upright, on the ball's flat bottom
                   ("shoe.stl", shoe, rx(90)),      # flat back on the bed, concave face up
                   ("knob.stl", knob, rx(90)),      # back face on the bed, hex pocket up
                   ("plate.stl", plate, rx(-90)),   # dial face on the bed
                   ("index.stl", index, ry(90)),    # on its side
                   ("head.stl", head, rx(-90)),     # lug face on the bed (vendor orientation)
                   ("lid.stl", lid, Transform.Identity)]
        for fname, brep, xf in exports:
            closed, nf, size = write_stl(brep, os.path.join(stl_dir, fname), xf)
            report.append("%-10s closed=%s tris=%d print bbox %.1f x %.1f x %.1f"
                          % (fname, closed, nf, size[0], size[1], size[2]))
            if max(size) > 220.0:
                failures.append("%s larger than 220 mm" % fname)
        write_step(os.path.join(out, "phone-stand.rhino.step"),
                   [("Base", base), ("Column", column), ("Drum", drum), ("Ball", ball), ("Shoe", shoe),
                    ("Knob", knob), ("Plate", plate), ("Head", head), ("Lid", lid), ("Index", index)])
        report.append("phone-stand.rhino.step written")
    report.append("checks: %s" % ("all passed" if not failures else "FAILED: " + ", ".join(failures)))
    doc.Views.Redraw()
    print("\n".join(report))


def write_step(path, solids):
    """Write the printed parts alone into a STEP of named solids, in the repository's frame.

    Only the parts go in: the servo, the phone envelopes and the curves are
    references. Each solid is named after its part (the build names the bodies
    from these names). The model turns half a turn about Z on the way, so the
    phone faces -Y, the front the renders and the site assume.
    """
    hd = Rhino.RhinoDoc.CreateHeadless(None)
    try:
        hd.ModelUnitSystem = Rhino.UnitSystem.Millimeters
        turn = Transform.Rotation(math.pi, Vector3d(0, 0, 1), Point3d.Origin)
        for name, brep in solids:
            b = brep.DuplicateBrep()
            b.Transform(turn)
            attr = Rhino.DocObjects.ObjectAttributes()
            attr.Name = name
            hd.Objects.AddBrep(b, attr)
        if not hd.Export(path):
            raise RuntimeError("STEP export failed: %s" % path)
        # Rhino keeps the file it overwrote as <path>bak: not a source, drop it.
        if os.path.exists(path + "bak"):
            os.remove(path + "bak")
    finally:
        hd.Dispose()


main()
