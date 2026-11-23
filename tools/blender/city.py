"""Assemble the actual captured map as an editable Blender scene and render the two rivers."""
import base64
import gzip
import importlib
import json
import math
import random
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Matrix, Vector

HERE = Path(__file__).resolve().parent
OUT = HERE.parents[1] / "output" / "architecture"
sys.dont_write_bytecode = True
sys.path.insert(0, str(HERE))
import landmarks
import mesh
import neighborhood

for module in (mesh, landmarks, neighborhood):
    importlib.reload(module)

AXES = Matrix.Rotation(math.pi / 2, 4, 'X')  # Three Y-up to Blender Z-up.


def placement(elements):
    matrix = Matrix([elements[i:i + 4] for i in range(0, 16, 4)]).transposed()
    return AXES @ matrix @ AXES.inverted()


def collection(parent, name):
    result = bpy.data.collections.new(name)
    parent.children.link(result)
    return result


def relocate(obj, dest):
    for owner in tuple(obj.users_collection):
        owner.objects.unlink(obj)
    dest.objects.link(obj)


def paint(name, hexcolor):
    rgb = bytes.fromhex(hexcolor)
    values = [((v / 255 + .055) / 1.055) ** 2.4 for v in rgb]
    mat = bpy.data.materials.new("江城 / " + name)
    mat.diffuse_color = (*values, 1)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Roughness"].default_value = .93
    shader.inputs["Base Color"].default_value = mat.diffuse_color
    if name in ("Water", "Land", "Hills"):
        # A broad tonal wash run through physical scene coordinates, consistent across the banks.
        nodes, links = mat.node_tree.nodes, mat.node_tree.links
        coords = nodes.new("ShaderNodeNewGeometry")
        noise = nodes.new("ShaderNodeTexNoise")
        noise.inputs["Scale"].default_value = .035 if name == "Water" else .065
        noise.inputs["Detail"].default_value = 3
        ramp = nodes.new("ShaderNodeValToRGB")
        for element, factor in zip(ramp.color_ramp.elements, (.78, 1.08)):
            element.color = (*[min(1, c * factor) for c in values], 1)
        links.new(coords.outputs["Position"], noise.inputs["Vector"])
        links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
        links.new(ramp.outputs["Color"], shader.inputs["Base Color"])
    return mat


def imported_mesh(item, mat, dest):
    points = np.frombuffer(base64.b64decode(item["positions"]), dtype="<f4").reshape(-1, 3)
    points = points[:, [0, 2, 1]].copy()
    points[:, 1] *= -1
    indices = (np.frombuffer(base64.b64decode(item["index"]), dtype="<u4") if item["index"]
               else np.arange(len(points))).reshape(-1, 3)
    data = bpy.data.meshes.new(item["name"])
    data.from_pydata(points.tolist(), [], indices.tolist())
    data.materials.append(mat)
    if item["material"] == "Hills":
        data.polygons.foreach_set("use_smooth", np.ones(len(indices), dtype=bool))
    data.update()
    obj = bpy.data.objects.new(item["name"], data)
    dest.objects.link(obj)
    obj.matrix_world = placement(item["matrix"])
    if item["material"] == "Streets":
        # Thin paving ribbons meet at intersections; their pigment casts no extra shadow.
        obj.visible_shadow = False
        obj.visible_diffuse = False
        obj.visible_glossy = False


def city_blocks(scene, captured, streets):
    labels = {"lane": "里分", "arcade": "沿江洋行", "wharf": "码头货仓",
              "apartment": "退台住宅", "highrise": "现代塔楼"}
    for kind, lots in captured.items():
        before = set(scene.objects)
        getattr(neighborhood, kind)()
        parts = sorted(set(scene.objects) - before, key=lambda obj: obj.name)
        bpy.ops.object.select_all(action='DESELECT')
        for part in parts:
            part.select_set(True)
        bpy.context.view_layer.objects.active = parts[0]
        bpy.ops.object.join()
        template = parts[0]
        dest = collection(streets, labels[kind])
        relocate(template, dest)
        template.data.name = labels[kind] + " · 共享网格"
        for i, matrix in enumerate(lots):
            obj = bpy.data.objects.new(labels[kind], template.data) if i else template
            if i:
                dest.objects.link(obj)
            obj.name = f"{labels[kind]} {i+1:03}"
            obj.matrix_world = placement(matrix)


def main_landmark(scene, key, data, dest):
    before = set(scene.objects)
    landmarks.BUILDERS[key]()
    parts = set(scene.objects) - before
    root = bpy.data.objects.new(data["name"], None)
    dest.objects.link(root)
    root.matrix_world = placement(data["matrix"])
    for obj in parts:
        relocate(obj, dest)
        obj.parent = root


