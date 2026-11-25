"""Rebuild the editable architectural models, studio renders and single-file web meshes."""
import base64
import importlib
import json
import struct
import tempfile
import sys
from pathlib import Path

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
OUTPUT = ROOT / "output" / "architecture"
sys.dont_write_bytecode = True
sys.path.insert(0, str(HERE))
import mesh
import landmarks
import neighborhood
import tower_park

# Rebuilding in the same Blender MCP session should pick up edited model sources.
for module in (mesh, landmarks, neighborhood, tower_park):
    importlib.reload(module)


def encode_scene(scene):
    """Indexed signed 1/128-unit coordinates, with Blender Z-up rotated into Three.js Y-up."""
    batches = {}
    unique = {}
    smooth_ranges = {}
    for obj in scene.objects:
        if obj.type != "MESH" or "ink_material" not in obj:
            continue
        positions, indices = batches.setdefault(obj["ink_material"], ({}, []))
        start = len(indices)
        geo = obj.data
        geo.calc_loop_triangles()
        verts = []
        for vert in geo.vertices:
            x, y, z = obj.matrix_world @ vert.co
            verts.append(tuple(round(v * 128) for v in (x, z, -y)))
        for tri in geo.loop_triangles:
            points = [verts[i] for i in tri.vertices]
            a, b, c = points
            ab = tuple(y - x for x, y in zip(a, b))
            ac = tuple(y - x for x, y in zip(a, c))
            if all(ab[i] * ac[(i+1)%3] == ab[(i+1)%3] * ac[i] for i in range(3)):
                continue
            face = tuple(sorted(points))
            seen = unique.setdefault(obj["ink_material"], set())
            if face not in seen:
                indices.extend(positions.setdefault(p, len(positions)) for p in points)
                seen.add(face)
        if len(indices) > start and all(face.use_smooth for face in geo.polygons):
            smooth_ranges.setdefault(obj["ink_material"], []).extend((start, len(indices)))

    # Bake sky visibility once. It preserves deep eaves, open trusses and arcades in the ink shader.
    world_points, triangles = [], []
    for points, indices in batches.values():
        base = len(world_points)
        world_points.extend((x / 128, y / 128, z / 128) for x, y, z in points)
        triangles.extend(tuple(base + i for i in indices[k:k + 3]) for k in range(0, len(indices), 3))
    tree = BVHTree.FromPolygons(world_points, triangles, all_triangles=True)
    rays = [Vector(v).normalized() for v in ((-.45, .85, .5), (-.32, .90, .60), (0, 1, 0),
            (-1, .56, 0), (1, .56, 0), (0, .56, -1), (0, .56, 1), (.68, .7, -.60))]
    def open_sky(point):
        v = Vector(point) / 128
        exposed = sum(tree.ray_cast(v + d * .045, d, 27)[0] is None for d in rays)
        return round(255 * exposed / len(rays))

    def packed(fmt, values):
        return base64.b64encode(struct.pack(f"<{len(values)}{fmt}", *values)).decode("ascii")

    result = {}
    for key, (points, indices) in sorted(batches.items()):
        if len(points) > 65535:
            raise ValueError(f"{key} exceeds 16-bit index budget")
        result[key] = [packed("h", [v for p in points for v in p]), packed("H", indices),
                       packed("B", [open_sky(p) for p in points])]
        if key in smooth_ranges:
            result[key].append(packed("I", smooth_ranges[key]))
    return result


def studio(scene, name):
    """Soft daylight and a paper-coloured ground, kept editable with the subject."""
    wide = name in ("bridge", "yingwuzhou")
    scene.render.resolution_x, scene.render.resolution_y = (1680, 700) if wide else (1120, 960)
    directions = {"tower": (-1.55, -.60, .45), "bridge": (2.8, -1.35, .91),
                  "yingwuzhou": (2.9, -1.03, .89), "guiyuan": (.54, -1, .78),
                  "lake": (.65, -1, .50), "wuda": (.42, -1, .47)}
    direction = Vector(directions.get(name, (.54, -1.28, .53))).normalized()
    rotation = (-direction).to_track_quat("-Z", "Y")
    side, up = rotation @ Vector((1,0,0)), rotation @ Vector((0,1,0))
    points = [obj.matrix_world @ vert.co for obj in scene.objects if obj.type == "MESH"
              for vert in obj.data.vertices if (obj.matrix_world @ vert.co).z >= -.06]
    ranges = [(min(p.dot(axis) for p in points), max(p.dot(axis) for p in points))
              for axis in (side, up, direction)]
    target = sum((axis * ((a+b)/2) for axis, (a,b) in zip((side, up, direction), ranges)), Vector())
    aspect = scene.render.resolution_x / scene.render.resolution_y
    width = max(ranges[0][1]-ranges[0][0], (ranges[1][1]-ranges[1][0])*aspect) * 1.13
    cam = viewpoint(scene, "建筑全貌", target, direction, width)
    scene.camera = cam
    world = bpy.data.worlds.new("Warm sky")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    bg.inputs["Color"].default_value = (.82, .85, .88, 1)
    bg.inputs["Strength"].default_value = .8
    light = bpy.data.lights.new("Afternoon sun", "SUN")
    light.energy = 3.0
    light.angle = .20
    sun = bpy.data.objects.new(light.name, light)
    scene.collection.objects.link(sun)
    sun.rotation_euler = Vector((.72, .56, -1)).to_track_quat("-Z", "Y").to_euler()
    floor = mesh.Part("Ground for studio photography", "stone")
    floor.box((0, 0, -.56), (3600, 3600, 1))
    obj = floor.finish()
    paper = bpy.data.materials.new("Studio / warm paper")
    paper.diffuse_color = (.76, .72, .62, 1)
    obj.data.materials[0] = paper
    del obj["ink_material"]
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 12
    scene.cycles.use_denoising = True
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = str(OUTPUT / (name + ".png"))


