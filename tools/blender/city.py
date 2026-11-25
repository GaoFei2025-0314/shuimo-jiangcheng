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
import bmesh
import numpy as np
from mathutils import Matrix, Vector

HERE = Path(__file__).resolve().parent
OUT = HERE.parents[1] / "output" / "architecture"
sys.dont_write_bytecode = True
sys.path.insert(0, str(HERE))
import landmarks
import mesh
import neighborhood
import tower_park

for module in (mesh, landmarks, neighborhood, tower_park):
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


def worn_walk(material):
    """Tint the existing stone wash by the interpolated distance from the walk centre."""
    worn = material.copy()
    worn.name = material.name + " · 滨水步道磨痕"
    tree = worn.node_tree
    color = tree.nodes.get("Principled BSDF").inputs["Base Color"]
    stone = color.links[0].from_socket
    edge = tree.nodes.new("ShaderNodeAttribute")
    edge.attribute_name = "Walk edge"
    distance = tree.nodes.new("ShaderNodeMath")
    distance.operation = 'ABSOLUTE'
    tree.links.new(edge.outputs["Fac"], distance.inputs[0])
    tones = tree.nodes.new("ShaderNodeMixRGB")
    tones.inputs[1].default_value = (1.02, 1.015, 1.01, 1)
    tones.inputs[2].default_value = (.97, .97, .97, 1)
    tree.links.new(distance.outputs[0], tones.inputs[0])
    multiply = tree.nodes.new("ShaderNodeMixRGB")
    multiply.blend_type = 'MULTIPLY'
    multiply.inputs[0].default_value = 1
    tree.links.new(stone, multiply.inputs[1])
    tree.links.new(tones.outputs[0], multiply.inputs[2])
    tree.links.new(multiply.outputs[0], color)
    return worn


def geometry_arrays(item):
    points = np.frombuffer(base64.b64decode(item["positions"]), dtype="<f4").reshape(-1, 3)
    points = points[:, [0, 2, 1]].copy()
    points[:, 1] *= -1
    indices = (np.frombuffer(base64.b64decode(item["index"]), dtype="<u4") if item["index"]
               else np.arange(len(points))).reshape(-1, 3)
    return points, indices


def imported_mesh(item, mat, dest, parent=None):
    points, indices = geometry_arrays(item)
    data = bpy.data.meshes.new(item["name"])
    data.from_pydata(points.tolist(), [], indices.tolist())
    for material in mat if isinstance(mat, tuple) else (mat,):
        data.materials.append(material)
    if "faceGroups" in item:
        slots = np.zeros(len(indices), dtype=np.int32)
        for start, count, slot in item["faceGroups"]:
            slots[start:start + count] = slot
        data.polygons.foreach_set("material_index", slots)
    for key, name in (("deckPigment", "Deck pigment"), ("vergeCover", "Verge cover"), ("walkEdge", "Walk edge")):
        if key in item:
            field = data.attributes.new(name=name, type='FLOAT', domain='POINT')
            field.data.foreach_set("value", np.frombuffer(base64.b64decode(item[key]), dtype="<f4"))
    if item["material"] in ("Hills", "BankGrass", "WetBank", "DistantRidge"):
        data.polygons.foreach_set("use_smooth", np.ones(len(indices), dtype=bool))
    data.update()
    obj = bpy.data.objects.new(item["name"], data)
    dest.objects.link(obj)
    if parent is None:
        obj.matrix_world = placement(item["matrix"])
    else:
        obj.parent = parent
        obj.matrix_basis = placement(item["matrix"])
    waterfront_paving = item["name"].endswith(("两桥滨水步道", "桥头接岸步道", "滨水通街支巷"))
    courtyard_paving = (item["group"] in ("汉阳滨水街巷生活", "汉阳茶棚后街坊", "武昌滨水街巷生活")
                       and item["material"] in ("Path", "BankStone"))
    if courtyard_paving or waterfront_paving or item["material"] in ("Streets", "ApproachPaving", "RoadPaint") or item["group"] in (
            "汉阳桥头街坊", "武昌桥头街坊", "汉阳两桥街道", "武昌两桥街道"):
        # Thin paving ribbons meet at intersections; their pigment casts no extra shadow.
        obj.visible_shadow = False
        obj.visible_diffuse = False
        obj.visible_glossy = False


