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
    if name in ("Water", "Land", "Hills", "BankGrass", "BankStone", "WetBank", "ShoreStone", "Path"):
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
        surface = ramp.outputs["Color"]
        if name == "Hills":
            # At grade, hills and the adjacent plain use the same palette and noise.
            lowland = nodes.new("ShaderNodeValToRGB")
            soil = [((v / 255 + .055) / 1.055) ** 2.4 for v in bytes.fromhex("e4dcc9")]
            for element, factor in zip(lowland.color_ramp.elements, (.78, 1.08)):
                element.color = (*[min(1, c * factor) for c in soil], 1)
            links.new(noise.outputs["Fac"], lowland.inputs["Fac"])
            axes = nodes.new("ShaderNodeSeparateXYZ")
            links.new(coords.outputs["Position"], axes.inputs["Vector"])
            blend = nodes.new("ShaderNodeMapRange")
            blend.interpolation_type = 'SMOOTHERSTEP'
            blend.inputs["From Min"].default_value = .70
            blend.inputs["From Max"].default_value = 8
            links.new(axes.outputs["Z"], blend.inputs["Value"])
            slopes = nodes.new("ShaderNodeMixRGB")
            links.new(blend.outputs["Result"], slopes.inputs[0])
            links.new(lowland.outputs["Color"], slopes.inputs[1])
            links.new(surface, slopes.inputs[2])
            surface = slopes.outputs["Color"]
        links.new(surface, shader.inputs["Base Color"])
    return mat


def geometry_arrays(item):
    points = np.frombuffer(base64.b64decode(item["positions"]), dtype="<f4").reshape(-1, 3)
    points = points[:, [0, 2, 1]].copy()
    points[:, 1] *= -1
    indices = (np.frombuffer(base64.b64decode(item["index"]), dtype="<u4") if item["index"]
               else np.arange(len(points))).reshape(-1, 3)
    return points, indices


def imported_mesh(item, mat, dest):
    points, indices = geometry_arrays(item)
    data = bpy.data.meshes.new(item["name"])
    data.from_pydata(points.tolist(), [], indices.tolist())
    data.materials.append(mat)
    if "deckPigment" in item:
        pigment = np.frombuffer(base64.b64decode(item["deckPigment"]), dtype="<f4")
        layer = data.attributes.new(name="Deck pigment", type='FLOAT', domain='POINT')
        layer.data.foreach_set("value", pigment)
    if item["material"] in ("Hills", "BankGrass", "WetBank", "DistantRidge"):
        data.polygons.foreach_set("use_smooth", np.ones(len(indices), dtype=bool))
    data.update()
    obj = bpy.data.objects.new(item["name"], data)
    dest.objects.link(obj)
    obj.matrix_world = placement(item["matrix"])
    if item["material"] in ("Streets", "ApproachPaving"):
        # Thin paving ribbons meet at intersections; their pigment casts no extra shadow.
        obj.visible_shadow = False
        obj.visible_diffuse = False
        obj.visible_glossy = False


def city_blocks(scene, captured, streets):
    labels = {"lane": "里分", "arcade": "沿江洋行", "wharf": "码头货仓",
              "apartment": "退台住宅", "highrise": "现代塔楼",
              "terrace_tower": "退台塔楼", "slab_tower": "板式高楼"}
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


def city_trees(captured, parent):
    """Link editable trees to one colored mesh per species, using the web placements."""
    names = {"pine": "松林", "broadleaf": "阔叶树", "willow": "岸柳", "cherry": "樱树"}
    for species, batch in captured.items():
        name = names[species]
        data = bpy.data.meshes.new(name + " · 共享树型")
        coords, tris, colors, slots = [], [], [], []
        for part in batch["parts"].values():
            points, indices = geometry_arrays(part)
            rgb = np.frombuffer(base64.b64decode(part["colors"]), dtype="<f4").reshape(-1, 3)
            # The material swatch is also visible in Blender's default solid viewport.
            base = np.rint(np.clip(rgb.mean(axis=0), 0, 1) * 255).astype("uint8").tobytes().hex()
            pigment = paint(part["material"], base)
            color = pigment.node_tree.nodes.new("ShaderNodeVertexColor")
            color.layer_name = "Plant pigment"
            shader = pigment.node_tree.nodes.get("Principled BSDF")
            pigment.node_tree.links.new(color.outputs["Color"], shader.inputs["Base Color"])
            slots.extend([len(data.materials)] * len(indices))
            data.materials.append(pigment)
            tris.extend((indices + len(coords)).tolist())
            coords.extend(points.tolist())
            colors.extend(rgb)
        data.from_pydata(coords, [], tris)
        data.polygons.foreach_set("material_index", np.asarray(slots, dtype="int32"))
        rgb = np.asarray(colors, dtype=np.float32)
        rgba = np.ones((len(rgb), 4), dtype=np.float32)
        rgba[:, :3] = np.where(rgb <= .04045, rgb / 12.92, ((rgb + .055) / 1.055) ** 2.4)
        data.color_attributes.new("Plant pigment", 'FLOAT_COLOR', 'POINT').data.foreach_set("color", rgba.ravel())
        data.update()
        dest = collection(parent, name)
        for i, matrix in enumerate(batch["matrices"], 1):
            obj = bpy.data.objects.new(f"{name} {i:04}", data)
            dest.objects.link(obj)
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