def viewpoint(scene, name, target, direction, width):
    lens = bpy.data.cameras.new(name)
    lens.type, lens.ortho_scale, lens.clip_end = "ORTHO", width, 3600
    camera = bpy.data.objects.new(name, lens)
    scene.collection.objects.link(camera)
    direction = Vector(direction).normalized()
    camera.location = Vector(target) + direction * max(75, width * 1.8)
    camera.rotation_euler = (-direction).to_track_quat("-Z", "Y").to_euler()
    return camera


def plate(scene, name):
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = str(OUTPUT / (name + ".png"))
    bpy.ops.render.render(write_still=True, scene=scene.name)
    # Reuse the same linear render for the single-file viewer; apply its view transform once.
    with tempfile.TemporaryDirectory() as folder:
        jpeg = Path(folder) / "plate.jpg"
        scene.render.image_settings.file_format = "JPEG"
        scene.render.image_settings.quality = 82
        bpy.data.images["Render Result"].save_render(str(jpeg), scene=scene)
        return base64.b64encode(jpeg.read_bytes()).decode("ascii")


def bake_model(name, create):
    window = bpy.context.window
    previous_scene = window.scene
    scene = bpy.data.scenes.new("Wuhan / " + name)
    window.scene = scene
    try:
        create()
        bpy.context.view_layer.update()
        web = encode_scene(scene)
        plates = {}
        if name in landmarks.BUILDERS:
            studio(scene, name)
            details = []
            if name == "tower":
                details.append(("tower-plaque", viewpoint(scene, "西面五层匾额",
                                (-5.15, 0, 26.56), (-1, -.07, .015), 7.3)))
            elif name == "bridge":
                details.append(("bridge-detail", viewpoint(scene, "桥头堡与钢梁",
                                (0, -57, 9), (1.65, -1.2, .56), 75)))
                details.append(("bridge-craft", viewpoint(scene, "铸铁栏花 · 鱼戏莲荷",
                                (5.90, -49.80435, 12.57), (1, -.14, .11), 3.6)))
                details.append(("bridge-name", viewpoint(scene, "武昌桥头游览铭牌",
                                (11.65, 82, 10.19), (1, -.10, .10), 10)))
            elif name == "yingwuzhou":
                details.append(("yingwuzhou-craft", viewpoint(scene, "主缆、吊杆与边梁",
                                (7.40, -34, 10.6), (.66, .70, .28), 11.8)))
                details.append(("yingwuzhou-detail", viewpoint(scene, "中央主塔横梁桥名",
                                (0, -1.09, 33.45), (.12, -1, .07), 24)))
            mesh.save_project(scene, OUTPUT / (name + ".blend"))
            plates[name] = plate(scene, name)
            for key, camera in details:
                scene.camera = camera
                scene.render.resolution_x, scene.render.resolution_y = 1120, 680
                plates[key] = plate(scene, key)
        return web, plates
    finally:
        window.scene = previous_scene
        for obj in list(scene.objects):
            bpy.data.objects.remove(obj, do_unlink=True)
        bpy.data.scenes.remove(scene)


def build():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    models = dict(landmarks.BUILDERS)
    for name in ("lane", "arcade", "wharf", "apartment", "highrise", "terrace_tower", "slab_tower"):
        models[name] = getattr(neighborhood, name)
    models.update(tower_park.BUILDERS)
    web, plates = {}, {}
    for name, create in models.items():
        web[name], model_plates = bake_model(name, create)
        plates.update(model_plates)
    (ROOT / "src" / "architecture-plates.gen.js").write_text(
        "// Cycles studio views, encoded as JPEG for the offline atlas.\nconst LANDMARK_PLATES = "
        + json.dumps(plates, indent=2) + ";\n", encoding="utf-8")
    target = ROOT / "src" / "architecture.gen.js"
    # One material per line keeps the generated file inspectable without a binary dependency.
    lines = ["// Generated by tools/blender/build.py (signed XYZ / 128, uint16 triangles, uint8 sky visibility).",
             "const ARCHITECTURE = {"]
    for name, materials in web.items():
        lines.append(f'  "{name}": {{')
        for key, payload in materials.items():
            lines.append(f'    "{key}": ' + json.dumps(payload, separators=(",", ":")) + ",")
        lines.append("  },")
    target.write_text("\n".join(lines) + "\n};\n", encoding="utf-8")
    print(f"Exported {len(web)} models to {target}, {target.stat().st_size:,} bytes")


if __name__ == "__main__":
    build()