def place_vessel(record, materials, dest):
    root = bpy.data.objects.new(f'{record["name"]} · {record["id"]}', None)
    root.empty_display_type = 'ARROWS'
    root.empty_display_size = .65
    dest.objects.link(root)
    midpoint = AXES @ Vector(record["waterlineMidpoint"])
    root.matrix_world = placement(record["matrix"]) @ Matrix.Translation(midpoint)
    root["vessel_id"] = record["id"]
    root["vessel_type"] = record["type"]
    root["design_draft"] = record["draft"]
    for item in record["parts"]:
        slots = tuple(materials[key] for key in item.get("materialSlots", (item["material"],)))
        imported_mesh(item, slots, dest, parent=root)
    return root


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


def place_building(scene, builder, data, dest):
    before = set(scene.objects)
    builder()
    parts = set(scene.objects) - before
    root = bpy.data.objects.new(data["name"], None)
    dest.objects.link(root)
    root.matrix_world = placement(data["matrix"])
    for obj in parts:
        relocate(obj, dest)
        obj.parent = root
    return root


def water(rivers, materials, dest, lakes=()):
    def surface(name, vertices, faces, material, field=None):
        data = bpy.data.meshes.new(name)
        data.from_pydata(vertices, [], faces)
        data.materials.append(material)
        obj = bpy.data.objects.new(name, data)
        dest.objects.link(obj)
        if field is not None:
            data.attributes.new("pigment", 'FLOAT', 'POINT').data.foreach_set("value", field)
        return obj

    def shade_attribute(material):
        nodes = material.node_tree.nodes
        attribute = nodes.new("ShaderNodeAttribute")
        attribute.attribute_name = "pigment"
        return nodes, material.node_tree.links, attribute.outputs["Fac"]

    def soften(material):
        nodes, links, amount = shade_attribute(material)
        mix = nodes.new("ShaderNodeMixShader")
        links.new(amount, mix.inputs[0])
        links.new(nodes.new("ShaderNodeBsdfTransparent").outputs[0], mix.inputs[1])
        links.new(nodes.get("Principled BSDF").outputs[0], mix.inputs[2])
        links.new(mix.outputs[0], nodes.get("Material Output").inputs["Surface"])

    def smooth(t, lo, hi):
        u = min(1., max(0., (t - lo) / (hi - lo)))
        return u*u*(3 - 2*u)

    surface("纸地", [(-3000,-3000,-.15), (3000,-3000,-.15), (3000,3000,-.15), (-3000,3000,-.15)],
            [(0, 1, 2, 3)], materials["Land"])

    yangtze, han = rivers
    mouth_x, mouth_y = han[-1][:2]
    junction = min(range(len(yangtze)), key=lambda i: math.dist(yangtze[i][:2], (mouth_x, mouth_y)))
    cx, cy, nx, ny, _ = yangtze[junction]
    bank = (mouth_x-cx)*nx + (mouth_y-cy)*ny
    station = [0.]
    for first, second in zip(yangtze, yangtze[1:]):
        station.append(station[-1] + math.dist(first[:2], second[:2]))

    main_mat = paint("Water", "bab8a5")
    han_mat = paint("Water", "9fbcb0")
    nodes, links, tint = shade_attribute(main_mat)
    paint_mix = nodes.new("ShaderNodeMixRGB")
    paint_mix.inputs[2].default_value = han_mat.diffuse_color
    base_color = nodes.get("Principled BSDF").inputs["Base Color"]
    links.new(base_color.links[0].from_socket, paint_mix.inputs[1])
    links.new(tint, paint_mix.inputs[0])
    links.new(paint_mix.outputs[0], base_color)
    soften(han_mat)

    # Cross-stream subdivisions soften the Han pigment into the Yangtze downstream.
    width = 15
    for number, (river, name, material) in enumerate(zip(rivers, ("长江", "汉水"), (main_mat, han_mat))):
        vertices, faces, pigment = [], [], []
        for i, (x, y, nx, ny, half) in enumerate(river):
            for j in range(width):
                offset = (2*j/(width-1)-1)*half*1.06
                px, py = x+offset*nx, y+offset*ny
                vertices.append((px, py, .012*number))
                if number == 0:
                    delta = station[i]-station[junction]
                    turn = smooth(delta,-20,42)
                    extent = 22-8*turn
                    reach = smooth(delta,-22,13)*(1-smooth(delta,38,156))
                    axis = bank*(1-.26*turn)+1.8*math.sin(delta*.055)
                    shade = .84*reach*(1-smooth(abs(offset-axis),extent*.12,extent))
                else:
                    fade = smooth(i,len(han)-9,len(han)-1)
                    if fade:
                        overlap = max(1-math.hypot(px-sx,py-sy)/wh for sx,sy,_,_,wh in
                                      yangtze[max(0,junction-7):junction+8])
                        shade = 1-fade*smooth(overlap,-.03,.20)
                    else:
                        shade = 1.
                pigment.append(shade)
                if i and j:
                    k = i*width+j
                    faces.append((k-width-1,k-1,k,k-width))
        wash = surface(name + " · 顺岸水洗", vertices, faces, material, pigment)
        wash.visible_shadow = False
    lake_mat = paint("Water", "aebfb4")
    for index, outline in enumerate(lakes):
        ring = list(outline)
        if len(ring) >= 3 and math.dist(ring[0], ring[-1]) < 1e-6:
            ring.pop()
        if len(ring) >= 3:
            area = sum(x * ny - y * nx for (x, y), (nx, ny) in zip(ring, ring[1:] + ring[:1]))
            if area < 0:
                ring.reverse()
            surface("东湖 · 水洗" if index == 0 else f"湖面 · {index + 1}",
                    [(x, y, .009) for x, y in ring], [tuple(range(len(ring)))], lake_mat)

    # Flat, translucent marks need no light-blocking surface or hard paper edge.
    stroke = paint("江水 · 淡墨", "8c9a90")
    soften(stroke)
    rng = random.Random(1957)
    for i_river, (river, name) in enumerate(zip(rivers, ("长江", "汉水"))):
        verts, faces, pigment = [], [], []
        for i in range(1, len(river)-5):
            for _ in range(3 if i_river == 0 else 2):
                lateral = rng.uniform(-.78, .78)
                length = rng.uniform(.21, .70)
                width = rng.uniform(.065, .18)
                density = rng.uniform(.12, .31)
                start = len(verts)
                offset_along = rng.random()
                for j in range(7):
                    t = i + offset_along + length*j/6
                    k, f = int(t), t % 1
                    x, y, nx, ny, half = (a + (b-a)*f for a,b in zip(river[k], river[k+1]))
                    taper = math.sin(math.pi*j/6)
                    for u in (-1, 0, 1):
                        offset = half*lateral + width*(.05+.95*taper)*u
                        verts.append((x+offset*nx, y+offset*ny, .039))
                        pigment.append(density*taper if u == 0 else 0.)
                    if j:
                        for col in (0, 1):
                            a = start+(j-1)*3+col
                            faces.extend(((a,a+3,a+1),(a+1,a+3,a+4)))
        ripples = surface(name + " · 笔触", verts, faces, stroke, pigment)
        ripples.visible_shadow = False


