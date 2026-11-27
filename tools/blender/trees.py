"""Editable ink-tree meshes with matching near, mid and distant parts.

Shape coordinates are X across, Y up, Z along the ground. Conversion to Blender
axes happens when the mesh and its point attributes are created.
"""
from array import array
from math import cos, floor, pi, sin, sqrt

import bpy


SPRAY_RINGS = ((-.52, .40), (-.19, .68), (.17, .76), (.51, .53))
DISTANT_RINGS = ((-.39, .81), (.28, .95))
ZERO = (0, 0, 0)
UP = (0, 1, 0)


BASE_SHAPES = {
    "pine": {
        "trunk": ((0, -0.43, 0), (0.12, 1.64, -0.09), (-0.26, 3.14, 0.12), (-0.42, 4.48, 0.21)),
        "limbs": (
            ((0.12, 1.64, -0.09), (-1.03, 2.64, -0.21), (-2.03, 3.11, -0.32)),
            ((-0.06, 2.44, 0.03), (1.21, 2.99, -0.14), (1.81, 3.41, -0.15)),
            ((-0.13, 2.58, 0.05), (0.07, 3.14, 1.24)),
        ),
        "crowns": (
            (-1.76, 3.24, -0.36, 1.53, 0.62, 1.02, '#62785f', 0.26),
            (-0.83, 3.54, -0.82, 1.41, 0.62, 0.98, '#516a57', 0.32),
            (1.41, 3.58, -0.42, 1.64, 0.63, 1.08, '#708565', 0.18),
            (0.46, 3.71, 1.01, 1.49, 0.69, 1.06, '#526f5f', -0.24),
            (-0.36, 4.42, 0.18, 1.53, 0.81, 1.19, '#607c68', 0.38),
            (-0.75, 4.77, 0.14, 0.89, 0.6, 0.76, '#788970', 0.61),
        ),
        "distant": (
            (-1.51, 3.34, -0.48, 1.75, 0.75, 1.22, '#62785f', 0.26),
            (1.23, 3.66, 0.38, 1.9, 0.72, 1.53, '#5e785f', -0.14),
            (-0.45, 4.54, 0.16, 1.64, 0.94, 1.28, '#6a826b', 0.38),
        ),
    },
    "broadleaf": {
        "trunk": ((0, -0.4, 0), (-0.08, 1.93, 0.03), (0.21, 3.67, -0.07), (0.01, 4.64, 0.13)),
        "limbs": (
            ((-0.08, 1.93, 0.03), (1.15, 3.39, 0.47), (1.68, 4.11, 0.29)),
            ((0.1, 2.8, 0), (-1.01, 3.98, -0.62), (-1.57, 4.3, -0.66)),
            ((0.12, 3.2, 0), (-0.39, 4.04, 1.47)),
        ),
        "crowns": (
            (-1.27, 4.25, -0.54, 1.47, 1.16, 1.23, '#627653', 0.31),
            (1.13, 4.31, 0.28, 1.5, 1.25, 1.23, '#718761', -0.23),
            (0.01, 4.25, 1.13, 1.34, 1.06, 1.06, '#718060', 0.74),
            (0.17, 4.77, -0.99, 1.42, 1.16, 1.28, '#718961', 0.12),
            (-0.23, 5.34, 0.03, 1.59, 1.31, 1.45, '#82916d', 0.31),
            (0.42, 6, -0.12, 0.91, 0.93, 0.96, '#8b9a75', -0.51),
        ),
        "distant": (
            (-1.09, 4.31, -0.42, 1.71, 1.36, 1.51, '#687d58', 0.31),
            (1.04, 4.62, 0.42, 1.62, 1.46, 1.48, '#748866', -0.23),
            (-0.02, 5.51, -0.32, 1.73, 1.54, 1.64, '#82936d', 0.31),
        ),
    },
    "willow": {
        "trunk": ((0, -0.4, 0), (0.28, 1.36, -0.04), (0.23, 2.81, -0.17), (-0.27, 3.81, -0.06)),
        "limbs": (
            ((0.28, 1.36, -0.04), (-0.51, 2.55, 0.64), (-1.59, 3.69, 0.65)),
            ((0.23, 2.81, -0.17), (1.23, 3.45, -0.45), (1.67, 3.44, -0.86)),
            ((0.23, 2.81, -0.17), (0.18, 3.72, 1.01)),
        ),
        "crowns": (
            (-1.56, 3.05, 0.61, 1.04, 1.28, 0.97, '#7c946a', 0.24),
            (1.56, 2.89, -0.38, 1.17, 1.52, 0.87, '#869966', 0.1),
            (-0.67, 2.77, -0.96, 0.96, 1.46, 1.06, '#6e8862', -0.6),
            (0.19, 2.85, 1.31, 0.95, 1.58, 1.03, '#82996e', 0.75),
            (-0.01, 3.81, -0.08, 1.75, 1.09, 1.29, '#92a377', 0.61),
            (-1.71, 2.22, -0.05, 0.51, 1.14, 0.69, '#79936b', -0.38),
            (1.04, 2.24, 1.12, 0.51, 1.28, 0.62, '#8aa073', 0.16),
        ),
        "distant": (
            (-1.42, 2.88, 0.51, 1.29, 2.03, 1.25, '#789164', 0.24),
            (1.27, 2.66, 0.21, 1.46, 1.91, 1.31, '#849c70', 0.1),
            (-0.01, 3.68, -0.34, 1.78, 1.37, 1.53, '#92a377', 0.61),
        ),
    },
    "cherry": {
        "trunk": ((0, -0.43, 0), (-0.06, 1.46, 0.01), (0.28, 2.69, 0.28), (0.4, 3.33, 0.38)),
        "limbs": (
            ((-0.06, 1.46, 0.01), (-1.06, 2.53, -0.61), (-1.8, 3.03, -0.71)),
            ((0.06, 1.94, 0.07), (1.24, 2.73, -0.49), (2.03, 3.28, -0.61)),
            ((0.29, 2.74, 0.29), (-0.49, 3.52, 0.97)),
        ),
        "crowns": (
            (-1.63, 3.31, -0.63, 1.25, 0.87, 1.03, '#c89491', 0.52),
            (1.67, 3.36, -0.64, 1.31, 0.92, 1.08, '#d7a29c', -0.48),
            (0.57, 3.42, 1.01, 1.35, 0.86, 1.18, '#d3aaa1', 0.24),
            (-0.78, 3.52, 0.73, 1.26, 1, 1.09, '#d7a7a3', -0.37),
            (-0.28, 3.64, -0.91, 1.24, 0.89, 1.09, '#d8aaa8', 0.2),
            (0.13, 4.1, 0.16, 1.42, 1.01, 1.11, '#e0bbb4', 0.49),
            (1.05, 3.92, 0.19, 0.85, 0.77, 0.89, '#ead0c2', 0.4),
        ),
        "distant": (
            (-1.34, 3.36, -0.05, 1.56, 1.01, 1.35, '#cf9e9d', 0.52),
            (1.35, 3.42, -0.26, 1.6, 1.03, 1.35, '#d9aaa3', -0.48),
            (0.04, 3.91, 0.43, 1.59, 1.16, 1.57, '#e0b9b2', 0.49),
        ),
    },
}