def lake_greenway(points, mat, dest):
    route = bpy.data.curves.new("东湖绿道", 'CURVE')
    route.dimensions = '3D'
    route.bevel_depth = .12
    route.bevel_resolution = 1
    branch = route.splines.new('POLY')
    branch.points.add(len(points) - 1)
    for knot, point in zip(branch.points, points):
        knot.co = (*point, 1)
    branch.use_cyclic_u = True
    route.materials.append(mat)
    dest.objects.link(bpy.data.objects.new(route.name, route))


def lake_strokes(outline, mat, dest):
    # The same concave shoreline used by the web water shader clips these quiet wavelets.
    edges = list(zip(outline, outline[1:] + outline[:1]))
    def inside(x, y):
        return sum((ay > y) != (by > y) and x < ax + (bx-ax)*(y-ay)/(by-ay)
                   for (ax, ay), (bx, by) in edges) % 2

    rng = random.Random(1948)
    xs, ys = zip(*outline)
    bounds = (min(xs), max(xs)), (min(ys), max(ys))
    verts, faces = [], []
    for _ in range(640):
        x, y = (rng.uniform(*limits) for limits in bounds)
        length, half = rng.uniform(1.4, 4.2), rng.uniform(.08, .20)
        curve = [(x-length, y), (x, y+half*1.5), (x+length, y+half*.8), (x, y-half)]
        if all(inside(px, py) for px, py in curve):
            offset = len(verts)
            verts.extend((px, py, .035) for px, py in curve)
            faces.append((offset+3, offset+2, offset+1, offset))
    data = bpy.data.meshes.new("东湖 · 风纹")
    data.from_pydata(verts, [], faces)
    data.materials.append(mat)
    dest.objects.link(bpy.data.objects.new(data.name, data))


