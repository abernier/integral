"""
Motorized phone stand (portrait <-> landscape) - parametric Rhino model.

Run inside Rhino 8/9 (CPython 3, RhinoCommon):

    RunPythonScript <this folder>/phone-stand.rhino.py

Re-runnable: it wipes the objects on its own layers and rebuilds everything
from the parameters below. With EXPORT on, it writes, next to this file:

  phone-stand.rhino.step  the five printed parts as named solids (Base, Tower,
                          Plate, Head, Lid), the part's master geometry, in git;
                          turned half a turn about Z so the phone faces -Y,
                          the repository's front (the build imports it as it is)
  stl/<part>.stl          print-ready meshes in print orientation, generated,
                          out of git

Frame: mm, Z up, desk at Z=0, phone faces +Y (user at +Y), rotation axis is
parallel to Y through (X=0, Z=AXIS_Z).

Parts (layers):
  SERVO_REF          reference only, MG996R-class servo + round horn
  TOWER              printed - holds the servo by its flange, screwed onto the base
  PLATE              printed - rotating disc bolted to the servo horn, carries stop tabs
  BASE               printed - electronics bay, ballast cavity, tripod nut trap, feet
  LID                printed - ballast cavity bottom lid (M3)
  HEAD               printed - Quad Lock compatible head (vendor STEP, jimmysinkers,
                     CC BY 4.0) + 2 anti-rotation pins added on its back
  PHONE_ENVELOPE     reference - phone in portrait and landscape
  REF_CURVES         reference - swept circle of the phone

Print orientations used for STL export:
  base  upside down (top face on bed), tower on its back face,
  plate front face down, lid flat, head lug face down (the vendor's own
  print-in-place orientation: the sliding sleeve and its 45 deg flange chamfer
  only print without support that way).

Head mounting (plate <-> head are two parts on purpose):
  The head is a print-in-place mechanism: a fixed core (back boss, cone, spring
  hub, front plunger disc) and an axially sliding release sleeve (lugs + wall +
  flange) joined only by the ortho-planar spring. The sleeve flange must stay
  free to travel back toward the plate, so nothing may be fused around the
  boss. Fusing head + plate also leaves no support-free print orientation
  (lug-down: the plate overhangs the boss by 15 mm; plate-back-down: the stop
  tabs lift it off the bed). So the head stays a separate part, fixed by one
  M3 button-head screw from the plate back into the head's central 2.8 mm
  hole (thread-forming), with 2 printed pins on the head back in 2 blind holes
  in the plate front for anti-rotation (the Quad Lock twist torque).
  Consequence: the servo spline screw is no longer reachable from the front;
  the rotor is held on the spline by the horn clamp only (see report).
"""

import math
import os
import struct