VARIANTS = {species: (shape,) for species, shape in BASE_SHAPES.items()}


def seeded(seed):
    def draw():
        nonlocal seed
        seed = (seed * 1664525 + 1013904223) & 0xffffffff
        return seed / 4294967296
    return draw


def pigment(hex_color):
    return tuple(channel / 255 for channel in bytes.fromhex(hex_color[1:]))


def to_blender(point):
    x, y, z = point
    return x, -z, y


def plus_scaled(a, b, scale):
    return tuple(x + y * scale for x, y in zip(a, b))


def difference(a, b):
    return tuple(x - y for x, y in zip(a, b))


def lerp(a, b, amount):
    return plus_scaled(a, difference(b, a), amount)


def squared_length(v):
    x, y, z = v
    return x * x + y * y + z * z


def unit(v):
    factor = 1 / (sqrt(squared_length(v)) or 1)
    return tuple(x * factor for x in v)


def cross(a, b):
    x, y, z = a
    u, v, w = b
    return y * w - z * v, z * u - x * w, x * v - y * u


def tree_material():
    name = "Wuhan / Tree pigment"
    material = bpy.data.materials.get(name)
    if material is None:
        material = bpy.data.materials.new(name)
        material.use_nodes = True
        tree = material.node_tree
        color = tree.nodes.new("ShaderNodeVertexColor")
        color.layer_name = "pigment"
        shader = next(node for node in tree.nodes if node.type == "BSDF_PRINCIPLED")
        shader.inputs["Roughness"].default_value = .92
        tree.links.new(color.outputs["Color"], shader.inputs["Base Color"])
    return material