def water(rivers, materials, dest):
    data = bpy.data.meshes.new("江面")
    data.from_pydata([(-3000,-3000,0), (3000,-3000,0), (3000,3000,0), (-3000,3000,0)],
                     [], [(0,1,2,3)])
    data.materials.append(materials["Water"])
    obj = bpy.data.objects.new("两江与湖面", data)
    dest.objects.link(obj)
    # Break a few strokes along actual centreline tangents, tapering both ends.
    rng = random.Random(1957)
    for river, name in zip(rivers, ("长江", "汉水")):
        verts, faces = [], []
        for i in range(1, len(river)-5):
            for _ in range(2):
                offset = rng.uniform(-.88, .88)
                length = rng.uniform(.62, 2.22)
                width = rng.uniform(.10, .31)
                start = len(verts)
                offset_along = rng.random()
                for j in range(6):
                    t = i + offset_along + length * j / 5
                    k, f = int(t), t % 1
                    x, y, nx, ny, half = (a + (b-a)*f for a,b in zip(river[k], river[k+1]))
                    w = width * (.04 + math.sin(math.pi*j/5))
                    for sign in (-1, 1):
                        lateral = half * offset + w * sign
                        verts.append((x + lateral * nx, y + lateral * ny, .07))
                    if j:
                        k = start + j * 2
                        faces.append((k-2, k-1, k+1, k))
        data = bpy.data.meshes.new(name + " · 笔触")
        data.from_pydata(verts, [], faces)
        data.materials.append(materials["Ripples"])
        dest.objects.link(bpy.data.objects.new(data.name, data))


def lighting(scene, camera_group):
    target = Vector((-86, 85, 8))
    direction = Vector((.15, -1, .77)).normalized()
    lens = bpy.data.cameras.new("两江鸟瞰")
    lens.type = 'ORTHO'
    lens.ortho_scale = 520
    lens.clip_end = 3600
    cam = bpy.data.objects.new(lens.name, lens)
    camera_group.objects.link(cam)
    cam.location = target + direction * 960
    cam.rotation_euler = (-direction).to_track_quat('-Z', 'Y').to_euler()
    scene.camera = cam
    light = bpy.data.lights.new("西南日光", 'SUN')
    light.energy = 3.30
    light.angle = math.radians(8)
    sun = bpy.data.objects.new(light.name, light)
    camera_group.objects.link(sun)
    sun.rotation_euler = Vector((.92,.56,-.85)).to_track_quat('-Z','Y').to_euler()
    scene.world = bpy.data.worlds.new("阴翳天光")
    scene.world.use_nodes = True
    sky = scene.world.node_tree.nodes.get("Background")
    sky.inputs["Color"].default_value = (.85,.88,.90,1)
    sky.inputs["Strength"].default_value = .48
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 12
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = 1800, 1080
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.filepath = "//city.png"
    # Preserve the intimate two-river opening and add a lens spanning all visitable sites.
    overview = cam.copy()
    overview.data = lens.copy()
    overview.name = overview.data.name = "全城十五景"
    camera_group.objects.link(overview)
    rotation = (-Vector((.15, -1, .92)).normalized()).to_track_quat('-Z', 'Y')
    right, up, back = (rotation @ Vector(v) for v in ((1,0,0), (0,1,0), (0,0,1)))
    points = [obj.matrix_world @ Vector(corner) for obj in scene.objects if obj.type == "MESH"
              and obj.parent and obj.parent.type == "EMPTY" for corner in obj.bound_box]
    ranges = [(min(p.dot(axis) for p in points), max(p.dot(axis) for p in points)) for axis in (right, up, back)]
    centre = sum((axis*((a+b)/2) for axis,(a,b) in zip((right,up,back),ranges)), Vector())
    overview.location = centre + back * 1700
    overview.rotation_euler = rotation.to_euler()
    overview.data.ortho_scale = max(ranges[0][1]-ranges[0][0], (ranges[1][1]-ranges[1][0])*5/3)*1.16
    return overview


def build():
    with gzip.open(OUT / "city-capture.json.gz", "rt", encoding="utf-8") as stream:
        capture = json.load(stream)
    window = bpy.context.window
    previous = window.scene
    previous_collections = set(bpy.data.collections)
    scene = bpy.data.scenes.new("水墨武汉 · 两江三镇")
    window.scene = scene
    try:
        mats = {k: paint(k, v) for k,v in {
            "Land":"e4dcc9", "Hills":"a4af91", "Pines":"526d59", "Slate":"677872",
            "Masonry":"c4b9a2", "Ink":"4b5049", "Paper":"d4cfc2",
            "Water":"9ab7b2", "Ripples":"c4d1c4", "Streets":"c6c1af", "Boat":"aa9980"}.items()}
        groups = {}
        def group(name):
            if name not in groups:
                groups[name] = collection(scene.collection, name)
            return groups[name]
        for item in capture["meshes"]:
            imported_mesh(item, mats[item["material"]], group(item["group"]))
        water(capture["rivers"], mats, group("两江水墨"))
        city_blocks(scene, capture["lots"], group("武汉街坊"))
        for key, record in capture["landmarks"].items():
            main_landmark(scene, key, record, group(record["name"]))
        bpy.context.view_layer.update()
        overview = lighting(scene, group("镜头与光"))
        bpy.context.view_layer.update()
        mesh.save_project(scene, OUT / "city.blend")
        scene.render.filepath = str(OUT / "city.png")
        bpy.ops.render.render(write_still=True, scene=scene.name)
        scene.camera = overview
        scene.render.filepath = str(OUT / "city-wide.png")
        bpy.ops.render.render(write_still=True, scene=scene.name)
        print(f"Rendered city with {len(scene.objects)} objects and {sum(map(len, capture['lots'].values()))} buildings.")
    finally:
        window.scene = previous
        for obj in tuple(scene.objects):
            bpy.data.objects.remove(obj, do_unlink=True)
        bpy.data.scenes.remove(scene)
        for owned in set(bpy.data.collections) - previous_collections:
            bpy.data.collections.remove(owned)


if __name__ == '__main__':
    build()