def vessel_wakes(wakes, lakes, dest):
    mat = paint("尾流 · 水沫", "f4efdd")
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    strength = nodes.new("ShaderNodeAttribute")
    strength.attribute_name = "wake_strength"
    mix = nodes.new("ShaderNodeMixShader")
    links.new(strength.outputs["Fac"], mix.inputs[0])
    links.new(nodes.new("ShaderNodeBsdfTransparent").outputs[0], mix.inputs[1])
    links.new(nodes.get("Principled BSDF").outputs[0], mix.inputs[2])
    links.new(mix.outputs[0], nodes.get("Material Output").inputs["Surface"])

    lake_edges = [list(zip(ring, ring[1:] + ring[:1])) for ring in lakes]

    def ease(t):
        t = min(1, max(0, t))
        return t * t * (3 - 2 * t)

    for index, record in enumerate(wakes, 1):
        x, y = record["center"]
        forward_x, forward_y = record["forward"]
        magnitude = math.hypot(forward_x, forward_y)
        length, stern = record["length"], max(0, record["stern"])
        if magnitude < 1e-6 or length <= 0:
            continue
        forward_x, forward_y = forward_x / magnitude, forward_y / magnitude
        side_x, side_y = -forward_y, forward_x
        in_lake = any(sum((ay > y) != (by > y) and x < ax + (bx-ax)*(y-ay)/(by-ay)
                          for (ax, ay), (bx, by) in edges) % 2 for edges in lake_edges)
        opacity = .40 if in_lake else .77
        vertices, faces, amounts = [], [], []
        # Two divergent outer lines and two shorter echoes share the actual stern.
        for opening, extent, weight in ((.27, 1., 1.), (.42, .67, .55)):
            for side in (-1, 1):
                start = len(vertices)
                for row in range(21):
                    t = row / 20 * extent
                    aft = length * t
                    width = (.12 + .30*t) * (.75 if in_lake else 1.)
                    center = side * (opening*aft + .066*math.sin(aft*1.7))
                    fade = ease(t/.12) * (1 - ease((t-.29)/(extent-.29)))
                    for u in (-1, 0, 1):
                        offset = center + u * width
                        vertices.append((x-(stern+aft)*forward_x+offset*side_x,
                                         y-(stern+aft)*forward_y+offset*side_y, .083))
                        amounts.append(opacity * weight * fade if u == 0 else 0.)
                    if row:
                        for col in (0, 1):
                            a = start + (row-1)*3 + col
                            faces.extend(((a, a+1, a+3), (a+1, a+4, a+3)))
        name = f"{'湖上' if in_lake else '江上'}舟船 · 艉迹 {index}"
        data = bpy.data.meshes.new(name)
        data.from_pydata(vertices, [], faces)
        data.materials.append(mat)
        strength_field = data.attributes.new("wake_strength", 'FLOAT', 'POINT')
        strength_field.data.foreach_set("value", amounts)
        obj = bpy.data.objects.new(name, data)
        dest.objects.link(obj)
        obj.visible_shadow = False


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