def mist_layers(layers, dest):
    # Camera-only ink wash. UV falloff gives each bank of mist a soft edge.
    mat = bpy.data.materials.new("远岸 · 薄雾")
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    uv = nodes.new("ShaderNodeTexCoord").outputs["UV"]
    noise = nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 4.2
    links.new(uv, noise.inputs["Vector"])
    distance = nodes.new("ShaderNodeVectorMath")
    distance.operation = 'DISTANCE'
    distance.inputs[1].default_value = (.5, .5, 0)
    links.new(uv, distance.inputs[0])
    fade = nodes.new("ShaderNodeMapRange")
    fade.interpolation_type = 'SMOOTHERSTEP'
    fade.inputs["From Min"].default_value = .12
    fade.inputs["From Max"].default_value = .50
    fade.inputs["To Min"].default_value = 1
    fade.inputs["To Max"].default_value = 0
    links.new(distance.outputs["Value"], fade.inputs["Value"])
    opacity = nodes.new("ShaderNodeMath")
    opacity.operation = 'MULTIPLY'
    links.new(noise.outputs["Fac"], opacity.inputs[0])
    links.new(fade.outputs[0], opacity.inputs[1])
    strength = nodes.new("ShaderNodeMath")
    strength.operation = 'MULTIPLY'
    links.new(nodes.new("ShaderNodeObjectInfo").outputs["Alpha"], strength.inputs[0])
    links.new(opacity.outputs[0], strength.inputs[1])
    wash = nodes.new("ShaderNodeEmission")
    wash.inputs["Color"].default_value = (.82, .80, .73, 1)
    mix = nodes.new("ShaderNodeMixShader")
    links.new(strength.outputs[0], mix.inputs[0])
    links.new(nodes.new("ShaderNodeBsdfTransparent").outputs[0], mix.inputs[1])
    links.new(wash.outputs[0], mix.inputs[2])
    links.new(mix.outputs[0], nodes.get("Material Output").inputs["Surface"])
    for i, layer in enumerate(layers, 1):
        w, h = layer["width"] / 2, layer["depth"] / 2
        data = bpy.data.meshes.new(f"雾带 {i}")
        # The source plane's local Three XY axes become Blender XZ before placement.
        data.from_pydata([(-w, 0, -h), (w, 0, -h), (w, 0, h), (-w, 0, h)], [], [(0, 1, 2, 3)])
        uvs = data.uv_layers.new(name="雾边")
        uvs.data.foreach_set("uv", [0, 0, 1, 0, 1, 1, 0, 1])
        data.materials.append(mat)
        obj = bpy.data.objects.new(data.name, data)
        dest.objects.link(obj)
        obj.matrix_world = placement(layer["matrix"])
        obj.color = (1, 1, 1, layer["strength"])
        obj.visible_shadow = obj.visible_diffuse = obj.visible_glossy = False


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
    hillside = cam.copy()
    hillside.data = lens.copy()
    hillside.name = hillside.data.name = "蛇山与武昌街景"
    camera_group.objects.link(hillside)
    bank_view = Vector((-.90, -1.12, .75)).normalized()
    hillside.location = Vector((4, 4, 15)) + bank_view * 420
    hillside.rotation_euler = (-bank_view).to_track_quat('-Z', 'Y').to_euler()
    hillside.data.ortho_scale = 173
    return overview, hillside


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
            "Land":"e4dcc9", "Hills":"a4af91", "BankGrass":"9da887",
            "WetBank":"8c9c86", "ShoreStone":"979d8d", "Reeds":"687e65",
            "BankStone":"b4a88d", "Path":"d1c3a7", "Slate":"677872",
            "Masonry":"c4b9a2", "Ink":"4b5049", "Paper":"d4cfc2",
            "DistantRidge":"c5c6b5", "Greenway":"909c89", "Water":"9ab7b2", "Ripples":"c4d1c4", "Streets":"c6c1af", "ApproachPaving":"98998b", "Boat":"aa9980"}.items()}
        if any("deckPigment" in item for item in capture["meshes"]):
            # The apron begins in deck asphalt and ends in the receiving street's paving.
            tree = mats["ApproachPaving"].node_tree
            pigment = tree.nodes.new("ShaderNodeAttribute")
            pigment.attribute_name = "Deck pigment"
            mix = tree.nodes.new("ShaderNodeMixRGB")
            mix.inputs[1].default_value = mats["Path"].diffuse_color
            mix.inputs[2].default_value = mesh.material("deck").diffuse_color
            tree.links.new(pigment.outputs["Fac"], mix.inputs[0])
            tree.links.new(mix.outputs["Color"], tree.nodes.get("Principled BSDF").inputs["Base Color"])
        groups = {}
        def group(name):
            if name not in groups:
                groups[name] = collection(scene.collection, name)
            return groups[name]
        for item in capture["meshes"]:
            imported_mesh(item, mats[item["material"]], group(item["group"]))
        water(capture["rivers"], mats, group("两江水墨"))
        if capture.get("greenway"):
            lake_greenway(capture["greenway"], mats["Greenway"], group("东湖岸线"))
        if capture.get("eastLake"):
            lake_strokes(capture["eastLake"], mats["Ripples"], group("东湖岸线"))
        if capture.get("atmosphere"):
            mist_layers(capture["atmosphere"], group("远岸烟波"))
        city_blocks(scene, capture["lots"], group("武汉街坊"))
        city_trees(capture["vegetation"], group("武汉草木"))
        for key, record in capture["landmarks"].items():
            main_landmark(scene, key, record, group(record["name"]))
        bpy.context.view_layer.update()
        overview, hillside = lighting(scene, group("镜头与光"))
        bpy.context.view_layer.update()
        mesh.save_project(scene, OUT / "city.blend")
        scene.render.filepath = str(OUT / "city.png")
        bpy.ops.render.render(write_still=True, scene=scene.name)
        for camera, filename in ((overview, "city-wide.png"), (hillside, "city-hillside.png")):
            scene.camera = camera
            scene.render.filepath = str(OUT / filename)
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
