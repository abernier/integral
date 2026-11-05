# Runs inside Blender, headless, for `pnpm render` (render.ts): one part's GLB rendered from several views in the
# site's studio style, into WebP files. Not a Blender addon: Blender is just the renderer.
#
#   blender --background --factory-startup --python scripts/render.blender.py -- <glb> <out dir> <stem> <samples> <views>
#
# `<views>` is JSON, each view's name to its azimuth (`{"front": 0, ...}`): render.ts builds it from its VIEWS, the one
# place the views are defined. Writes `<out dir>/<stem>.<view>.webp` for every view, printing `render: <file>` for each.
#
# The style, bright and matte (a product-shot studio): a pale grey floor big enough to hide the horizon, a dim
# white dome, one large key light high in front that moves with the camera (so the lit face is the one seen) and
# throws the soft shadow under the part, a weak fill and a weak rim; every material matte, its GLB colour muted
# (`pastel`); AgX with a medium-high contrast look. Cycles on the GPU when there is one, denoised.
#
# A view's azimuth is degrees around the part from its front (the GLB's -Y), clockwise seen from above; the elevation
# is ELEVATION for all. Blender 5.2: every material has a node tree (`use_nodes` is deprecated).

import colorsys
import json
import math
import sys

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1 :]
if len(argv) != 5:
    sys.exit("render: usage: render.blender.py -- <glb> <out dir> <stem> <samples> <views as JSON>; render.ts passes them")
GLB, OUT, STEM = argv[:3]
SAMPLES = int(argv[3])
VIEWS = json.loads(argv[4])  # {view: azimuth}, from render.ts

ELEVATION = math.radians(22)
RESOLUTION = (1200, 900)
LENS = 90  # mm: a long lens, a flat perspective
# The key light moves with the camera, so the lit face is the one seen: KEY_REACH along the camera's azimuth,
# KEY_OFFSET towards the front and the right, KEY_HEIGHT above the part's centre.
KEY_HEIGHT = 4.2
KEY_REACH = 1.5
KEY_OFFSET = Vector((0.9, -1.8, 0))


def principled(material):
    """The material's Principled BSDF node, or None when its tree has none."""
    if material.node_tree is None:
        return None
    return next((n for n in material.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)


def pastel(rgb):
    """The GLB's colour muted for the style: less saturated, its value pulled towards a mid tone."""
    h, s, v = colorsys.rgb_to_hsv(*rgb[:3])
    s *= 0.65
    v += (0.6 - v) * 0.4
    return (*colorsys.hsv_to_rgb(h, s, v), 1.0)


def aim(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def area_light(name, location, energy, size, target):
    data = bpy.data.lights.new(name, "AREA")
    data.energy = energy
    data.size = size
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    obj.location = location
    aim(obj, target)
    return obj


# An empty scene, the part in it
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
bpy.ops.import_scene.gltf(filepath=GLB)
meshes = [o for o in scene.objects if o.type == "MESH"]
if not meshes:
    sys.exit(f"render: no mesh in {GLB}")
for obj in meshes:
    if hasattr(obj.data, "shade_smooth_by_angle"):
        obj.data.shade_smooth_by_angle(angle=math.radians(30))
# Each material once: several meshes share one, and `pastel` applied again would mute it further
for material in {material for obj in meshes for material in obj.data.materials if material}:
    bsdf = principled(material)
    if bsdf is None:
        continue
    bsdf.inputs["Base Color"].default_value = pastel(bsdf.inputs["Base Color"].default_value)
    bsdf.inputs["Roughness"].default_value = 0.6
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = 0.4

# Where the part is: the centre of its bounding box, and the radius that holds it whichever way it is seen
points = [o.matrix_world @ Vector(corner) for o in meshes for corner in o.bound_box]
low = Vector([min(p[i] for p in points) for i in range(3)])
high = Vector([max(p[i] for p in points) for i in range(3)])
centre = (low + high) / 2
radius = (high - low).length / 2

# The studio
bpy.ops.mesh.primitive_plane_add(size=60, location=(centre.x, centre.y, low.z))
ground = bpy.context.active_object
ground.name = "Ground"
ground_material = bpy.data.materials.new("Ground")
assert ground_material.node_tree is not None, "render: a new material has no node tree: Blender 5.2 or later is needed"
bsdf = principled(ground_material)
bsdf.inputs["Base Color"].default_value = (0.62, 0.63, 0.66, 1)
bsdf.inputs["Roughness"].default_value = 0.85
ground.data.materials.append(ground_material)

world = bpy.data.worlds.new("World")
scene.world = world
world.use_nodes = True
background = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
background.inputs["Color"].default_value = (0.85, 0.87, 0.9, 1)
background.inputs["Strength"].default_value = 0.35

key = area_light("Key", centre, 450, 2.5, centre)  # placed per view, below
area_light("Fill", centre + Vector((-4.5, -2.0, 2.0)), 70, 6.0, centre)
area_light("Rim", centre + Vector((0.5, 4.0, 2.5)), 40, 4.0, centre)

camera_data = bpy.data.cameras.new("Camera")
camera_data.lens = LENS
camera = bpy.data.objects.new("Camera", camera_data)
scene.collection.objects.link(camera)
scene.camera = camera

# Render settings
try:
    scene.render.engine = "CYCLES"
except TypeError as error:
    sys.exit(f"render: {error}")
cycles_preferences = bpy.context.preferences.addons["cycles"].preferences
for device_type in ("METAL", "CUDA", "OPTIX", "HIP", "ONEAPI"):
    try:
        cycles_preferences.compute_device_type = device_type
        cycles_preferences.get_devices()
    except TypeError:
        continue
    if any(d.type == device_type for d in cycles_preferences.devices):
        for device in cycles_preferences.devices:
            device.use = device.type == device_type
        scene.cycles.device = "GPU"
        break
scene.cycles.samples = SAMPLES
scene.cycles.use_denoising = True
scene.render.resolution_x, scene.render.resolution_y = RESOLUTION
scene.render.resolution_percentage = 100
scene.view_settings.view_transform = "AgX"
try:
    scene.view_settings.look = "AgX - Medium High Contrast"
except TypeError:
    pass
scene.view_settings.exposure = -0.15
scene.render.image_settings.file_format = "WEBP"
scene.render.image_settings.color_mode = "RGB"
scene.render.image_settings.quality = 90

# The views: the camera on a circle around the part, far enough that the part's sphere fits the frame's shorter side
sensor = camera_data.sensor_width * min(1, RESOLUTION[1] / RESOLUTION[0])
distance = radius / math.sin(math.atan(sensor / 2 / LENS)) * 1.05
print(f"render: {STEM}, {len(meshes)} meshes, radius {radius:.2f} m, {scene.cycles.device.lower()} {SAMPLES} samples")
for view, azimuth in VIEWS.items():
    a = math.radians(azimuth)
    around = Vector((math.sin(a), -math.cos(a), 0))
    camera.location = centre + (around * math.cos(ELEVATION) + Vector((0, 0, math.sin(ELEVATION)))) * distance
    aim(camera, centre)
    key.location = centre + around * KEY_REACH + KEY_OFFSET + Vector((0, 0, KEY_HEIGHT))
    aim(key, centre)
    scene.render.filepath = f"{OUT}/{STEM}.{view}.webp"
    bpy.ops.render.render(write_still=True)
    print(f"render: {scene.render.filepath}")