def freight_view(scene, wake, camera_group):
    along = Vector((*wake["forward"], 0)).normalized()
    side = Vector((-along.y, along.x, 0))
    target = Vector((*wake["center"], .4)) - along * (wake["stern"] + wake["length"] * .24)
    back = (-along * .48 + side + Vector((0, 0, .78))).normalized()
    camera = scene.camera.copy()
    camera.data = camera.data.copy()
    camera.name = camera.data.name = "长江货船 · 船艉与舱盖"
    camera_group.objects.link(camera)
    camera.location = target + back * 24
    camera.rotation_euler = (-back).to_track_quat('-Z', 'Y').to_euler()
    camera.data.ortho_scale = wake["length"] + wake["stern"] * 3.4
    return camera


def bridgehead_views(scene, camera_group, landmark_roots):
    """Follow the river, then frame each bridge structure and its actual street junction."""
    def make_view(name, target, back, width):
        back.normalize()
        camera = scene.camera.copy()
        camera.data = camera.data.copy()
        camera.name = camera.data.name = name
        camera_group.objects.link(camera)
        camera.location = target + back * 650
        camera.rotation_euler = (-back).to_track_quat('-Z', 'Y').to_euler()
        camera.data.ortho_scale = width
        return camera

    river = make_view("长江双桥 · 沿江鸟瞰", Vector((-121,-20,4)), Vector((-.45,-1,.93)), 335)
    views = [(river, "bridge-river.png")]
    for key, prefix, suffix, file_prefix in (("bridge", "", "接地铺装", "wuhan"),
                                             ("yingwuzhou", "鹦鹉洲", "车行面", "yingwuzhou")):
        centre = landmark_roots[key].matrix_world.translation
        for bank, file_bank in (("武昌", "wuchang"), ("汉阳", "hanyang")):
            road = scene.objects[f"{prefix}{bank}引道 · {suffix}"]
            vertices = road.data.vertices
            start, end = [road.matrix_world @ ((vertices[i].co + vertices[i+1].co) / 2)
                          for i in (0, len(vertices)-2)]
            along = end - centre
            along.z = 0
            along.normalize()
            side = Vector((-along.y, along.x, 0))
            if side.y > 0:
                side.negate()
            back = -.16 * along + .93 * side + Vector((0,0,.8))
            near = start.lerp(centre, .51 if prefix else .72)
            far = end + along * 9
            name = (prefix or "武汉长江大桥") + " · " + bank + "桥头"
            camera = make_view(name, (near+far)/2, back, (far-near).length * 1.26)
            views.append((camera, f"bridge-{file_prefix}-{file_bank}.png"))
    return views


