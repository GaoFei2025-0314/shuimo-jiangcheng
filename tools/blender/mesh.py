"""Small mesh primitives shared by the Wuhan architectural models (Blender Z-up)."""
import subprocess
import sys
import tempfile
from math import cos, floor, sin, tau
from pathlib import Path

import bpy
from mathutils import Vector


# Base colours for the editable Blender file. The web shader uses the same material IDs.
PALETTE = {
    "stone": "c2b6a0", "plaster": "edddbd", "enamelWhite": "f1e9da", "timber": "8a4c38", "roofGold": "b78846",
    "glaze": "57736c", "ink": "363c37", "bronze": "c19a56", "shadow": "4b4840",
    "vermilion": "a4513e", "steel": "526e6c", "deck": "88877e",
    "plaqueBlue": "193440", "plaqueGold": "e8c774", "suspensionOrange": "c86542",
    "cityWall": "c3b9a2", "cityRoof": "687168", "cityBrick": "8f8c80", "cityShade": "81847b",
}


def pigment_grain(mat, axis, amount):
    """Break up the base pigment in world space, preserving its original colour field."""
    tree = mat.node_tree
    color = tree.nodes.get("Principled BSDF").inputs["Base Color"]
    source = color.links[0].from_socket if color.is_linked else None
    geometry = tree.nodes.new("ShaderNodeNewGeometry")
    stretch = tree.nodes.new("ShaderNodeVectorMath")
    stretch.operation = 'MULTIPLY'
    stretch.inputs[1].default_value = axis
    tree.links.new(geometry.outputs["Position"], stretch.inputs[0])
    grain = tree.nodes.new("ShaderNodeTexNoise")
    grain.label = "纸纹与干笔"
    grain.inputs["Scale"].default_value = 1.2
    grain.inputs["Detail"].default_value = 3
    grain.inputs["Distortion"].default_value = .32
    tree.links.new(stretch.outputs[0], grain.inputs["Vector"])
    pigment = tree.nodes.new("ShaderNodeValToRGB")
    low, high = pigment.color_ramp.elements
    low.position, low.color = .23, (.70,.71,.68,1)
    high.position, high.color = .77, (1,1,1,1)
    tree.links.new(grain.outputs["Fac"], pigment.inputs[0])
    mix = tree.nodes.new("ShaderNodeMixRGB")
    mix.blend_type = 'MULTIPLY'
    mix.inputs[0].default_value = amount
    if source:
        tree.links.new(source, mix.inputs[1])
    else:
        mix.inputs[1].default_value = color.default_value[:]
    tree.links.new(pigment.outputs[0], mix.inputs[2])
    tree.links.new(mix.outputs[0], color)


def lane_image(tree, filename):
    path = Path(__file__).resolve().parents[2] / "assets" / filename
    image = bpy.data.images.load(str(path), check_existing=True)
    if filename == "lane-materials.webp":
        # The web shader reads this atlas as pigment density, without sRGB conversion.
        image.colorspace_settings.name = 'Non-Color'
    if not image.packed_file:
        image.pack()
    node = tree.nodes.new('ShaderNodeTexImage')
    node.image = image
    return node