class InkTreeMesh:
    def __init__(self, sides=5, rings=DISTANT_RINGS, spray=False):
        self.sides = sides
        self.rings = rings
        self.spray = spray
        self.points = []
        self.faces = []
        self.colors = []
        self.crown_centers = []
        self.leaf_centers = []

    def vertex(self, point, tint, shade, crown=ZERO, leaf=ZERO):
        self.points.append(point)
        self.colors.extend([*(channel * shade for channel in tint), 1])
        if self.spray:
            self.crown_centers.extend(to_blender(crown))
            self.leaf_centers.extend(to_blender(leaf))

    def branch(self, start, end, radius_start, radius_end, sides=5):
        axis = unit(difference(end, start))
        lateral = unit(cross((1, 0, 0) if abs(axis[1]) > .92 else UP, axis))
        flank = cross(axis, lateral)
        offset = len(self.points)
        tint = pigment("#544b3b")
        for tip, (point, radius) in enumerate(((start, radius_start), (end, radius_end))):
            for i in range(sides):
                angle = i * 2 * pi / sides
                p = plus_scaled(point, lateral, cos(angle) * radius)
                p = plus_scaled(p, flank, sin(angle) * radius)
                self.vertex(p, tint, .85 + .15 * (i % 3) / 2 + (.06 if tip else 0))
        for i in range(sides):
            v, following = offset + i, offset + (i + 1) % sides
            self.faces.extend(((v, following, following + sides), (v, following + sides, v + sides)))
        for i in range(1, sides - 1):
            self.faces.extend(((offset, offset + i + 1, offset + i),
                               (offset + sides, offset + sides + i, offset + sides + i + 1)))

    def crown(self, lobe):
        x, y, z, width, height, depth, tint, yaw = lobe
        center = (x, y, z)
        offset, n = len(self.points), self.sides
        c, s = cos(yaw), sin(yaw)
        phase = x * 2.7 + z * 3.1 + yaw
        for j, (py, radius) in enumerate(self.rings):
            for i in range(n):
                a = i * pi * 2 / n + (j % 2) * .27
                bud = (sin(a * 3 + phase) * (.085 if self.spray else .14)
                       + cos(a * 2 - phase + j) * (.055 if self.spray else .09))
                px = cos(a) * (radius + bud) + py * .12
                pz = -sin(a) * (radius + bud)
                lift = py + .13 * cos(a * 2 + phase - j * .5)
                point = (x + px * width * c + pz * depth * s, y + lift * height,
                         z - px * width * s + pz * depth * c)
                self.vertex(point, tint, .86 + (lift + 1) * .07 + .034 * sin(a + phase), crown=center)
                if j < len(self.rings) - 1:
                    v, following = offset + j * n + i, offset + j * n + (i + 1) % n
                    self.faces.extend(((v, following, following + n), (v, following + n, v + n)))
        bottom = len(self.points)
        top, last_ring = bottom + 1, bottom - n
        self.vertex((x - .12 * width, y - .83 * height, z + .16 * depth), tint, .81, crown=center)
        self.vertex((x + .19 * width, y + .89 * height, z - .15 * depth), tint, 1.03, crown=center)
        for i in range(n):
            following = (i + 1) % n
            self.faces.extend(((bottom, offset + following, offset + i), (top, last_ring + i, last_ring + following)))

    def leaf(self, point, length, width, yaw, dip, tint, shade):
        along = unit((cos(yaw), dip, sin(yaw)))
        across = unit((-sin(yaw), .32 * cos(yaw * 1.7), cos(yaw)))
        offset = len(self.points)
        for u, v, lift in ((-.58, 0, 0), (-.05, .47, .01), (.60, 0, .09), (-.10, -.40, 0), (.06, 0, .22)):
            x, y, z = plus_scaled(plus_scaled(point, along, length * u), across, width * v)
            self.vertex((x, y + width * lift, z), tint, shade * (1.035 if v > .05 else .97), leaf=point)
        for i in range(4):
            self.faces.append((offset + 4, offset + (i + 1) % 4, offset + i))

    def finish(self, name):
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata([to_blender(point) for point in self.points], [], self.faces)
        mesh.update()
        color = mesh.color_attributes.new("pigment", "FLOAT_COLOR", "POINT")
        color.data.foreach_set("color", array("f", self.colors))
        if self.spray:
            for key, values in (("crownCenter", self.crown_centers), ("leafCenter", self.leaf_centers)):
                attr = mesh.attributes.new(key, "FLOAT_VECTOR", "POINT")
                attr.data.foreach_set("vector", array("f", values))
        mesh.materials.append(tree_material())
        for face in mesh.polygons:
            face.use_smooth = True
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.collection.objects.link(obj)
        return obj