import System
import Rhino
from Rhino.Geometry import (
    Point3d, Vector3d, Plane, Circle, Cylinder, BoundingBox, Brep, Transform,
    Polyline, PolylineCurve, Curve, Surface, Mesh, MeshingParameters,
    VolumeMassProperties,
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

    # phone envelope (case included)
    PHONE_L=155.0, PHONE_W=75.0, PHONE_T=12.0,
    CLEAR_MARGIN=8.0,         # required gap below the swept circle

    # base
    BASE_W=130.0,             # X
    BASE_D=115.0,             # Y (Y=0 back edge, Y=BASE_D front edge)
    BASE_H=25.0,
    BASE_CORNER_R=8.0,
    BASE_TOP_SKIN=4.0,
    BASE_WALL=3.0,
    AXIS_ABOVE_BASE=96.0,     # axis height above base top

    # electronics bay (open to bottom, behind the divider)
    BAY_X=(-47.0, 47.0), BAY_Y=(3.0, 60.0),
    ESP32_L=56.0, ESP32_W=29.0, ESP32_H=15.0,     # clearance box (Y, X, Z)
    ESP32_X0=-44.5,                               # min X of ESP32 slot
    USB_OPEN_W=14.0, USB_OPEN_Z=(8.0, 18.0),      # ESP32 USB opening in back wall
    PWR_W=12.0, PWR_H=10.0, PWR_X=30.0, PWR_Z0=8.0,  # USB-C breakout opening

    # ballast cavity + lid
    BALLAST_X=(-42.0, 42.0), BALLAST_Y=(68.0, 106.0),
    LID_X=(-50.0, 50.0), LID_Y=(62.0, 112.0), LID_T=3.0,
    LID_SCREWS=[(-46.0, 65.0), (46.0, 65.0), (-46.0, 109.0), (46.0, 109.0)],
    LID_CBORE_D=6.0, LID_CBORE_DEPTH=1.7,
    BALLAST_G=150.0,          # assumed ballast mass for the CoM estimate

    # tripod 1/4"-20 nut trap
    NUT_AF=11.1, NUT_H=5.6, TRIPOD_HOLE=6.6, TRIPOD_BOSS_D=24.0,
    TRIPOD_FLOOR=3.0,         # boss material under the nut (takes the tripod pull)

    # rubber feet
    FOOT_D=10.0, FOOT_DEPTH=1.0, FOOT_INSET=9.0,

    # servo (MG996R class) - servo frame: L along Z, W along X, H along Y
    SERVO_L=40.7, SERVO_W=19.7, SERVO_H=42.9,
    FLANGE_L=54.5, FLANGE_T=2.5, FLANGE_Z_FROM_BOTTOM=27.0,
    FLANGE_HOLE_D=4.5, FLANGE_HOLES_L=49.5, FLANGE_HOLES_W=10.0,
    SHAFT_FROM_END=10.0,
    SERVO_BOSS_D=13.0, SERVO_BOSS_H=1.5,     # gear housing boss on top face
    HORN_D=20.0, HORN_T=2.5, HORN_HUB_D=9.0,
    HORN_TOP_ABOVE_BODY=8.0,                 # horn front face above servo top face
    SERVO_G=55.0,

    # tower
    TOWER_W=32.0,             # X
    TOWER_DEPTH=30.0,         # Y
    TOWER_BACK_Y=8.0,
    TOWER_CORNER_R=3.0,
    TOWER_TOP_ABOVE_AXIS=27.0,
    TOWER_RECESS=1.0,         # locating recess in base top
    SERVO_SCREW_PILOT=3.4,    # M4 self-tapping pilot (or M3 + nut)
    SERVO_SCREW_DEPTH=12.0,
    TOWER_INSERTS=[(-11.0, 13.0), (11.0, 13.0), (-11.0, 33.0), (11.0, 33.0)],
    CABLE_X=10.0, CABLE_Y=(12.0, 22.0),

    # rotating plate
    PLATE_D=60.0, PLATE_T=6.0,
    HORN_RECESS_D=20.5, HORN_RECESS_DEPTH=1.5,
    PLATE_CENTER_BORE=6.5,
    HORN_HOLE_D=2.4, HORN_HOLE_BC=14.0, HORN_HOLE_N=4,
    # head fixing: central M3 button head (ISO 7380) from the back, counterbored
    # into the horn recess floor, + 2 anti-rotation pins on the head back
    HEAD_SCREW_CB_D=6.2, HEAD_SCREW_CB_DEPTH=2.0,
    PIN_D=3.0, PIN_H=2.5, PIN_HOLE_D=3.5, PIN_HOLE_DEPTH=3.0,
    PIN_R=11.0, PIN_ANGLES=(45.0, 225.0),   # plate-local, from +X toward +Z

    # mechanical stops: 2 tabs on the plate, 1 stop block on the tower
    STOP_R=(19.0, 25.0), STOP_HALF_W=3.0, STOP_GAP_TO_PLATE=3.0,
    TAB_R=(17.0, 28.0), TAB_HALF_W=2.0, TAB_LEN=5.0,
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
TOWER_FRONT_Y = P["TOWER_BACK_Y"] + P["TOWER_DEPTH"]
FLANGE_BACK_Y = TOWER_FRONT_Y                      # flange rests on the tower front face
SERVO_BOTTOM_Y = FLANGE_BACK_Y - P["FLANGE_Z_FROM_BOTTOM"]
SERVO_TOP_Y = SERVO_BOTTOM_Y + P["SERVO_H"]
SERVO_TOP_Z = AXIS_Z + P["SHAFT_FROM_END"]          # shaft end of the servo points up
SERVO_BOT_Z = SERVO_TOP_Z - P["SERVO_L"]
SERVO_MID_Z = (SERVO_TOP_Z + SERVO_BOT_Z) / 2.0
HORN_TOP_Y = SERVO_TOP_Y + P["HORN_TOP_ABOVE_BODY"]
PLATE_BACK_Y = HORN_TOP_Y - P["HORN_RECESS_DEPTH"]
PLATE_FRONT_Y = PLATE_BACK_Y + P["PLATE_T"]
HEAD_FRONT_Y = PLATE_FRONT_Y + P["HEAD_T"]       # lug / plunger face of the head
PHONE_Y0 = HEAD_FRONT_Y
PHONE_Y1 = PHONE_Y0 + P["PHONE_T"]
TOWER_BOTTOM_Z = BASE_TOP - P["TOWER_RECESS"]
TOWER_TOP_Z = AXIS_Z + P["TOWER_TOP_ABOVE_AXIS"]
SWEPT_R = 0.5 * math.hypot(P["PHONE_L"], P["PHONE_W"])
CAVITY_TOP_Z = BASE_TOP - P["BASE_TOP_SKIN"]

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


def extrude_z(curve, z0, z1):
    c = curve.DuplicateCurve()
    c.Translate(Vector3d(0, 0, z0 - c.PointAtStart.Z))
    srf = Surface.CreateExtrusion(c, Vector3d(0, 0, z1 - z0))
    b = srf.ToBrep().CapPlanarHoles(TOL)
    if b.SolidOrientation == Rhino.Geometry.BrepSolidOrientation.Inward:
        b.Flip()
    return b


def rounded_rect_prism(x0, x1, y0, y1, z0, z1, r):
    pts = [Point3d(x0, y0, z0), Point3d(x1, y0, z0), Point3d(x1, y1, z0),
           Point3d(x0, y1, z0), Point3d(x0, y0, z0)]
    poly = PolylineCurve(pts)
    crv = Curve.CreateFilletCornersCurve(poly, r, TOL, math.radians(1.0))
    return extrude_z(crv, z0, z1)


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


def rotated(brep, deg):
    b = brep.DuplicateBrep()
    b.Transform(Transform.Rotation(math.radians(deg), ROT_AXIS, AX))
    return b


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
# 2. TOWER
# --------------------------------------------------------------------------
def build_tower():
    hw = P["TOWER_W"] / 2.0
    c = P["CLR"]
    tower = rounded_rect_prism(-hw, hw, P["TOWER_BACK_Y"], TOWER_FRONT_Y,
                               TOWER_BOTTOM_Z, TOWER_TOP_Z, P["TOWER_CORNER_R"])
    stop = box(-P["STOP_HALF_W"], P["STOP_HALF_W"], TOWER_FRONT_Y - 1.0,
               PLATE_BACK_Y - P["STOP_GAP_TO_PLATE"],
               AXIS_Z + P["STOP_R"][0], AXIS_Z + P["STOP_R"][1])
    tower = union([tower, stop], "tower + stop")

    cutters = []
    # servo body pocket, through along Y (open at the back for the cable)
    sw = P["SERVO_W"] / 2.0 + c
    cutters.append(box(-sw, sw, P["TOWER_BACK_Y"] - 1, TOWER_FRONT_Y + 1,
                       SERVO_BOT_Z - c, SERVO_TOP_Z + c))
    # flange screw pilots
    for sz in (-1, 1):
        for sx in (-1, 1):
            cutters.append(cyl_y(sx * P["FLANGE_HOLES_W"] / 2.0,
                                 SERVO_MID_Z + sz * P["FLANGE_HOLES_L"] / 2.0,
                                 P["SERVO_SCREW_PILOT"] / 2.0,
                                 TOWER_FRONT_Y - P["SERVO_SCREW_DEPTH"], TOWER_FRONT_Y + 1))
    # cable channel down into the base
    cx = P["CABLE_X"] / 2.0
    cutters.append(box(-cx, cx, P["CABLE_Y"][0], P["CABLE_Y"][1],
                       TOWER_BOTTOM_Z - 1, SERVO_BOT_Z + 1.0))
    # heat-set inserts in the tower foot (screws from inside the base bay)
    for (x, y) in P["TOWER_INSERTS"]:
        cutters.append(cyl_z(x, y, P["M3_INSERT"] / 2.0, TOWER_BOTTOM_Z - 1,
                             TOWER_BOTTOM_Z + P["M3_INSERT_DEPTH"]))
    return diff(tower, cutters, "tower cuts")


# --------------------------------------------------------------------------
# 3. PLATE (built at rotation 0 = portrait)
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
    t = box(P["TAB_R"][0], P["TAB_R"][1], PLATE_BACK_Y - P["TAB_LEN"], PLATE_BACK_Y + 0.5,
            AXIS_Z - P["TAB_HALF_W"], AXIS_Z + P["TAB_HALF_W"])
    return rotated(t, phi)


def build_plate():
    r = P["PLATE_D"] / 2.0
    disc = cyl_y(0, AXIS_Z, r, PLATE_BACK_Y, PLATE_FRONT_Y)
    tab_a, tab_b, _ = stop_contact_angles()
    plate = union([disc, build_tab(tab_a), build_tab(tab_b)], "plate + tabs")
    recess_floor = PLATE_BACK_Y + P["HORN_RECESS_DEPTH"]
    cutters = [
        cyl_y(0, AXIS_Z, P["HORN_RECESS_D"] / 2.0, PLATE_BACK_Y - 1, recess_floor),
        # head screw: M3 clearance + button-head counterbore from the recess floor
        cyl_y(0, AXIS_Z, P["M3_CLEAR"] / 2.0, PLATE_BACK_Y - 1, PLATE_FRONT_Y + 1),
        cyl_y(0, AXIS_Z, P["HEAD_SCREW_CB_D"] / 2.0, PLATE_BACK_Y - 1,
              recess_floor + P["HEAD_SCREW_CB_DEPTH"]),
    ]
    for k in range(P["HORN_HOLE_N"]):
        a = math.radians(360.0 * k / P["HORN_HOLE_N"])
        rr = P["HORN_HOLE_BC"] / 2.0
        cutters.append(cyl_y(rr * math.cos(a), AXIS_Z + rr * math.sin(a), P["HORN_HOLE_D"] / 2.0,
                             PLATE_BACK_Y - 1, PLATE_FRONT_Y + 1))
    for (x, z) in pin_positions():
        cutters.append(cyl_y(x, z, P["PIN_HOLE_D"] / 2.0,
                             PLATE_FRONT_Y - P["PIN_HOLE_DEPTH"], PLATE_FRONT_Y + 1))
    return diff(plate, cutters, "plate cuts")


def pin_positions():
    out = []
    for deg in P["PIN_ANGLES"]:
        a = math.radians(deg)
        out.append((P["PIN_R"] * math.cos(a), AXIS_Z + P["PIN_R"] * math.sin(a)))
    return out


# --------------------------------------------------------------------------
# 4. BASE + LID
# --------------------------------------------------------------------------
def build_base(tripod_y):
    W, D, H = P["BASE_W"], P["BASE_D"], P["BASE_H"]
    base = rounded_rect_prism(-W / 2, W / 2, 0, D, 0, H, P["BASE_CORNER_R"])
    bx, by = P["BAY_X"], P["BAY_Y"]
    lx, ly = P["LID_X"], P["LID_Y"]
    blx, bly = P["BALLAST_X"], P["BALLAST_Y"]
    lid_t = P["LID_T"]

    # tripod boss inside the ballast cavity
    boss = cyl_z(0, tripod_y, P["TRIPOD_BOSS_D"] / 2.0, lid_t, CAVITY_TOP_Z + 0.5)

    cutters = []
    # electronics bay, open to the bottom (ESP32 slot + wiring + tower screws)
    cutters.append(box(bx[0], bx[1], by[0], by[1], -1, CAVITY_TOP_Z))
    # ESP32 USB opening in the back wall
    esp_cx = P["ESP32_X0"] + P["ESP32_W"] / 2.0
    cutters.append(box(esp_cx - P["USB_OPEN_W"] / 2, esp_cx + P["USB_OPEN_W"] / 2,
                       -1, by[0] + 1, P["USB_OPEN_Z"][0], P["USB_OPEN_Z"][1]))
    # 5 V USB-C breakout opening in the back wall
    pw = P["PWR_W"] / 2 + P["CLR"]
    cutters.append(box(P["PWR_X"] - pw, P["PWR_X"] + pw, -1, by[0] + 1,
                       P["PWR_Z0"], P["PWR_Z0"] + P["PWR_H"] + 2 * P["CLR"]))
    # ballast cavity + lid recess
    cutters.append(box(blx[0], blx[1], bly[0], bly[1], lid_t - 0.5, CAVITY_TOP_Z))
    cutters.append(box(lx[0], lx[1], ly[0], ly[1], -1, lid_t))
    # lid screw inserts
    for (x, y) in P["LID_SCREWS"]:
        cutters.append(cyl_z(x, y, P["M3_INSERT"] / 2.0, lid_t - 0.5, lid_t + P["M3_INSERT_DEPTH"]))
    # tower locating recess, screw holes and cable passage through the top skin
    th = P["TOWER_W"] / 2 + P["CLR"]
    cutters.append(box(-th, th, P["TOWER_BACK_Y"] - P["CLR"], TOWER_FRONT_Y + P["CLR"],
                       TOWER_BOTTOM_Z, H + 1))
    for (x, y) in P["TOWER_INSERTS"]:
        cutters.append(cyl_z(x, y, P["M3_CLEAR"] / 2.0, CAVITY_TOP_Z - 1, H + 1))
    cx = P["CABLE_X"] / 2 + P["CLR"]
    cutters.append(box(-cx, cx, P["CABLE_Y"][0] - P["CLR"], P["CABLE_Y"][1] + P["CLR"],
                       CAVITY_TOP_Z - 1, H + 1))
    # rubber feet recesses
    fi = P["FOOT_INSET"]
    for x in (-W / 2 + fi, W / 2 - fi):
        for y in (fi, D - fi):
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


def build_lid(tripod_y):
    lx, ly, c = P["LID_X"], P["LID_Y"], P["CLR"]
    lid = box(lx[0] + c, lx[1] - c, ly[0] + c, ly[1] - c, 0, P["LID_T"])
    cutters = [cyl_z(0, tripod_y, (P["TRIPOD_HOLE"] + 1.4) / 2.0, -1, P["LID_T"] + 1)]
    for (x, y) in P["LID_SCREWS"]:
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


def build_head():
    """Vendor head placed on the plate: back face on the plate front, axis on the rotation axis.

    File frame -> world: rotate +90 deg about X (file +Z -> world -Y, file +Y ->
    world +Z), then move the back face (file z=HEAD_T) to PLATE_FRONT_Y.
    Lugs end up on world +-X / +-Z (portrait), HEAD_SPIN turns them about the axis.
    The 2 anti-rotation pins are added on the back face (they print on top).
    """
    head = load_head_step()
    head.Transform(Transform.Rotation(math.radians(90.0), Vector3d(1, 0, 0), Point3d.Origin))
    head.Transform(Transform.Translation(0, HEAD_FRONT_Y, AXIS_Z))
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
    "TOWER": (230, 140, 40),
    "PLATE": (40, 170, 90),
    "BASE": (200, 200, 200),
    "LID": (120, 120, 120),
    "HEAD": (200, 60, 160),
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


LEGACY_LAYERS = ["HEAD_PLACEHOLDER", "TMP_INSPECT"]


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

    servo = build_servo()
    tower = build_tower()
    plate = build_plate()
    head = build_head()
    portrait, landscape = build_phones()

    # centre of mass estimate (tripod nut goes under it)
    k = P["PETG_DENSITY"] * P["PRINT_FILL"]
    pre_base = build_base(80.0)          # provisional; tripod moves to the CoM below
    masses = []
    for brep, dens in ((tower, k), (plate, k), (pre_base, k)):
        vol, c = volume_centroid(brep)
        masses.append((vol * dens, c))
    _, servo_c = volume_centroid(servo)
    masses.append((P["SERVO_G"], servo_c))
    masses.append((P["HEAD_G"], volume_centroid(head)[1]))
    masses.append((P["PHONE_G"], Point3d(0, (PHONE_Y0 + PHONE_Y1) / 2, AXIS_Z)))
    masses.append((P["BALLAST_G"], Point3d(0, sum(P["BALLAST_Y"]) / 2, P["LID_T"] + 5)))
    m_tot = sum(m for m, _ in masses)
    com = Point3d(sum(m * c.X for m, c in masses) / m_tot,
                  sum(m * c.Y for m, c in masses) / m_tot,
                  sum(m * c.Z for m, c in masses) / m_tot)
    tripod_y = min(max(com.Y, P["LID_Y"][0] + 6.0), P["BALLAST_Y"][1] - 14.0)

    base = build_base(tripod_y)
    lid = build_lid(tripod_y)

    parts = [("SERVO_REF", "servo_ref", servo), ("TOWER", "tower", tower),
             ("PLATE", "plate", plate), ("BASE", "base", base), ("LID", "lid", lid),
             ("HEAD", "head", head),
             ("PHONE_ENVELOPE", "phone_portrait", portrait),
             ("PHONE_ENVELOPE", "phone_landscape", landscape)]
    for layer, name, brep in parts:
        add(brep, layer, name)
        report.append("%-17s solid=%s valid=%s  %s" % (name, brep.IsSolid, brep.IsValid, bbox_str(brep)))

    swept = Circle(Plane(Point3d(0, PHONE_Y1, AXIS_Z), Vector3d(0, 1, 0)), SWEPT_R).ToNurbsCurve()
    add(swept, "REF_CURVES", "phone_swept_circle")
    add(Rhino.Geometry.LineCurve(Point3d(0, P["TOWER_BACK_Y"], AXIS_Z), Point3d(0, PHONE_Y1 + 10, AXIS_Z)),
        "REF_CURVES", "rotation_axis")

    # stops check: tabs vs stop block across the travel
    stop = box(-P["STOP_HALF_W"], P["STOP_HALF_W"], TOWER_FRONT_Y,
               PLATE_BACK_Y - P["STOP_GAP_TO_PLATE"], AXIS_Z + P["STOP_R"][0], AXIS_Z + P["STOP_R"][1])
    tab_a, tab_b, _ = stop_contact_angles()
    tabs = [build_tab(tab_a), build_tab(tab_b)]
    lo, hi, ot = P["ROT_RANGE"][0], P["ROT_RANGE"][1], P["OVERTRAVEL"]

    def clash(theta):
        return any(intersects(rotated(t, theta), stop) for t in tabs)

    mid = (lo + hi) / 2.0
    free = [th for th in (lo - ot + 0.5, lo, mid, hi, hi + ot - 0.5) if clash(th)]
    blocked = [th for th in (lo - ot - 0.5, hi + ot + 0.5) if not clash(th)]
    # tabs vs servo: tabs (r >= TAB_R[0], outside the gear boss) stay in front of the servo top face
    tab_gap = (PLATE_BACK_Y - P["TAB_LEN"]) - SERVO_TOP_Y

    # head checks: seated on the plate without overlap (pins excepted), clear of
    # the tower stop through the whole travel, sleeve free to move back
    head_core = load_head_step()
    head_core.Transform(Transform.Rotation(math.radians(90.0), Vector3d(1, 0, 0), Point3d.Origin))
    head_core.Transform(Transform.Translation(0, HEAD_FRONT_Y, AXIS_Z))
    head_plate_clash = intersects(head_core, plate)
    pins_in_holes = not intersects(head, plate)
    head_stop_clash = [th for th in (lo - ot, lo, mid, hi, hi + ot)
                       if intersects(rotated(head, th), stop)]
    hb = head.GetBoundingBox(True)
    head_phone_gap = PHONE_Y0 - hb.Max.Y
    # sleeve flange back face is the head's planar face at file z=18 -> world Y = HEAD_FRONT_Y - 18
    sleeve_travel = (HEAD_FRONT_Y - 18.0) - PLATE_FRONT_Y

    gap_base = AXIS_Z - SWEPT_R - BASE_TOP
    report += [
        "AXIS_Z=%.2f (%.1f above base top)  swept R=%.2f  min gap to base top=%.2f  to desk=%.2f (required %.1f) -> %s"
        % (AXIS_Z, P["AXIS_ABOVE_BASE"], SWEPT_R, gap_base, AXIS_Z - SWEPT_R, P["CLEAR_MARGIN"],
           "OK" if gap_base >= P["CLEAR_MARGIN"] else "FAIL"),
        "Y stack: tower back %.1f, tower front/flange %.1f, servo top %.1f, horn top %.1f, plate %.1f..%.1f, head ..%.1f, phone %.1f..%.1f"
        % (P["TOWER_BACK_Y"], TOWER_FRONT_Y, SERVO_TOP_Y, HORN_TOP_Y, PLATE_BACK_Y, PLATE_FRONT_Y,
           HEAD_FRONT_Y, PHONE_Y0, PHONE_Y1),
        "tabs at plate-local phi=%.1f / %.1f deg; stop clash inside travel: %s; not blocked beyond overtravel: %s; tab-to-servo gap %.2f mm"
        % (tab_a, tab_b, free or "none", blocked or "none", tab_gap),
        "CoM estimate (ballast %.0f g, total %.0f g): X=%.1f Y=%.1f Z=%.1f; tripod nut at Y=%.1f; base footprint Y 0..%.0f"
        % (P["BALLAST_G"], m_tot, com.X, com.Y, com.Z, tripod_y, P["BASE_D"]),
        "head: core/plate overlap=%s, pins clear in holes=%s, head vs stop clash over travel: %s, "
        "head front to phone gap %.2f, sleeve flange to plate %.2f mm (free travel)"
        % (head_plate_clash, pins_in_holes, head_stop_clash or "none", head_phone_gap, sleeve_travel),
    ]

    if P["EXPORT"]:
        out = P["OUT_DIR"]
        stl_dir = os.path.join(out, "stl")
        if not os.path.isdir(stl_dir):
            os.makedirs(stl_dir)
        rx = lambda deg: Transform.Rotation(math.radians(deg), Vector3d(1, 0, 0), Point3d.Origin)
        exports = [("base.stl", base, rx(180)),     # top face on the bed
                   ("tower.stl", tower, rx(90)),    # back face on the bed
                   ("plate.stl", plate, rx(-90)),   # head mounting face on the bed
                   ("head.stl", head, rx(-90)),     # lug face on the bed (vendor orientation)
                   ("lid.stl", lid, Transform.Identity)]
        for fname, brep, xf in exports:
            closed, nf, size = write_stl(brep, os.path.join(stl_dir, fname), xf)
            report.append("%-9s closed=%s tris=%d print bbox %.1f x %.1f x %.1f"
                          % (fname, closed, nf, size[0], size[1], size[2]))
        write_step(os.path.join(out, "phone-stand.rhino.step"),
                   [("Base", base), ("Tower", tower), ("Plate", plate), ("Head", head), ("Lid", lid)])
        report.append("phone-stand.rhino.step written")
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