def neighborhood_surface(mat, key):
    """Sample the same local material swatches and painted interiors as the web map."""
    tree = mat.node_tree
    base = tree.nodes.get("Principled BSDF").inputs["Base Color"]
    original = base.links[0].from_socket if base.is_linked else None
    uv = tree.nodes.new("ShaderNodeUVMap")
    uv.uv_map = "Street surface"
    sash = key == "cityShade"
    if sash:
        sample = lane_image(tree, "lane-windows.webp")
        panes = tree.nodes.new("ShaderNodeUVMap")
        panes.uv_map = "Painted pane"
        tree.links.new(panes.outputs[0], sample.inputs["Vector"])
        bars = tree.nodes.new("ShaderNodeTexBrick")
        bars.offset = 0
        bars.inputs["Scale"].default_value = 1
        bars.inputs["Brick Width"].default_value = .50
        bars.inputs["Row Height"].default_value = .66
        bars.inputs["Mortar Size"].default_value = .025
        bars.inputs["Mortar Smooth"].default_value = .65
        bars.inputs["Mortar"].default_value = (.24,.20,.15,1)
        tree.links.new(uv.outputs[0], bars.inputs["Vector"])
        shade = tree.nodes.new("ShaderNodeMixRGB")
        shade.blend_type = 'MULTIPLY'
        shade.inputs[0].default_value = 1
        shade.inputs[2].default_value = (.68,.72,.67,1)
        tree.links.new(sample.outputs["Color"], shade.inputs[1])
        # Keep most rooms in reflection; only occasional close panes reveal a curtain or an interior.
        interior = tree.nodes.new("ShaderNodeAttribute")
        interior.attribute_name = "Interior wash"
        glazing = tree.nodes.new("ShaderNodeMixRGB")
        glazing.inputs[1].default_value = (.115,.15,.135,1)
        tree.links.new(interior.outputs["Fac"], glazing.inputs[0])
        tree.links.new(shade.outputs[0], glazing.inputs[2])
        tree.links.new(glazing.outputs[0], bars.inputs["Color1"])
        tree.links.new(glazing.outputs[0], bars.inputs["Color2"])
        surface = bars.outputs["Color"]
    else:
        # Bottom-left UV origin: tiles and timber below, bricks and plaster above.
        scale, quadrant, low, high = {
            "cityRoof": ((.26,.32,1), (0,0), .60, 1.85),
            "cityBrick": ((.37,.39,1), (1,1), .87, 1.21),
            "cityWall": ((.20,.22,1), (1,1), .45, 1.27),
            "courtyardWood": ((.57,.52,1), (1,0), .63, 2.13),
        }[key]
        scaled = tree.nodes.new("ShaderNodeVectorMath")
        scaled.operation = 'MULTIPLY'
        scaled.inputs[1].default_value = scale
        tree.links.new(uv.outputs[0], scaled.inputs[0])
        parts = tree.nodes.new("ShaderNodeSeparateXYZ")
        tree.links.new(scaled.outputs[0], parts.inputs[0])
        tiled = tree.nodes.new("ShaderNodeCombineXYZ")
        for axis in (0,1):
            mirror = tree.nodes.new("ShaderNodeMath")
            mirror.operation = 'PINGPONG'
            mirror.inputs[1].default_value = 1
            tree.links.new(parts.outputs[axis], mirror.inputs[0])
            tree.links.new(mirror.outputs[0], tiled.inputs[axis])
        atlas_uv = tree.nodes.new("ShaderNodeVectorMath")
        atlas_uv.operation = 'MULTIPLY_ADD'
        atlas_uv.inputs[1].default_value = (.497,.497,1)
        atlas_uv.inputs[2].default_value = (quadrant[0]*.5+.0015, quadrant[1]*.5+.0015, 0)
        tree.links.new(tiled.outputs[0], atlas_uv.inputs[0])
        sample = lane_image(tree, "lane-materials.webp")
        tree.links.new(atlas_uv.outputs[0], sample.inputs["Vector"])
        pigment = tree.nodes.new("ShaderNodeMapRange")
        pigment.inputs["To Min"].default_value = low
        pigment.inputs["To Max"].default_value = high
        tree.links.new(sample.outputs["Color"], pigment.inputs[0])
        surface = pigment.outputs[0]
        if key == "cityBrick":
            joints = tree.nodes.new("ShaderNodeTexBrick")
            joints.inputs["Scale"].default_value = 1
            joints.inputs["Brick Width"].default_value = .41
            joints.inputs["Row Height"].default_value = .31
            joints.inputs["Mortar Size"].default_value = .012
            joints.inputs["Mortar Smooth"].default_value = .8
            joints.inputs["Color1"].default_value = (.94,.95,.93,1)
            joints.inputs["Color2"].default_value = (1,1,1,1)
            joints.inputs["Mortar"].default_value = (.88,.89,.86,1)
            tree.links.new(uv.outputs[0], joints.inputs["Vector"])
            detail = tree.nodes.new("ShaderNodeMixRGB")
            detail.blend_type = 'MULTIPLY'
            detail.inputs[0].default_value = 1
            tree.links.new(surface, detail.inputs[1])
            tree.links.new(joints.outputs["Color"], detail.inputs[2])
            surface = detail.outputs[0]
    fade = tree.nodes.new("ShaderNodeMapRange")
    fade.inputs["From Min"].default_value = 5 if sash else 12
    fade.inputs["From Max"].default_value = 34 if sash else 105
    fade.inputs["To Min"].default_value = .70 if sash else .86
    fade.inputs["To Max"].default_value = 0
    tree.links.new(tree.nodes.new("ShaderNodeCameraData").outputs["View Distance"], fade.inputs[0])
    ink = tree.nodes.new("ShaderNodeMixRGB")
    ink.blend_type = 'MIX' if sash else 'MULTIPLY'
    tree.links.new(fade.outputs[0], ink.inputs[0])
    if original:
        tree.links.new(original, ink.inputs[1])
    else:
        ink.inputs[1].default_value = base.default_value[:]
    tree.links.new(surface, ink.inputs[2])
    tree.links.new(ink.outputs[0], base)


