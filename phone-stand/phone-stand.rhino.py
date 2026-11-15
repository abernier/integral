"""
Motorized phone stand (portrait <-> landscape) - parametric Rhino model.

Run inside Rhino 8/9 (CPython 3, RhinoCommon):

    RunPythonScript <this folder>/phone-stand.rhino.py

Re-runnable: it wipes the objects on its own layers and rebuilds everything
from the parameters below. With EXPORT on, it writes, next to this file:

  phone-stand.rhino.step  the six printed parts as named solids (Base, Body,
                          Plate, Head, Lid, Index), the part's master geometry,
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
width = drum diameter / pi. No fastener shows from the front or the sides: the
column is screwed from inside the base's bay, the lid from below, the servo
behind the plate; the cables leave at the back of the base.

Parts (layers):
  SERVO_REF          reference only, MG996R-class servo + round horn
  BODY               printed - column + drum; holds the servo by its flange on a
                     bulkhead inside the drum, carries the stop block; screwed
                     onto the base from below
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
  base upside down (top face on bed), body on its flat back face (the column's
  back is flush with the drum's, the column's front is a half round that rises
  from the bed), plate dial face down, index on its side, lid flat, head lug
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
    AXIS_ABOVE_BASE=98.0,     # axis height above base top: column shows 54 = 88 / phi

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
    COLUMN_INSERTS=[(-9.0, 14.0), (9.0, 14.0), (0.0, 31.0)],
    CABLE_X=10.0, CABLE_Y=(12.0, 24.0),
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


def build_body():
    c = P["CLR"]
    yb, yf, R = P["DRUM_BACK_Y"], DRUM_FRONT_Y, DRUM_R
    # drum: revolved about the axis, its outer front edge rounded
    drum = revolve([(0, yb, 0), (R, yb, 0), (R, yf, P["DRUM_FRONT_ROUND"]), (0, yf, 0)],
                   lambda u, v: Point3d(u, v, AXIS_Z), Point3d(0, 0, AXIS_Z), Point3d(0, 1, AXIS_Z))
    # column: D section, flat back flush with the drum's back, up into the drum
    column = extrude_z(d_section(P["COLUMN_W"] / 2.0, yb, 0), COLUMN_BOTTOM_Z, AXIS_Z)
    body = union([drum, column], "drum + column")

    cutters = []
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
    # cable channel from the pocket down the column into the base
    cx = P["CABLE_X"] / 2.0
    cutters.append(box(-cx, cx, P["CABLE_Y"][0], P["CABLE_Y"][1],
                       COLUMN_BOTTOM_Z - 1, SERVO_BOT_Z + 1.0))
    # heat-set inserts in the column foot (screws from inside the base bay)
    for (x, y) in P["COLUMN_INSERTS"]:
        cutters.append(cyl_z(x, y, P["M3_INSERT"] / 2.0, COLUMN_BOTTOM_Z - 1,
                             COLUMN_BOTTOM_Z + P["M3_INSERT_DEPTH"]))
    # portrait / landscape notches in the rim face
    for phi in P["NOTCH_PHI"]:
        cutters.append(radial_key(phi, P["BORE_R"] - 1.0, R + 1.0, P["NOTCH_W"] / 2.0,
                                  yf - P["NOTCH_DEPTH"], yf + 1))
    body = diff(body, cutters, "body cuts")
    # stop block, hanging from the bore wall at the top, in front of the bulkhead
    return union([body, stop_block(FLANGE_BACK_Y - 0.5)], "body + stop")


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
    "BODY": (230, 227, 220),
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


LEGACY_LAYERS = ["HEAD_PLACEHOLDER", "TMP_INSPECT", "TOWER"]


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
def main():
    doc.ModelUnitSystem = Rhino.UnitSystem.Millimeters
    clear_layers()
    report = []
    failures = []

    servo = build_servo()
    body = build_body()
    plate = build_plate()
    index = build_index()
    head = build_head()
    portrait, landscape = build_phones()

    # centre of mass estimate (tripod nut goes under it)
    k = P["PETG_DENSITY"] * P["PRINT_FILL"]
    pre_base = build_base(P["BALLAST_CY"])          # provisional; tripod moves to the CoM below
    masses = []
    for brep, dens in ((body, k), (plate, k), (pre_base, k)):
        vol, c = volume_centroid(brep)
        masses.append((vol * dens, c))
    _, servo_c = volume_centroid(servo)
    masses.append((P["SERVO_G"], servo_c))
    masses.append((P["HEAD_G"], volume_centroid(head)[1]))
    masses.append((P["PHONE_G"], Point3d(0, (PHONE_Y0 + PHONE_Y1) / 2, AXIS_Z)))
    masses.append((P["BALLAST_G"], Point3d(0, P["BALLAST_CY"], P["LID_T"] + 5)))
    m_tot = sum(m for m, _ in masses)
    com = Point3d(sum(m * c.X for m, c in masses) / m_tot,
                  sum(m * c.Y for m, c in masses) / m_tot,
                  sum(m * c.Z for m, c in masses) / m_tot)
    # the nut trap (it opens toward +Y) must stay inside the ballast cavity
    t_lo = P["BALLAST_CY"] - P["BALLAST_R"] + 2.0
    t_hi = P["BALLAST_CY"] + P["BALLAST_R"] - (P["TRIPOD_BOSS_D"] / 2 + 6.0)
    tripod_y = min(max(com.Y, t_lo), t_hi)

    base = build_base(tripod_y)
    lid = build_lid(tripod_y)

    parts = [("SERVO_REF", "servo_ref", servo), ("BODY", "body", body),
             ("PLATE", "plate", plate), ("INDEX", "index", index),
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
    # the whole plate against the whole body: free over the travel, stopped beyond it
    plate_body = [th for th in travel if intersects(rotated(plate, th), body)]
    plate_body_beyond = [th for th in (lo - ot - 0.5, hi + ot + 0.5) if not intersects(rotated(plate, th), body)]
    # tabs vs servo: tabs (r >= TAB_R[0], outside the gear boss) stay in front of the servo top face
    tab_gap = (PLATE_BACK_Y - P["TAB_LEN"]) - SERVO_TOP_Y
    servo_body = intersects(servo, body)
    flange_pass = P["BORE_R"] - FLANGE_CORNER_R
    if free or blocked:
        failures.append("stops")
    if plate_body or plate_body_beyond:
        failures.append("plate vs body")
    if servo_body:
        failures.append("servo overlaps the body")
    if flange_pass < 0.5:
        failures.append("servo flange does not pass the bore")
    if tab_gap < 1.0:
        failures.append("tabs too close to the servo")

    # head checks: seated on the plate without overlap (pins excepted), clear of
    # the body through the whole travel, sleeve free to move back
    head_core = place_head(load_head_step())
    head_plate_clash = intersects(head_core, plate)
    pins_in_holes = not intersects(head, plate)
    head_body_clash = [th for th in (lo - ot, lo, mid, hi, hi + ot)
                       if intersects(rotated(head, th), body)]
    hb = head.GetBoundingBox(True)
    head_phone_gap = PHONE_Y0 - hb.Max.Y
    # sleeve flange back face is the head's planar face at file z=18 -> world Y = HEAD_FRONT_Y - 18
    sleeve_travel = (HEAD_FRONT_Y - 18.0) - PLATE_FRONT_Y
    index_flush = not intersects(index, plate) and abs(index.GetBoundingBox(True).Max.Y - PLATE_FRONT_Y) < 1e-6
    index_clear_of_head = P["INDEX_R"][0] - 0.5 * (hb.Max.X - hb.Min.X)
    if head_plate_clash or not pins_in_holes or head_body_clash:
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

    gap_base = AXIS_Z - SWEPT_R - BASE_TOP
    if gap_base < P["CLEAR_MARGIN"]:
        failures.append("phone too close to the base")
    # the base must reach under the phone and the CoM, with margin, for stability
    base_front = P["BASE_CY"] + P["BASE_R"]
    if base_front - PHONE_Y1 < 20.0:
        failures.append("base front too close to the phone plane")
    report += [
        "AXIS_Z=%.2f (%.1f above base top)  swept R=%.2f  min gap to base top=%.2f  to desk=%.2f (required %.1f) -> %s"
        % (AXIS_Z, P["AXIS_ABOVE_BASE"], SWEPT_R, gap_base, AXIS_Z - SWEPT_R, P["CLEAR_MARGIN"],
           "OK" if gap_base >= P["CLEAR_MARGIN"] else "FAIL"),
        "Y stack: body back %.1f, bulkhead/flange %.1f, servo top %.1f, horn top %.1f, plate %.1f..%.1f (drum face), head ..%.1f, phone %.1f..%.1f"
        % (P["DRUM_BACK_Y"], FLANGE_BACK_Y, SERVO_TOP_Y, HORN_TOP_Y, PLATE_BACK_Y, PLATE_FRONT_Y,
           HEAD_FRONT_Y, PHONE_Y0, PHONE_Y1),
        "proportions: base D %.0f / drum D %.0f = %.3f; drum D / column shown %.1f = %.3f (phi 1.618); drum D / column W = %.2f (pi 3.14); height %.1f"
        % (2 * P["BASE_R"], P["DRUM_D"], 2 * P["BASE_R"] / P["DRUM_D"], AXIS_Z - DRUM_R - BASE_TOP,
           P["DRUM_D"] / (AXIS_Z - DRUM_R - BASE_TOP), P["DRUM_D"] / P["COLUMN_W"], AXIS_Z + DRUM_R),
        "servo: flange corner R %.2f in bore R %.1f (margin %.2f), servo vs body overlap=%s"
        % (FLANGE_CORNER_R, P["BORE_R"], flange_pass, servo_body),
        "tabs at plate-local phi=%.1f / %.1f deg; stop clash inside travel: %s; not blocked beyond overtravel: %s; tab-to-servo gap %.2f mm"
        % (tab_a, tab_b, free or "none", blocked or "none", tab_gap),
        "plate vs body: clash inside travel: %s; free beyond overtravel: %s; shadow gap %.2f mm"
        % (plate_body or "none", plate_body_beyond or "none", P["SHADOW_GAP"]),
        "CoM estimate (ballast %.0f g, total %.0f g): X=%.1f Y=%.1f Z=%.1f; tripod nut at Y=%.1f; base Y %.0f..%.0f"
        % (P["BALLAST_G"], m_tot, com.X, com.Y, com.Z, tripod_y, P["BASE_CY"] - P["BASE_R"], base_front),
        "head: core/plate overlap=%s, pins clear in holes=%s, head vs body clash over travel: %s, "
        "head front to phone gap %.2f, sleeve flange to plate %.2f mm (free travel)"
        % (head_plate_clash, pins_in_holes, head_body_clash or "none", head_phone_gap, sleeve_travel),
        "index: flush and seated=%s, %.1f mm outside the head" % (index_flush, index_clear_of_head),
    ]

    if P["EXPORT"]:
        out = P["OUT_DIR"]
        stl_dir = os.path.join(out, "stl")
        if not os.path.isdir(stl_dir):
            os.makedirs(stl_dir)
        rx = lambda deg: Transform.Rotation(math.radians(deg), Vector3d(1, 0, 0), Point3d.Origin)
        ry = lambda deg: Transform.Rotation(math.radians(deg), Vector3d(0, 1, 0), Point3d.Origin)
        exports = [("base.stl", base, rx(180)),     # top face on the bed
                   ("body.stl", body, rx(90)),      # flat back face on the bed
                   ("plate.stl", plate, rx(-90)),   # dial face on the bed
                   ("index.stl", index, ry(90)),    # on its side
                   ("head.stl", head, rx(-90)),     # lug face on the bed (vendor orientation)
                   ("lid.stl", lid, Transform.Identity)]
        for fname, brep, xf in exports:
            closed, nf, size = write_stl(brep, os.path.join(stl_dir, fname), xf)
            report.append("%-9s closed=%s tris=%d print bbox %.1f x %.1f x %.1f"
                          % (fname, closed, nf, size[0], size[1], size[2]))
            if max(size) > 220.0:
                failures.append("%s larger than 220 mm" % fname)
        write_step(os.path.join(out, "phone-stand.rhino.step"),
                   [("Base", base), ("Body", body), ("Plate", plate), ("Head", head),
                    ("Lid", lid), ("Index", index)])
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
