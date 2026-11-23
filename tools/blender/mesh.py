"""Small mesh primitives shared by the Wuhan architectural models (Blender Z-up)."""
import subprocess
import sys
import tempfile
from math import cos, sin, tau
from pathlib import Path

import bpy
from mathutils import Vector


# Base colours for the editable Blender file. The web shader uses the same material IDs.
PALETTE = {
    "stone": "c2b6a0", "plaster": "edddbd", "timber": "8a4c38", "roofGold": "b78846",
    "glaze": "57736c", "ink": "363c37", "bronze": "c19a56", "shadow": "4b4840",
    "vermilion": "a4513e", "steel": "526e6c", "deck": "88877e",
    "cityWall": "c3b9a2", "cityRoof": "85918a", "cityBrick": "aa9381", "cityShade": "81847b",
}


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