def neighborhood_uv(mesh, key):
    layer = mesh.uv_layers.new(name="Street surface")
    pane = mesh.uv_layers.new(name="Painted pane") if key == "cityShade" else None
    interior = mesh.attributes.new("Interior wash", 'FLOAT', 'FACE') if pane is not None else None
    for face in mesh.polygons:
        points = [mesh.vertices[index].co for index in face.vertices]
        if key == "cityRoof" and abs(face.normal.z) > .15:
            coordinates = [(p.x,-p.y) for p in points]
        elif abs(face.normal.x) > abs(face.normal.y):
            coordinates = [(-p.y,p.z) for p in points]
        else:
            coordinates = [(p.x,p.z) for p in points]
        if pane is not None:
            lo, bottom = map(min, zip(*coordinates))
            hi, top = map(max, zip(*coordinates))
            width, height = max(hi-lo,.001), max(top-bottom,.001)
            coordinates = [((x-lo)/width, (y-bottom)/height) for x,y in coordinates]
            location = min(p.x for p in points) - max(p.y for p in points)
            variant = floor(location*7.14 + bottom*2.68 + .5)
            cell = variant % 4
            interior.data[face.index].value = (.58 if variant % 7 == 0 else .10) if height/width < 2.7 else 0
            if height/width > 2.7:
                cell %= 2
        for loop, (u,v) in zip(face.loop_indices, coordinates):
            layer.uv[loop].vector = (u,v)
            if pane is not None:
                pane.uv[loop].vector = ((cell%2)*.5+.005+.49*u, (cell//2)*.5+.005+.49*v)


def material(key):
    name = "Wuhan / " + key
    mat = bpy.data.materials.get(name)
    if mat is None:
        mat = bpy.data.materials.new(name)
        rgb = bytes.fromhex(PALETTE[key])
        def linear(channel):
            x = channel / 255
            return x / 12.92 if x <= .04045 else ((x + .055) / 1.055) ** 2.4
        mat.diffuse_color = tuple(map(linear, rgb)) + (1,)
        mat.use_nodes = True
        shader = mat.node_tree.nodes.get("Principled BSDF")
        shader.inputs["Base Color"].default_value = mat.diffuse_color
        shader.inputs["Roughness"].default_value = .78
        if key in ("cityWall", "cityRoof", "cityBrick", "cityShade"):
            pigment_grain(mat, (.75,1.25,3.5), .52)
            neighborhood_surface(mat, key)
    return mat


class Part:
    """Accumulate geometry for one named, independently editable architectural component."""

    def __init__(self, name, key):
        self.name = name
        self.key = key
        self.vertices = []
        self.faces = []

    def solid(self, vertices, faces):
        offset = len(self.vertices)
        self.vertices.extend(tuple(v) for v in vertices)
        self.faces.extend(tuple(offset + i for i in face) for face in faces)

    def prism(self, outline, z0, z1):
        xy = list(outline)
        area2 = sum(x * xy[(i + 1) % len(xy)][1] - y * xy[(i + 1) % len(xy)][0]
                    for i, (x, y) in enumerate(xy))
        if area2 < 0:
            xy.reverse()
        n = len(xy)
        faces = [tuple(reversed(range(n))), tuple(range(n, 2 * n))]
        faces.extend((i, (i + 1) % n, (i + 1) % n + n, i + n) for i in range(n))
        self.solid([(x, y, z) for z in (z0, z1) for x, y in xy], faces)

    def box(self, center, size, angle=0):
        x, y, z = center
        w, d, h = (dim / 2 for dim in size)
        c, s = cos(angle), sin(angle)
        self.prism([(x + u * c - v * s, y + u * s + v * c)
                    for u, v in ((-w, -d), (w, -d), (w, d), (-w, d))], z - h, z + h)

    def cylinder(self, x, y, z0, z1, radius, sides=12):
        self.prism([(x + radius * cos(i * tau / sides), y + radius * sin(i * tau / sides))
                    for i in range(sides)], z0, z1)

    def beam(self, start, end, width, depth=None):
        a, b = Vector(start), Vector(end)
        axis = (b - a).normalized()
        side = axis.cross(Vector((0, 0, 1)))
        if side.length_squared < 1e-8:
            side = Vector((1, 0, 0))
        side.normalize()
        up = axis.cross(side)
        side *= width / 2
        up *= (width if depth is None else depth) / 2
        points = [p + u * side + v * up for p in (a, b)
                  for u, v in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
        self.solid(points, [(3, 2, 1, 0), (4, 5, 6, 7),
                            (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)])

    def finish(self):
        if not self.faces:
            return None
        mesh = bpy.data.meshes.new(self.name)
        mesh.from_pydata(self.vertices, [], self.faces)
        mesh.materials.append(material(self.key))
        mesh.update()
        if self.key in ("cityRoof", "cityWall", "cityBrick", "cityShade"):
            neighborhood_uv(mesh, self.key)
        obj = bpy.data.objects.new(self.name, mesh)
        bpy.context.collection.objects.link(obj)
        obj["ink_material"] = self.key
        return obj


def save_project(scene, filepath):
    """Write a native project with its own workspace, isolated from the open MCP session."""
    with tempfile.TemporaryDirectory(prefix="wuhan-blend-") as tmp:
        source = Path(tmp) / "scene.blend"
        bpy.data.libraries.write(str(source), {scene})
        subprocess.run([bpy.app.binary_path, "--background", "--factory-startup", "--python-exit-code", "1",
                        "--python", __file__, "--", str(source), str(filepath)],
                       check=True, stdout=subprocess.DEVNULL)


def save_with_workspace(source, target):
    with bpy.data.libraries.load(source) as (available, loaded):
        loaded.scenes = [available.scenes[0]]
    scene = loaded.scenes[0]
    window = bpy.context.window
    startup = window.scene
    window.scene = scene
    bpy.data.scenes.remove(startup)
    bpy.data.orphans_purge(do_recursive=True)
    for area in window.screen.areas:
        if area.type == 'VIEW_3D':
            view = area.spaces.active
            view.region_3d.view_perspective = 'CAMERA'
            view.shading.color_type = 'MATERIAL'
            view.overlay.show_overlays = False
    scene.render.filepath = "//" + Path(target).stem + ".png"
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=target, compress=True)


if __name__ == "__main__":
    save_with_workspace(*sys.argv[sys.argv.index("--") + 1:])