def build_tree(species, model, species_index):
    wood, leaves = InkTreeMesh(), InkTreeMesh(7, SPRAY_RINGS, spray=True)
    mid_leaves = InkTreeMesh(spray=True)
    rng = seeded(0xa10b39 + species_index * 9137)
    weeping = species == "willow"
    trunk, limbs = model["trunk"], model["limbs"]
    radii = (.34, .21, .135, .054)
    for j, point in enumerate(trunk[1:]):
        wood.branch(trunk[j], point, radii[j], radii[j + 1], 6)
    for limb in limbs:
        for j, point in enumerate(limb[1:]):
            wood.branch(limb[j], point, .135 if j == 0 else .085, .093 if j == 0 else .03)
        x, y, z = limb[-1]
        ax, ay, az = limb[-2]
        sign_x, sign_z = (x > 0) - (x < 0), (z > 0) - (z < 0)
        wood.branch(((x + ax) / 2, (y + ay) / 2, (z + az) / 2),
                    (x - .32 * sign_z, y + .48, z + .36 * sign_x), .052, .023, 4)
    for k in range(3):
        angle = species_index * 1.7 + k * 2.3
        wood.branch((0, .13, 0), (.63 * cos(angle), -.23, .63 * sin(angle)), .16, .077, 4)
    mid_wood = wood.finish(species + " / mid / wood")

    axes = [p for path in limbs for p in path] + [trunk[-1]]
    paper_sprigs = []
    for cx, cy, cz, width, height, depth, hex_color, yaw in model["crowns"]:
        origin, tint = (cx, cy, cz), pigment(hex_color)
        branch = min(reversed(axes), key=lambda p: squared_length(difference(p, origin)))
        fork = lerp(branch, origin, .68)
        wood.branch(branch, fork, .052, .025, 4)
        c, s = cos(yaw), sin(yaw)

        def local(x, y, z):
            return (cx + c * x * width + s * z * depth, cy + y * height,
                    cz - s * x * width + c * z * depth)

        for j in range(8):
            a, radius = j * 2.399 + yaw, .23 + .40 * rng()
            px, pz, py = cos(a) * radius, sin(a) * radius, (rng() - .43) * .74
            mid = local(px, py, pz)
            fat = .126 + .076 * rng()
            lift = .24 + .13 * rng() if weeping else .16 + .11 * rng()
            brush_load = .83 + .24 * rng()
            # The original ink clumps used whole RGB channels. Individual leaf strokes retain float pigment.
            color = tuple(int(channel * brush_load * 255) / 255 for channel in tint)
            notch = j + floor(7 * yaw + .5)
            if notch < 0 or notch % 3 != 1:
                cluster = (*mid, width * fat, height * lift, depth * fat, color, yaw + a * .25)
                leaves.crown(cluster)
                mid_leaves.crown(cluster)
            tip = lerp(mid, origin, .12)
            node = lerp(branch, fork, .65 + (j % 4) * .11)
            wood.branch(node, tip, .022, .009, 3)
            trace = tip
            leaf_count = 12
            for k in range(leaf_count):
                theta, r = a + k * 2.399, .075 + .28 * rng()
                drop = -.49 * k / (leaf_count - 1) if weeping else (rng() - .35) * .42
                point = local(px + sin(theta) * r, py + drop, pz + cos(theta) * r)
                mark = (.083 + .124 * rng()) * (width + depth) * .5
                nib = mark * (.21 + .11 * rng() if weeping else .39 + .28 * rng())
                dip, shade = (-.95 if weeping else -.40) + .75 * rng(), .70 + .38 * rng()
                leaves.leaf(point, mark, nib, theta, dip, tint, shade)
                if k % 4 == j % 4:
                    mid_leaves.leaf(point, mark, nib, theta, dip, tint, shade)
                if k % (3 if weeping else 4) == 0:
                    end = lerp(point, mid, .15)
                    wood.branch(trace if weeping else tip, end, .011, .004, 3)
                    if species == "broadleaf" and k == 0 and j in (1, 5):
                        paper_sprigs.append((end, difference(end, fork), hex_color))
                    trace = end

    far_wood, far_leaves = InkTreeMesh(), InkTreeMesh()
    far_wood.branch(trunk[0], trunk[1], radii[0], radii[1], 4)
    far_wood.branch(trunk[1], trunk[3], radii[1], radii[3], 4)
    for x, y, z, width, height, depth, hex_color, yaw in model["distant"]:
        far_leaves.crown((x, y, z, width, height, depth, pigment(hex_color), yaw))

    lods = {
        "assets": {"wood": wood.finish(species + " / near / wood"),
                   "foliage": leaves.finish(species + " / near / foliage")},
        "midAssets": {"wood": mid_wood, "foliage": mid_leaves.finish(species + " / mid / foliage")},
        "farAssets": {"wood": far_wood.finish(species + " / far / wood"),
                      "foliage": far_leaves.finish(species + " / far / foliage")},
    }
    return lods, paper_sprigs
