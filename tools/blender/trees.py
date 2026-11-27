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

def crown_form(species, trunk, limbs, crowns):
    # Keep the broad patches of ink that identify each species at a distance.
    return {"trunk": trunk, "limbs": limbs, "crowns": crowns, "distant": BASE_SHAPES[species]["distant"]}


VARIANTS = {
    "pine": (
        BASE_SHAPES["pine"],
        # Long low shelves below the crooked leader.
        crown_form("pine", ((0,-.43,0),(.16,1.35,.06),(.63,2.61,-.13),(.80,4.22,-.04)), (
            ((.16,1.35,.06),(-.84,2.24,.28),(-2.17,2.78,.14)),
            ((.63,2.61,-.13),(1.60,3.09,-.23),(2.02,3.34,-.26)),
            ((.73,3.41,-.09),(.31,3.80,.90)),
            ((.60,2.53,-.12),(-.09,3.14,-1.12)),
        ), (
            (-1.87,2.89,.20,1.57,.53,1.00,"#62785f",.14),
            (-.87,3.15,-.79,1.24,.57,.97,"#516a57",-.29),
            (1.62,3.45,-.31,1.34,.62,1.04,"#708565",.21),
            (.38,3.79,.94,1.45,.61,1.16,"#526f5f",-.27),
            (.79,4.36,-.09,1.24,.64,1.04,"#607c68",.38),
            (-.24,3.53,.14,.94,.43,.88,"#788970",.61),
        )),
        # A bowed trunk leads to a higher, more compact stack of pads.
        crown_form("pine", ((0,-.43,0),(-.26,1.68,-.04),(-.67,3.32,.22),(-1.09,4.75,.17)), (
            ((-.26,1.68,-.04),(.54,2.76,.17),(1.79,3.58,.25)),
            ((-.59,3.00,.18),(-1.52,3.74,-.37),(-1.97,3.92,-.59)),
            ((-.82,3.82,.22),(-.36,4.20,.92)),
        ), (
            (1.51,3.61,.11,1.43,.59,1.20,"#62785f",.22),
            (-1.87,3.97,-.56,1.22,.54,.91,"#516a57",.34),
            (-.48,4.20,.77,1.36,.60,1.05,"#526f5f",-.24),
            (-1.04,4.72,-.26,1.21,.65,1.05,"#607c68",.47),
            (-.81,4.94,.24,.87,.58,.84,"#788970",-.23),
        )),
    ),
    "broadleaf": (
        BASE_SHAPES["broadleaf"],
        # A squat crown spreading from a low fork and four outward boughs.
        crown_form("broadleaf", ((0,-.40,0),(-.17,1.61,.03),(-.64,3.09,-.14),(-.94,4.38,-.18)), (
            ((-.17,1.61,.03),(.92,2.79,.24),(1.89,3.52,.19)),
            ((-.57,2.88,-.10),(-1.66,3.75,-.52),(-2.05,3.98,-.58)),
            ((-.59,3.05,-.11),(-.99,3.88,1.38)),
            ((-.64,3.21,-.17),(.15,4.16,-1.40)),
        ), (
            (-1.82,4.01,-.62,1.33,1.06,1.24,"#627653",.44),
            (1.50,3.75,.29,1.50,1.14,1.21,"#718761",-.39),
            (-.85,3.88,1.11,1.30,1.05,1.18,"#718060",.68),
            (.24,4.25,-1.14,1.36,1.15,1.15,"#718961",.12),
            (-.75,4.92,.03,1.54,1.02,1.35,"#82916d",.24),
            (.75,4.37,.20,1.15,.96,1.11,"#8b9a75",-.56),
        )),
        # Two high forks with a clear gap below the crown.
        crown_form("broadleaf", ((0,-.40,0),(.19,1.99,-.08),(.44,3.92,-.11),(.67,5.16,.02)), (
            ((.22,2.16,-.08),(-.82,3.75,-.21),(-1.18,5.08,-.26)),
            ((.44,3.92,-.11),(1.40,4.39,-.51),(1.51,5.05,-.53)),
            ((.43,3.61,-.09),(.10,4.79,1.14)),
        ), (
            (-1.26,4.93,-.52,1.13,1.30,1.23,"#627653",.37),
            (1.34,4.89,-.47,1.17,1.13,1.09,"#718761",-.23),
            (.03,4.80,1.13,1.22,1.00,1.02,"#718060",.74),
            (-.47,5.72,-.29,1.00,1.23,1.15,"#718961",-.42),
            (.72,5.73,.13,1.12,1.30,1.18,"#82916d",.31),
            (.19,6.21,.05,.79,.84,.82,"#8b9a75",.52),
        )),
    ),
    "willow": (
        BASE_SHAPES["willow"],
        # Bowed towards one bank, with long hanging sprays off the bend.
        crown_form("willow", ((0,-.40,0),(.29,1.32,-.09),(.79,2.69,-.30),(1.15,3.73,-.15)), (
            ((.29,1.32,-.09),(-.70,2.48,.14),(-1.37,3.13,.24)),
            ((.79,2.69,-.30),(1.69,3.18,-.58),(2.07,3.37,-.82)),
            ((.87,2.93,-.26),(.93,3.56,1.18)),
        ), (
            (-1.28,2.67,.32,1.16,1.42,1.01,"#7c946a",.31),
            (1.70,2.71,-.67,1.18,1.73,.92,"#869966",.33),
            (.31,2.58,-1.01,.89,1.51,.87,"#6e8862",-.70),
            (1.07,2.74,1.16,.98,1.55,1.02,"#82996e",.62),
            (.82,3.65,-.04,1.39,1.03,1.29,"#92a377",.52),
            (-.69,2.22,.93,.66,1.24,.75,"#79936b",-.42),
            (1.79,2.14,.19,.53,1.34,.63,"#8aa073",.18),
        )),
        # Split low like a narrow U, with a separate curtain at each shoulder.
        crown_form("willow", ((0,-.40,0),(-.14,1.22,.03),(-.80,2.54,-.08),(-1.46,3.63,.17)), (
            ((-.14,1.22,.03),(.84,2.42,.18),(1.62,3.62,-.03)),
            ((-.73,2.43,-.07),(-1.41,3.27,-.90)),
            ((.68,2.21,.14),(1.22,3.31,1.02)),
            ((-.86,2.62,-.04),(-.49,3.20,1.12)),
        ), (
            (-1.63,2.88,.32,1.13,1.58,1.04,"#7c946a",-.19),
            (1.62,2.95,-.42,1.06,1.52,.87,"#869966",.33),
            (-1.12,2.62,-.93,.90,1.54,1.04,"#6e8862",-.60),
            (1.18,2.60,1.11,1.06,1.52,1.07,"#82996e",.75),
            (-.68,3.57,.40,1.10,1.11,1.08,"#92a377",.51),
            (.94,3.58,-.22,.99,1.11,1.04,"#8aa073",-.33),
        )),
    ),
    "cherry": (
        BASE_SHAPES["cherry"],
        # Wide shallow umbrella with a fork just above the ground.
        crown_form("cherry", ((0,-.43,0),(.10,1.25,.05),(-.25,2.24,-.21),(-.94,3.19,-.25)), (
            ((.10,1.25,.05),(1.18,2.53,.32),(2.12,3.16,.35)),
            ((-.01,1.62,-.03),(-1.41,2.68,-.30),(-2.05,3.05,-.40)),
            ((-.24,2.23,-.20),(-.01,3.02,1.23)),
            ((.61,1.89,.17),(.27,3.08,-1.24)),
        ), (
            (-1.87,3.10,-.49,1.25,.81,1.05,"#c89491",.52),
            (1.78,3.29,.16,1.25,.95,1.08,"#d7a29c",-.48),
            (.09,3.15,1.15,1.45,.91,1.16,"#d3aaa1",.24),
            (-.95,3.52,.11,1.31,.90,1.11,"#d7a7a3",-.42),
            (.43,3.33,-1.16,1.43,.93,1.09,"#d8aaa8",.20),
            (.82,3.76,.23,1.23,.91,1.11,"#e0bbb4",.49),
        )),
        # Risen on one side with staggered flower masses above it.
        crown_form("cherry", ((0,-.43,0),(-.18,1.50,.16),(-.54,2.88,.29),(-.73,3.93,.06)), (
            ((-.18,1.50,.16),(.95,2.56,-.37),(1.66,3.41,-.50)),
            ((-.49,2.68,.27),(-1.50,3.31,-.34),(-1.71,3.91,-.54)),
            ((-.54,2.88,.29),(.48,3.24,1.11)),
        ), (
            (-1.56,3.74,-.48,1.19,.88,1.04,"#c89491",.59),
            (1.47,3.47,-.59,1.18,1.02,1.08,"#d7a29c",-.48),
            (.47,3.37,1.04,1.31,.90,1.15,"#d3aaa1",.22),
            (-.69,3.85,.72,1.20,1.00,1.11,"#d7a7a3",-.43),
            (-.54,4.29,-.38,1.25,1.03,1.08,"#e0bbb4",.51),
            (.31,4.25,.21,.88,.83,.88,"#ead0c2",.40),
        )),
    ),
}


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