def waterfront_views(scene, camera_group):
    """Follow both banks to the bridges and look inland from the central landings."""
    views = []
    for name, filename, eye, target, lens in (
            ("汉阳江岸 · 望武汉长江大桥", "hanyang-wuhan", (-184,-23,6.1), (-137,59,1.5), 26),
            ("汉阳江岸 · 望鹦鹉洲长江大桥", "hanyang-yingwuzhou", (-183,-32,5.6), (-191,-109,3), 23),
            ("武昌江岸 · 望武汉长江大桥", "wuchang-wuhan", (-85,-45,5.9), (-81,23,2), 25),
            ("武昌江岸 · 望鹦鹉洲长江大桥", "wuchang-yingwuzhou", (-88,-65,6.4), (-120,-139,4), 24),
            ("汉阳水阶 · 系船石与街巷", "hanyang-mooring", (-187.8,-47.8,2.7), (-197.8,-39.5,1.2), 27),
            ("武昌江岸 · 石凳与街巷", "wuchang-bench", (-96,-97.8,3), (-80,-89.5,1.3), 29),
            ("汉阳通街支巷 · 入巷望茶棚", "hanyang-tea-lane", (-206,-35,2.8), (-230,-34,2), 25),
            ("武昌通街支巷 · 入巷望里分", "wuchang-courtyard-lane", (-72,-86,3.35), (-43,-72,2.1), 31),
            ("汉阳通街支巷 · 回望武汉长江大桥", "hanyang-lane-to-bridge", (-205,-35,2.9), (-143,37,4), 25),
            ("武昌通街支巷 · 回望鹦鹉洲长江大桥", "wuchang-lane-to-bridge", (-74,-84,3.3), (-126,-134,7), 26)):
        data = bpy.data.cameras.new(name)
        data.lens = lens
        data.clip_end = scene.camera.data.clip_end
        camera = bpy.data.objects.new(name, data)
        camera_group.objects.link(camera)
        camera.location = eye
        camera.rotation_euler = (Vector(target) - camera.location).to_track_quat('-Z', 'Y').to_euler()
        views.append((camera, f"waterfront-{filename}.png"))
    return views


def park_view(scene, park_roots, tower_root, camera_group):
    parts = [part for root in [tower_root, *park_roots] for part in root.children if part.type == 'MESH']
    corners = [part.matrix_world @ Vector(point) for part in parts for point in part.bound_box]
    direction = Vector((-.81, -.64, .66)).normalized()
    rotation = (-direction).to_track_quat('-Z', 'Y')
    axes = [rotation @ Vector(v) for v in ((1,0,0), (0,1,0), (0,0,1))]
    spans = [(min(p.dot(axis) for p in corners), max(p.dot(axis) for p in corners)) for axis in axes]
    centre = sum((axis * ((lo+hi)/2) for axis, (lo,hi) in zip(axes, spans)), Vector())
    camera = scene.camera.copy()
    camera.data = camera.data.copy()
    camera.name = camera.data.name = "蛇山西区 · 从胜像塔到黄鹤楼"
    camera_group.objects.link(camera)
    camera.location = centre + direction * 360
    camera.rotation_euler = rotation.to_euler()
    camera.data.ortho_scale = max(spans[0][1]-spans[0][0], (spans[1][1]-spans[1][0])*5/3) * 1.2
    return camera, corners


