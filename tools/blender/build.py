"""Rebuild the editable architectural models, studio renders and single-file web meshes."""
import base64
import importlib
import json
import struct
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
import tower
import bridge
import neighborhood

# Rebuilding in the same Blender MCP session should pick up edited model sources.
for module in (mesh, tower, bridge, neighborhood):
    importlib.reload(module)


def encode_scene(scene):
    """Indexed signed 1/128-unit coordinates, with Blender Z-up rotated into Three.js Y-up."""
    batches = {}
    for obj in scene.objects:
        if obj.type != "MESH" or "ink_material" not in obj:
            continue
        positions, indices = batches.setdefault(obj["ink_material"], ({}, []))
        geo = obj.data
        geo.calc_loop_triangles()
        verts = []
        for vert in geo.vertices:
            x, y, z = obj.matrix_world @ vert.co
            verts.append(tuple(round(v * 128) for v in (x, z, -y)))
        for tri in geo.loop_triangles:
            points = [verts[i] for i in tri.vertices]
            if len(set(points)) == 3:
                indices.extend(positions.setdefault(p, len(positions)) for p in points)

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
    return result


def studio(scene, name):
    """Soft daylight and a paper-coloured ground, kept editable with the subject."""
    is_tower = name == "tower"
    camera_data = bpy.data.cameras.new("Architecture lens")
    cam = bpy.data.objects.new("Study camera", camera_data)
    scene.collection.objects.link(cam)
    target = Vector((0, 0, 15 if is_tower else 7.8))
    direction = Vector((.75, -1.55, .73) if is_tower else (2.8, -1.35, 1.0)).normalized()
    cam.location = target + direction * (130 if is_tower else 330)
    cam.rotation_euler = (-direction).to_track_quat("-Z", "Y").to_euler()
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = 56 if is_tower else 299
    camera_data.clip_end = 1800
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
    scene.render.resolution_x = 1040 if is_tower else 1800
    scene.render.resolution_y = 1080 if is_tower else 700
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = str(OUTPUT / (name + ".png"))


def build():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    models = {"tower": tower.build, "bridge": bridge.build}
    for name in ("lane", "arcade", "wharf", "apartment", "highrise"):
        models[name] = getattr(neighborhood, name)
    window = bpy.context.window
    previous_scene = window.scene
    web = {}
    for name, create in models.items():
        # Model authors always work in a fresh scene, even if a personal file is open.
        scene = bpy.data.scenes.new("Wuhan / " + name)
        window.scene = scene
        try:
            create()
            bpy.context.view_layer.update()
            web[name] = encode_scene(scene)
            if name in ("tower", "bridge"):
                studio(scene, name)
                mesh.save_project(scene, OUTPUT / (name + ".blend"))
                bpy.ops.render.render(write_still=True, scene=scene.name)
                if name == "bridge":
                    # The complete crossing and the gateway detail need different viewing distances.
                    cam = scene.camera
                    target = Vector((0, -57, 9))
                    direction = Vector((1.65, -1.2, .56)).normalized()
                    cam.location = target + direction * 120
                    cam.rotation_euler = (-direction).to_track_quat("-Z", "Y").to_euler()
                    cam.data.ortho_scale = 75
                    scene.render.resolution_x, scene.render.resolution_y = 1080, 680
                    scene.render.filepath = str(OUTPUT / "bridge-detail.png")
                    bpy.ops.render.render(write_still=True, scene=scene.name)
        finally:
            window.scene = previous_scene
            for obj in list(scene.objects):
                bpy.data.objects.remove(obj, do_unlink=True)
            bpy.data.scenes.remove(scene)
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