def export_park(scene, camera, corners):
    """A local editable working set with the actual city relief, street edges and planting."""
    region = bpy.data.scenes.new("黄鹤楼公园 · 蛇山西区")
    region.world = scene.world
    region.render.engine = 'CYCLES'
    region.cycles.samples = scene.cycles.samples
    region.cycles.use_denoising = True
    region.render.resolution_x, region.render.resolution_y = scene.render.resolution_x, scene.render.resolution_y
    region.render.resolution_percentage = 100
    region.render.filepath = "//tower-park.png"
    region.collection.objects.link(camera)
    region.camera = camera
    for light in (obj for obj in scene.objects if obj.type == 'LIGHT'):
        region.collection.objects.link(light)
    # Include enough surrounding street for the perspective from the west gate and for orbiting.
    bpy.context.view_layer.update()
    direction = camera.matrix_world.to_quaternion() @ Vector((0,0,-1))
    frame = [camera.matrix_world @ p for p in camera.data.view_frame(scene=region)]
    ground_frame = [p - direction*(p.z/direction.z) for p in frame]
    limits = [(min(min(p[i] for p in corners)-50, min(p[i] for p in ground_frame)-9),
               max(max(p[i] for p in corners)+50, max(p[i] for p in ground_frame)+9)) for i in (0,1)]
    context = collection(region.collection, "蛇山西段 · 周边实景")
    copies = []
    try:
        for group in scene.collection.children:
            if group.name in ("黄鹤楼", "黄鹤楼公园西区", "蛇山"):
                region.collection.children.link(group)
                continue
            for original in group.all_objects:
                if original.type != 'MESH' or group.name in ("远山", "远岸烟波"):
                    continue
                matrix = original.matrix_world.copy()
                box = [matrix @ Vector(p) for p in original.bound_box]
                ranges = [(min(p[i] for p in box), max(p[i] for p in box)) for i in (0,1)]
                if any(b < left or a > right for (a,b),(left,right) in zip(ranges,limits)):
                    continue
                obj = original.copy()
                obj.parent = None
                obj.matrix_world = matrix
                if any(a < left or b > right for (a,b),(left,right) in zip(ranges,limits)):
                    bm = bmesh.new()
                    bm.from_mesh(original.data)
                    bm.transform(matrix)
                    for axis,(left,right) in enumerate(limits):
                        for edge,sign in ((left,1),(right,-1)):
                            point,normal = Vector(), Vector()
                            point[axis],normal[axis] = edge,sign
                            bmesh.ops.bisect_plane(bm, geom=[*bm.verts,*bm.edges,*bm.faces], dist=.0001,
                                                   plane_co=point, plane_no=normal, clear_inner=True)
                    if not bm.faces:
                        bm.free()
                        bpy.data.objects.remove(obj)
                        continue
                    bm.transform(matrix.inverted_safe())
                    obj.data = original.data.copy()
                    bm.to_mesh(obj.data)
                    bm.free()
                context.objects.link(obj)
                copies.append(obj)
        bpy.context.window.scene = region
        bpy.context.view_layer.update()
        mesh.save_project(region, OUT / "tower-park.blend")
        region.render.filepath = str(OUT / "tower-park.png")
        bpy.ops.render.render(write_still=True, scene=region.name)
    finally:
        bpy.context.window.scene = scene
        bpy.context.view_layer.update()
        for obj in copies:
            bpy.data.objects.remove(obj, do_unlink=True)
        bpy.data.scenes.remove(region)


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
            "DistantRidge":"c5c6b5", "Greenway":"909c89", "Water":"9ab7b2", "Ripples":"c4d1c4", "Streets":"c6c1af", "ApproachPaving":"98998b", "RoadPaint":"e6dabc",
            "Boat":"aa9980", "BoatHull":"536e63", "BoatBottom":"995d48", "BoatDeck":"ab9b82", "BoatCabin":"ddd3b7",
            "BoatGlass":"486767", "BoatRail":"7b8271", "BoatAccent":"ae6550", "BoatCargo":"788969",
            "BoatLoad":"776956", "BoatCanopy":"a9ad83"}.items()}
        mats["SuspensionOrange"] = mesh.material("suspensionOrange")
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
        verge_materials = {}
        walk_materials = {}
        for item in capture["meshes"]:
            material = mats[item["material"]]
            if "vergeCover" in item:
                if material not in verge_materials:
                    wash = material.copy()
                    wash.name = material.name + " · 路肩淡边"
                    nodes = wash.node_tree.nodes
                    cover = nodes.new("ShaderNodeAttribute")
                    cover.attribute_name = "Verge cover"
                    wash.node_tree.links.new(cover.outputs["Fac"], nodes.get("Principled BSDF").inputs["Alpha"])
                    verge_materials[material] = wash
                material = verge_materials[material]
            if "walkEdge" in item:
                if material not in walk_materials:
                    walk_materials[material] = worn_walk(material)
                material = walk_materials[material]
            imported_mesh(item, material, group(item["group"]))
        for vessel in capture.get("vessels", ()):
            place_vessel(vessel, mats, group(vessel["group"]))
        lakes = capture.get("lakes") or ([capture["eastLake"]] if capture.get("eastLake") else ())
        water(capture["rivers"], mats, group("两江水墨"), lakes)
        if capture.get("wakes"):
            vessel_wakes(capture["wakes"], lakes, group("舟船尾迹"))
        if capture.get("greenway"):
            lake_greenway(capture["greenway"], mats["Greenway"], group("东湖岸线"))
        if capture.get("eastLake"):
            lake_strokes(capture["eastLake"], mats["Ripples"], group("东湖岸线"))
        if capture.get("atmosphere"):
            mist_layers(capture["atmosphere"], group("远岸烟波"))
        city_blocks(scene, capture["lots"], group("武汉街坊"))
        city_trees(capture["vegetation"], group("武汉草木"))
        landmark_roots = {}
        for key, record in capture["landmarks"].items():
            landmark_roots[key] = place_building(scene, landmarks.BUILDERS[key], record, group(record["name"]))
        park_roots = []
        for record in capture.get("parkAssets", []):
            park_roots.append(place_building(scene, tower_park.BUILDERS[record["key"]], record, group("黄鹤楼公园西区")))
        bpy.context.view_layer.update()
        overview, hillside = lighting(scene, group("镜头与光"))
        bpy.context.view_layer.update()
        if park_roots:
            camera, corners = park_view(scene, park_roots, landmark_roots["tower"], group("镜头与光"))
            export_park(scene, camera, corners)
        detail_views = bridgehead_views(scene, group("镜头与光"), landmark_roots)
        detail_views.extend(waterfront_views(scene, group("镜头与光")))
        if capture.get("wakes"):
            camera = freight_view(scene, capture["wakes"][0], group("镜头与光"))
            detail_views.append((camera, "river-freighter.png"))
        mesh.save_project(scene, OUT / "city.blend")
        scene.render.filepath = str(OUT / "city.png")
        bpy.ops.render.render(write_still=True, scene=scene.name)
        for camera, filename in ((overview, "city-wide.png"), (hillside, "city-hillside.png")):
            scene.camera = camera
            scene.render.filepath = str(OUT / filename)
            bpy.ops.render.render(write_still=True, scene=scene.name)
        scene.render.resolution_percentage = 64
        for camera, filename in detail_views:
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
