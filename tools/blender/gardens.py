"""Named, editable meshes for Wuhan's historic gardens and temple sites.

The local entrance axis faces -Y, corresponding to +Z in the web scene.
Building dimensions follow the existing map scale. Ornament is simplified from
photographs, and the secondary buildings are brought closer to their landmarks.
"""
from math import ceil, cos, hypot, pi, sin

from mesh import Part


class Assembly:
    def __init__(self, name):
        self.name = name
        self.parts = {}

    def part(self, name, key):
        if (name, key) not in self.parts:
            self.parts[name, key] = Part(f"{self.name} / {name}", key)
        return self.parts[name, key]

    def finish(self):
        return [obj for part in self.parts.values() if (obj := part.finish()) is not None]


def slab(part, x, y, w, d, bottom, top):
    part.box((x, y, (top + bottom) / 2), (w, d, top - bottom))


def flight(part, x, y, w, run, bottom, top, count):
    """From the lower end at y to the landing at y + run."""
    tread = run / count
    for index in range(count):
        height = (top - bottom) * (index + 1) / count
        slab(part, x, y + (index + .5) * tread, w, tread, bottom, bottom + height)


def rails(part, path, height=.92, pitch=1.45, width=.16, levels=(.29, .83)):
    for index, (start, end) in enumerate(zip(path, path[1:])):
        x, y, z = start
        dx, dy, dz = (b - a for a, b in zip(start, end))
        divisions = ceil(hypot(dx, dy) / pitch)
        for i in range(divisions + (index == len(path) - 2 and path[0] != path[-1])):
            t = i / divisions
            part.box((x + dx * t, y + dy * t, z + dz * t + height / 2),
                     (width, width, height))
        for level in levels:
            part.beam((x, y, z + level * height),
                      (x + dx, y + dy, z + dz + level * height), width * .66)


def balcony(part, x, y, w, d, z, **options):
    a, b = w / 2, d / 2
    rails(part, [(x - a, y - b, z), (x + a, y - b, z), (x + a, y + b, z),
                 (x - a, y + b, z), (x - a, y - b, z)], **options)


def loft(part, rings, cap=True):
    """Join evenly sampled counter-clockwise horizontal profiles."""
    size = len(rings[0])
    faces = [(k * size + i, k * size + (i + 1) % size,
              (k + 1) * size + (i + 1) % size, (k + 1) * size + i)
             for k in range(len(rings) - 1) for i in range(size)]
    if cap:
        faces.extend((tuple(reversed(range(size))),
                      tuple(range((len(rings) - 1) * size, len(rings) * size))))
    part.solid([point for ring in rings for point in ring], faces)


def circular(part, x, y, profile, sides=8, angle=0, sy=1):
    loft(part, [[(x + r * cos(angle + 2 * pi * i / sides),
                  y + r * sy * sin(angle + 2 * pi * i / sides), z)
                 for i in range(sides)] for r, z in profile])


def roof(site, label, x, y, w, d, eave, rise, key, *, ridge=.44, inner=None, kick=.52):
    """Swept tiles with upturned corners, a long ridge or a pyramidal finial."""
    corners = [(-w / 2, -d / 2), (w / 2, -d / 2), (w / 2, d / 2), (-w / 2, d / 2)]
    iw, depth = inner if inner else (max(.16, w * ridge), .14)
    crown = [(-iw / 2, -depth / 2), (iw / 2, -depth / 2),
             (iw / 2, depth / 2), (-iw / 2, depth / 2)]
    profile = ((0, 0, 1), (.32, .12, .27), (.67, .47, .04), (1, 1, 0))
    sample = (0, .2, .5, .8)
    def section(edge, t):
        j = (edge + 1) % 4
        ox, oy = (a + (b - a) * t for a, b in zip(corners[edge], corners[j]))
        ix, iy = (a + (b - a) * t for a, b in zip(crown[edge], crown[j]))
        turn = abs(2 * t - 1) ** 5 * kick
        return [(x + ox + k * (ix - ox), y + oy + k * (iy - oy),
                 eave + rise * h + turn * q) for k, h, q in profile]

    rings = list(zip(*(section(edge, t) for edge in range(4) for t in sample)))
    tile = site.part(label + " · tiles", key)
    trim = site.part(label + " · drip edge", "ink")
    seam = site.part(label + " · ridge and hips", key)
    band = tuple((a, b, c - .17) for a, b, c in rings[0])
    loft(trim, [band, rings[0]], cap=False)
    loft(tile, rings, cap=False)
    # The flat lower ring is inset, leaving the underside swept up at each corner.
    underside = tuple((x + (a - x) * .88, y + (b - y) * .88, eave - .25)
                      for a, b, _ in rings[0])
    loft(tile, [underside, band], cap=False)
    tile.solid(underside, [tuple(reversed(range(len(underside))))])

    for edge in range(4):
        hips = [(px, py, pz + .1) for px, py, pz in section(edge, 0)]
        towards_left = section((edge - 1) % 4, .987)
        towards_right = section(edge, .013)
        loft(seam, list(zip(towards_left, hips, towards_right)), cap=False)
        # Low-relief tile courses read at the desktop drawing scale.
        tx, ty = (b - a for a, b in zip(corners[edge], corners[(edge + 1) % 4]))
        length = hypot(tx, ty)
        for offset in ((.23, .5, .77) if inner is None and w >= 8 else ()):
            row = section(edge, offset)
            lower = [(a, b, c + .025) for a, b, c in row]
            upper = [(a + tx * .046 / length, b + ty * .046 / length, c + .085)
                     for a, b, c in row]
            tile.solid(lower + upper, [(i, i + len(row), i + 1 + len(row), i + 1)
                                       for i in range(len(row) - 1)])
    if inner is None:
        h = eave + rise
        if ridge:
            seam.beam((x - iw / 2 - .13, y, h + .11), (x + iw / 2 + .13, y, h + .11), .24)
            for s in (-1, 1):
                seam.beam((x + s * (iw / 2 - .25), y, h + .09),
                          (x + s * (iw / 2 + .4), y, h + .37), .15)
        else:
            circular(seam, x, y, [(.32, h), (.26, h + .14), (.31, h + .28),
                                  (.13, h + .47), (.04, h + .63)])
    return eave + rise


def plaque(site, label, x, y, z, width, height):
    site.part(label + " · plaque", "bronze").box((x, y, z), (width + .15, .13, height + .15))
    site.part(label + " · plaque field", "ink").box((x, y - .077, z), (width, .04, height))


def timber_frame(site, label, x, y, w, d, z, h, bays, *, wall="plaster", style="timber"):
    feet = site.part(label + " · column shoes", "stone")
    columns = site.part(label + " · posts and doors", style)
    braces = site.part(label + " · bracket sets", "glaze")
    core = site.part(label + " · wall", wall)
    glazing = site.part(label + " · recessed lattice bays", "shadow")
    a, b = w / 2, d / 2
    dx = w / bays
    for q in (-1, 1):
        for i in range(bays + 1):
            px = x - a + i * dx
            py = y + q * b
            feet.box((px, py, z + .085), (.34, .34, .17))
            columns.cylinder(px, py, z + .15, z + h, .145, 6)
            braces.box((px, py, z + h - .3), (.63, .48, .26))
        columns.box((x, y + q * b, z + h - .17), (w + .35, .19, .30))
        columns.cylinder(x + q * a, y, z, z + h, .137, 6)
        columns.box((x + q * a, y, z + h - .17), (.19, d, .30))
    if wall is None:
        return

    slab(core, x, y, w - .66, d - .86, z, z + h - .32)
    for q in (-1, 1):
        facade = y + q * (b - .402)
        for i in range(bays):
            px = x - a + (i + .5) * dx
            base = z + (.15 if i == bays // 2 else .66)
            height = z + h - .66 - base
            glazing.box((px, facade, base + height / 2), (dx * .71, .11, height))
            for bar in ((-.21, .21) if q < 0 else (0,)):
                columns.box((px + dx * bar, facade + q * .073, base + height / 2),
                            (.064, .081, height))
            if q < 0:
                columns.box((px, facade + q * .076, base + height * .56), (dx * .71, .081, .073))
    for q in (-1, 1):
        side = x + q * (a - .303)
        for span in (-.21, .21):
            glazing.box((side, y + d * span, z + h * .57), (.11, d * .25, h * .46))


def hall(site, label, x, y, w, d, z, h, bays, key="ink", *, wall="plaster",
         kick=.57, rise=2.15, ridge=.48, style="timber"):
    timber_frame(site, label, x, y, w, d, z, h, bays, wall=wall, style=style)
    return roof(site, label + " roof", x, y, w + 2.45, d + 2.18, z + h - .12,
                rise, key, ridge=ridge, kick=kick)


def elevation_prism(part, shape, y0, y1):
    """Extrude an X/Z elevation across a depth along Y."""
    n = len(shape)
    part.solid([(x, y, z) for y in (y0, y1) for x, z in shape],
               [tuple(range(n)), tuple(reversed(range(n, 2 * n))),
                *((i, i + n, (i + 1) % n + n, (i + 1) % n) for i in range(n))])


def arcade_body(part, x, w, y0, y1, base, spring, opening, top):
    """Filled masonry around a true semicircular passage."""
    radius = opening / 2
    slab(part, x - (w + opening) / 4, (y0 + y1) / 2, (w - opening) / 2, y1 - y0, base, spring)
    slab(part, x + (w + opening) / 4, (y0 + y1) / 2, (w - opening) / 2, y1 - y0, base, spring)
    curve = [(x + radius * cos(k * pi / 12), spring + radius * sin(k * pi / 12))
             for k in range(13)]
    shape = [(x + w / 2, spring), (x + w / 2, top), (x - w / 2, top), (x - w / 2, spring)]
    elevation_prism(part, shape + list(reversed(curve)), y0, y1)


def voussoirs(part, x, y, z, radius, depth=.16, width=.24):
    for i in range(12):
        start, end = (i + .035) * pi / 12, (i + .965) * pi / 12
        corners = [(x + r * cos(a), z + r * sin(a))
                   for r, a in ((radius, end), (radius, start),
                                (radius + width, start), (radius + width, end))]
        elevation_prism(part, corners, y - depth, y)


def qc():
    """Qingchuan Pavilion and the Tiemen Pass gatehouse."""
    site = Assembly("晴川阁 · 铁门关")
    base = site.part("禹功矶石台 · retaining courses", "stone")
    slab(base, 0, .35, 28, 17.2, -5.4, .45)
    slab(base, 0, .35, 28.4, 17.6, .45, .76)
    slab(base, 0, .25, 23.4, 13.4, .76, 1.75)
    slab(base, 0, .25, 23.72, 13.72, 1.75, 2.02)
    flight(site.part("晴川阁 · entry steps", "stone"), 0, -10.35, 6, 3.76, .06, 2.02, 8)
    floor = site.part("晴川阁 · observation deck", "timber")
    slab(floor, 0, 0, 15.1, 9.15, 6.57, 6.9)
    timber_frame(site, "晴川阁 lower bays", 0, 0, 12.4, 7.25, 2.02, 3.77, 5)
    roof(site, "晴川阁 lower swept eave", 0, 0, 18.7, 11.8, 5.65, 1.17, "ink",
         inner=(11.2, 6.8), kick=.78)
    timber_frame(site, "晴川阁 upper bays", 0, 0, 10.6, 6.3, 6.9, 3.07, 5)
    roof(site, "晴川阁 upper ridge", 0, 0, 15.9, 11.05, 9.85, 2.6, "ink",
         ridge=.52, kick=.88)
    balcony(site.part("晴川阁 · riverside balcony", "vermilion"), 0, 0, 14.75, 8.78, 6.9,
            height=.79, pitch=1.72)
    plaque(site, "晴川阁", 0, -3.25, 9.41, 2.75, .56)
    parapet = site.part("禹功矶石台 · river-facing parapet and corner posts", "stone")
    for sign in (-1, 1):
        rails(parapet, [(sign * 3.14, -6.48, 2.02), (sign * 11.50, -6.48, 2.02),
                        (sign * 11.50, 4.95, 2.02)], height=.91, pitch=1.58, width=.27)
        slab(parapet, sign * 11.5, -6.48, .4, .4, 2.88, 3.04)
    courtyard = site.part("绿瓦游廊 · foundations", "stone")
    for i, (x, y) in enumerate(((-14.8, 1.4), (14.7, 2.2))):
        slab(courtyard, x, y, 6.8, 6.9, -.65, 1.5)
        hall(site, f"附亭 {i + 1}", x, y, 4.65, 4.65, 1.5, 2.82, 2, "glaze",
             wall=None, ridge=0, rise=1.88, kick=.73)
        side = 1 if x > 0 else -1
        rails(site.part("绿瓦游廊 · handrails", "timber"),
              [(side * 8, -.8, 2.02), (side * 12.2, -.8, 1.5)], height=.79, pitch=1.62)

    gate_x, gate_y = 20, -8.9
    walls = site.part("铁门关 · brick rampart and barrel passage", "cityBrick")
    arcade_body(walls, gate_x, 13.4, gate_y - 2.67, gate_y + 3.2, -.32, 2.28, 4.42, 6.03)
    stone = site.part("铁门关 · arch ring and capstone", "stone")
    voussoirs(stone, gate_x, gate_y - 2.67, 2.28, 2.21, .18, .36)
    slab(stone, gate_x, gate_y + .2, 13.95, 6.41, 6.03, 6.43)
    parapet = site.part("铁门关 · crenellated parapet", "cityBrick")
    for side in (-1, 1):
        pos_y = gate_y + 2.89 * side
        slab(parapet, gate_x, pos_y, 13.18, .37, 6.43, 6.94)
        for i in range(10):
            parapet.box((gate_x - 5.98 + i * 1.33, pos_y, 7.09), (.65, .4, .31))
    hall(site, "铁门关城楼", gate_x, gate_y + .68, 7.65, 3.51, 6.43, 2.26, 3, "ink",
         wall="cityBrick", rise=1.75, kick=.64)
    plaque(site, "铁门关", gate_x, gate_y - 2.76, 5.43, 2.66, .59)
    return site.finish()


def phoenix(site, label, x, y, z, size, facing):
    """Bronze body, scroll-like tail and fanned flight feathers."""
    bird = site.part(label, "bronze")
    def point(dx, dy, dz):
        return (x + facing * size * dx, y + size * dy, z + size * dz)
    body = [(.1, 0, .36), (-.14, .21, .46), (-.57, .2, .88), (-.2, .09, 1.16),
            (-.08, -.07, 1.54), (.07, -.11, 1.56), (.11, -.09, 1.17), (.34, -.13, .83),
            (.17, .21, .74), (.02, .32, .65)]
    vertices = [point(px, py + offset, pz) for offset in (-.115, .115) for px, py, pz in body]
    n = len(body)
    faces = [tuple(range(n)), tuple(reversed(range(n, 2 * n))),
             *((i, i + n, (i + 1) % n + n, (i + 1) % n) for i in range(n))]
    if facing < 0:
        faces = [face[::-1] for face in faces]
    bird.solid(vertices, faces)
    bird.beam(point(.09, -.08, 1.46), point(.31, -.12, 1.44), size * .076)
    bird.beam(point(-.03, -.08, 1.54), point(-.22, -.02, 1.69), size * .054)
    bird.beam(point(.01, 0, .43), point(.03, -.09, .03), size * .066)
    bird.beam(point(.12, .11, .42), point(.23, .19, .025), size * .074)
    for i in range(5):
        a = point(-.26, .05, .83)
        b = point(-.56 - .065 * i, .19 + .095 * i, 1.16 + i * .048)
        c = point(-.81 - .068 * i, .13 + .11 * i, 1.47 + i * .07)
        bird.beam(a, b, size * (.121 - i * .009))
        bird.beam(b, c, size * (.09 - i * .008))
    for i in range(4):
        a = point(-.05, .11, 1.05)
        b = point(-.22 + .084 * i, .34 + i * .08, 1.15 + i * .09)
        c = point(-.53 + .05 * i, .57 + i * .10, 1.28 + i * .1)
        bird.beam(a, b, size * .105)
        bird.beam(b, c, size * .064)


def gable(site, label, x, y, z, w, h):
    """The orange triangular pediment and timber fretwork at Chu Tiantai."""
    elevation_prism(site.part(label + " · field", "timber"),
                    [(x - w / 2, z), (x + w / 2, z), (x, z + h)], y, y + .21)
    gold = site.part(label + " · painted fascia", "roofGold")
    gold.solid([(x - w * .54, y - .12, z), (x, y - .12, z + h + .1),
                (x + w * .54, y - .12, z), (x - w * .54, y + h * 2.6, z - .16),
                (x, y + h * 2.6, z + h * .84), (x + w * .54, y + h * 2.6, z - .16)],
               [(0, 1, 4, 3), (1, 2, 5, 4)])
    gold.beam((x - w / 2, y - .07, z), (x, y - .07, z + h), .18)
    gold.beam((x + w / 2, y - .07, z), (x, y - .07, z + h), .18)
    gold.beam((x - w / 2, y - .07, z), (x + w / 2, y - .07, z), .18)
    for side in (-1, 1):
        gold.beam((x + side * w * .22, y - .09, z + .13),
                  (x, y - .09, z + h * .72), .12)


def chutian():
    """Chu Tiantai, with the roof's solitary copper bird and the twin Fengbiao below."""
    site = Assembly("楚天台 · 凤标")
    terrace = site.part("章华台式 · stepped retaining terraces", "stone")
    slab(terrace, 0, .8, 28.6, 26.6, -5.65, 1.02)
    slab(terrace, 0, 1, 26.6, 24.72, 1.02, 2.4)
    slab(terrace, 0, 1, 24.1, 21.52, 2.4, 3.68)
    steps = site.part("磨山中轴 · ascending stairs", "stone")
    flight(steps, 0, -24.52, 6.7, 7.3, .08, 1.1, 9)
    slab(steps, 0, -16.68, 8.3, 1.12, .04, 1.1)
    flight(steps, 0, -16.13, 6.7, 6.48, 1.05, 3.7, 13)
    stairs = site.part("磨山中轴 · stair balustrades", "stone")
    for s in (-1, 1):
        rails(stairs, [(s * 3.48, -24.52, .1), (s * 3.48, -17.22, 1.1),
                      (s * 3.48, -16.13, 1.1), (s * 3.48, -9.65, 3.7)],
              height=.85, pitch=1.8, width=.2)
        slab(terrace, s * 4.52, -25.37, 2.45, 2.16, .01, .72)
        phoenix(site, f"凤标 · {'east' if s > 0 else 'west'} phoenix", s * 4.52, -25.37, .72, 1.59, -s)

    # The layered terrace ends expose dressed coping above the rough retaining courses.
    coping = site.part("章华台式 · terrace coping and stair shoulder", "plaster")
    for y, span, z in ((-12.37, 28.27, 1.02), (-11.22, 26.33, 2.4), (-9.59, 23.94, 3.68)):
        for sign in (-1, 1):
            slab(coping, sign * (span / 2 + 3.5) / 2, y, span / 2 - 3.5, .29, z - .18, z + .045)
            slab(coping, sign * 3.55, y, .48, .46, z - .10, z + .18)

    # The photographed silhouette has broad and narrow roof bands alternating,
    # with prominent triangular end gables above the narrower roof shoulders.
    tiers = (
        (3.68, 21.2, 16.45, 4.62, 1.48, 5),
        (9.78, 17.4, 13.6, 3.35, .92, 5),
        (14.03, 14.9, 11.1, 4.23, 1.51, 5),
        (19.76, 11.1, 8.76, 3.62, .92, 3),
        (24.28, 8.1, 6.5, 3.63, 2.29, 3),
    )
    for i, (z, w, d, h, rise, bays) in enumerate(tiers):
        label = f"楚天台 · terrace {i + 1}"
        balcony_floor = site.part(label + " floor", "timber")
        if i:
            slab(balcony_floor, 0, 1, w + .2, d + .19, z - .53, z)
        timber_frame(site, label, 0, 1, w - 1.15, d - 1.06, z, h, bays, style="vermilion")
        is_top = i == len(tiers) - 1
        roof_w = w + (3.65 if i % 2 == 0 else 1.82)
        roof_d = d + (3.17 if i % 2 == 0 else 1.82)
        ridge = roof(site, label + " roof", 0, 1, roof_w, roof_d, z + h - .12, rise,
                     "roofGold", inner=None if is_top else (tiers[i + 1][1], tiers[i + 1][2]),
                     ridge=.38, kick=.63 + .09 * (i % 2 == 0))
        if i in (2, 4):
            gable(site, label + " front gable", 0, 1 - d / 2 - .24, z + h + .05, w * .52, rise * .84)
        if i in (1, 3):
            balcony(site.part(label + " balcony", "ink"), 0, 1, w + .18, d + .16, z,
                    height=.74, pitch=1.92, levels=(.79,))
    phoenix(site, "楚天台顶 · copper phoenix", 0, 1, ridge + .14, .88, 1)
    plaque(site, "楚天台", 0, -6.77, 7.68, 4.1, .78)
    # The frontal marble mosaic is reduced to incised stones and a symmetrical bird.
    mural = site.part("丹凤朝阳 · marble relief", "stone")
    relief = site.part("丹凤朝阳 · carved panels", "bronze")
    for s in (-1, 1):
        mural.box((5.47 * s, -7.15, 5.49), (3.55, .21, 2.62))
        for j in range(5):
            relief.beam((5.48 * s, -7.272, 5.1 + .1 * j),
                        ((6.14 + j * .17) * s, -7.272, 5.46 + j * .2), .065)
    # A rack of chime bells stands in the open exhibit bay.
    rack = site.part("展厅 · chime-bell timber rack", "timber")
    bells = site.part("展厅 · bronze chime bells", "bronze")
    for x in (-2.35, 2.35):
        slab(rack, x, -7.58, .24, .26, 3.7, 6.08)
    for row, z in enumerate((4.78, 6.02)):
        rack.box((0, -7.58, z), (4.94, .27, .18))
        for i in range(6):
            r = .139 + i * .009
            circular(bells, (i - 2.5) * .68, -7.58,
                     [(r, z - .61 + .12 * row), (r * .72, z - .23), (.055, z - .08)], 6, sy=.65)
    return site.finish()


def octagonal_tier(site, level, r, ground, height):
    label = f"洪山宝塔 · storey {level + 1}"
    a, depth = r * sin(pi / 8), r * cos(pi / 8)
    body = site.part(label + " brick chamber", "stone")
    piers = site.part(label + " corner columns", "cityBrick")
    corbel = site.part(label + " corbelled brick eaves", "cityShade")
    seat = site.part(label + " flat stone gallery seat", "stone")
    shadow = site.part(label + " recessed doorways", "shadow")
    opening = min(1.05, a * .8)
    spring = height * .43
    door_base = ground + .26
    for side in range(8):
        rotation = side * pi / 4
        nx, ny = sin(rotation), -cos(rotation)
        tx, ty = cos(rotation), sin(rotation)
        def panel(part, shape, distance):
            part.solid([(u * tx + distance * nx, u * ty + distance * ny, z)
                        for u, z in shape], [tuple(range(len(shape)))])
        wall = [(-a, ground), (a, ground), (a, ground + height), (-a, ground + height)]
        if side % 2 != level % 2:
            panel(body, wall, depth)
        else:
            arch = [(opening * cos(k * pi / 10), door_base + spring + opening * sin(k * pi / 10))
                    for k in range(11)]
            panel(body, [(opening, ground), *wall[1:], wall[0],
                         (-opening, ground), (-opening, door_base),
                         *reversed(arch), (opening, door_base)], depth)
            panel(shadow, [(-opening - .1, door_base), (opening + .1, door_base), *arch],
                  depth - .22)
            panel(piers, [(-opening, door_base), (opening, door_base),
                          (opening, ground), (-opening, ground)][::-1], depth + .008)
            for pos in (-opening, opening):
                piers.beam((pos * tx + depth * nx, pos * ty + depth * ny, door_base),
                           (pos * tx + depth * nx, pos * ty + depth * ny, door_base + spring), .139)
        cx, cy = a * tx + depth * nx, a * ty + depth * ny
        piers.beam((cx, cy, ground + .12), (cx, cy, ground + height - .24), .25)
        for j in (-1, 0, 1):
            u = a * j * .67
            corbel.box((u * tx + (depth + .065) * nx,
                        u * ty + (depth + .065) * ny, ground + height - .14),
                       (.3, .24, .31), rotation)
    top = ground + height
    circular(corbel, 0, 0, [(r - .04, top - .22), (r + .32, top - .09),
                            (r + .78, top + .19), (r + .78, top + .44),
                            (r + .18, top + .50)], angle=pi / 8)
    circular(seat, 0, 0, [(r + .19, top + .48), (r + .38, top + .52),
                          (r + .38, top + .76)], angle=pi / 8)


def hongshan():
    """Hongshan's seven-storey brick-and-stone pagoda and the Baotong approach."""
    site = Assembly("洪山宝塔 · 宝通禅寺")
    foundation = site.part("洪山 · upper hillside terrace and tower plinth", "stone")
    slab(foundation, 0, -.365, 25.7, 18.53, -7.8, .2)
    slab(foundation, 0, -.69, 18.34, 17.88, .2, 2.21)
    for x in (-8.35, 8.35):
        slab(foundation, x, -.69, 1.28, 16.2, 2.21, 2.67)
    circular(foundation, 0, 0, [(6.66, 2.21), (6.66, 2.55), (6.22, 2.72),
                                 (6.22, 3.07), (5.85, 3.24)], angle=pi / 8)
    tablet = site.part("洪山摩崖 · carved stone marker", "cityShade")
    slab(tablet, -3.7, -10.22, 1.33, .66, 1.50, 1.78)
    tablet.box((-3.7, -10.22, 2.51), (.98, .42, 1.51))
    ground = 3.24
    sizes = (5.85, 5.47, 5.12, 4.75, 4.37, 3.97, 3.51)
    heights = (4.59, 4.35, 4.07, 3.93, 3.71, 3.49, 3.33)
    for level, (r, height) in enumerate(zip(sizes, heights)):
        octagonal_tier(site, level, r, ground, height)
        ground += height + .76
    circular(site.part("洪山宝塔 · stone crown", "cityShade"), 0, 0,
             [(3.64, ground - .3), (3.14, ground + .31), (2.27, ground + .89),
              (1.16, ground + 1.43), (.43, ground + 1.75)], angle=pi / 8)
    circular(site.part("洪山宝塔 · copper finial", "bronze"), 0, 0,
             [(.43, ground + 1.73), (.63, ground + 1.99), (.63, ground + 2.25),
              (.43, ground + 2.48), (.48, ground + 2.74), (.26, ground + 3.06),
              (.12, ground + 3.42), (.035, ground + 3.8)], angle=pi / 8)

    gate_floor, main_floor, ancestor_floor = .15, .90, 1.50
    lower = site.part("宝通寺山门 · lower stone terrace", "stone")
    middle = site.part("大雄宝殿 · middle stone terrace", "stone")
    upper = site.part("祖师殿 · upper stone terrace", "stone")
    # Foundation bottoms follow the terrainTop samples converted to this model's local axes.
    slab(lower, 0, -22.55, 13.1, 4.55, -3.85, gate_floor)
    slab(middle, 0, -16.95, 17.2, 5.05, -3.85, main_floor)
    base = [(-4.5, -13.19, -3.92), (4.5, -13.19, -3.727),
            (4.5, -9.77, -3.11), (-4.5, -9.77, -3.451)]
    upper.solid(base + [(x, y, ancestor_floor) for x, y, _ in base],
                [(0, 3, 1), (1, 3, 2), (4, 5, 6, 7),
                 (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)])
    steps = site.part("宝通寺 · stone stairs between terraces", "stone")
    slab(steps, 0, -24.9625, 4.64, .275, -.55, -.13)
    slab(steps, 0, -19.875, 4.64, .80, -.55, gate_floor)
    flight(steps, 0, -20.275, 4.64, .80, gate_floor, main_floor, 3)
    slab(steps, 0, -13.8075, 4.22, 1.235, -.55, main_floor)
    flight(steps, 0, -14.425, 4.22, 1.235, main_floor, ancestor_floor, 2)
    # The pagoda stairs diverge to let the ancestral hall keep the axis.
    for x in (-5.5, 5.5):
        slab(steps, x, -10.64, 2.1, 2.02, -.55, ancestor_floor)
        flight(steps, x, -11.65, 2.1, 2.02, ancestor_floor, 2.21, 3)

    hall(site, "宝通禅寺山门", 0, -22.55, 7.56, 2.18, gate_floor, 2.73, 3, "glaze",
         rise=1.36, kick=.45, wall=None, style="vermilion")
    plaque(site, "宝通禅寺", 0, -23.70, 2.64, 2.66, .48)
    hall(site, "大雄宝殿", 0, -16.95, 12.32, 3.67, main_floor, 3.95, 5, "roofGold",
         rise=2.06, kick=.70, wall="roofGold", style="vermilion")
    hall(site, "祖师殿", 0, -11.48, 6.26, 2.18, ancestor_floor, 2.69, 3, "ink",
         rise=1.34, kick=.44, wall="roofGold", style="vermilion")

    lions = site.part("宝通寺 · paired stone lions and plinths", "stone")
    for x in (-4.9, 4.9):
        y = -23.63
        slab(lions, x, y, 1.19, 1.35, gate_floor, .53)
        slab(lions, x, y, 1.06, 1.19, .53, .72)
        circular(lions, x, y + .10, [(.43, .71), (.44, .96), (.34, 1.35)], sy=1.17)
        circular(lions, x, y - .21, [(.24, 1.25), (.37, 1.48), (.32, 1.72), (.21, 1.81)])
        lions.box((x, y - .51, 1.49), (.41, .29, .29))
        for sign in (-1, 1):
            lions.beam((x + .24 * sign, y, 1.29), (x + .26 * sign, y - .42, .82), .21)
            lions.cylinder(x + .23 * sign, y - .17, 1.69, 1.89, .091, 6)
    flanks = site.part("宝通寺 · yellow flank walls", "roofGold")
    caps = site.part("宝通寺 · coping tiles", "ink")
    for s in (-1, 1):
        slab(flanks, s * 9.48, -17.28, .56, 9.52, -.55, 2.18)
        slab(caps, s * 9.48, -17.28, .76, 9.71, 2.17, 2.42)
    return site.finish()


def perimeter(site, label, runs, top, color):
    wall = site.part(label + " · plastered wall", color)
    coping = site.part(label + " · dark tile coping", "ink")
    for x, y, w, d in runs:
        slab(wall, x, y, w, d, 0, top)
        slab(coping, x, y, w + .16, d + .17, top, top + .11)
        slab(coping, x, y, w + .06, d + .07, top + .11, top + .21)


def lower_canopy(site, label, axis, y, w, d, z, h, bays, key, *, wall=None):
    timber_frame(site, label, axis, y, w, d, z, h, bays, wall=wall)
    roof(site, label + " roof", axis, y, w + .87, d + .96, z + h - .11,
         1.09, key, ridge=.66, kick=.29)


def canopy_supports(part, x, y, w, d, z, h):
    for dx in (-w / 2, w / 2):
        for dy in (-d / 2, d / 2):
            part.cylinder(x + dx, y + dy, z, z + h, .15, 6)
            part.box((x + dx, y + dy, z + h - .13), (.46, .38, .22))
        part.box((x + dx, y, z + h - .22), (.17, d, .25))
    for dy in (-d / 2, d / 2):
        part.box((x, y + dy, z + h - .22), (w, .17, .25))


def arhat_roof(part, x, y):
    """Nine ridge junctions and their connecting slopes form one roof around four courts."""
    ridge_axis = (-7.08, 0, 7.08)
    half, eave, ridge = 1.76, 3.02, 4.34
    points, faces, index = [], [], {}

    def face(*corners):
        for point in corners:
            if point not in index:
                index[point] = len(points)
                points.append(point)
        faces.append(tuple(index[point] for point in corners))

    for col, u in enumerate(ridge_axis):
        for row, v in enumerate(ridge_axis):
            left, right, front, back = u-half, u+half, v-half, v+half
            ring = [
                (left, front, eave), (u, front, ridge if row else eave),
                (right, front, eave), (right, v, ridge if col < 2 else eave),
                (right, back, eave), (u, back, ridge if row < 2 else eave),
                (left, back, eave), (left, v, ridge if col else eave)
            ]
            for a, b in zip(ring, ring[1:] + ring[:1]):
                face((u, v, ridge), a, b)
            if col < 2:
                next_left = ridge_axis[col+1] - half
                face(ring[2], (next_left, front, eave), (next_left, v, ridge), ring[3])
                face(ring[3], (next_left, v, ridge), (next_left, back, eave), ring[4])
            if row < 2:
                next_front = ridge_axis[row+1] - half
                face(ring[6], ring[5], (u, next_front, ridge), (left, next_front, eave))
                face(ring[5], ring[4], (right, next_front, eave), (u, next_front, ridge))

    # Close only the outer and courtyard eaves. The shared edges inside the roof are welded.
    boundary = set()
    for polygon in faces:
        for a, b in zip(polygon, polygon[1:] + polygon[:1]):
            if (b, a) in boundary:
                boundary.remove((b, a))
            else:
                boundary.add((a, b))
    count = len(points)
    top = [(x+u, y+v, z) for u, v, z in points]
    underside = [(u, v, z-.25) for u, v, z in top]
    inner = [tuple(i+count for i in reversed(polygon)) for polygon in faces]
    fascia = [(b, a, a+count, b+count) for a, b in sorted(boundary)]
    part.solid(top + underside, faces + inner + fascia)


def guiyuan():
    """Guiyuan's living temple courtyards, with the distinctive 田-plan Arhat Hall."""
    site = Assembly("归元禅寺")
    ground = site.part("青石院落 · successive courtyards", "stone")
    slab(ground, 8.72, 0, 50.3, 59.5, -3.4, .04)
    axis = site.part("香道 · laid walkway slabs", "plaster")
    for i in range(18):
        slab(axis, 0, -25.26 + i * 2.8, 4.86, 2.735, .04, .13)
    perimeter(site, "界墙", [(8.72, 29.55, 50, .48), (-16.25, 0, .48, 59.1),
                             (33.45, 0, .48, 59.1), (-9.93, -29.55, 12.8, .48),
                             (19.04, -29.55, 28.75, .48)], 1.78, "plaster")

    gate = site.part("归元禅寺山门 · portal and screen", "plaster")
    arcade_body(gate, 0, 10.88, -29.37, -27.24, .04, 1.48, 2.72, 3.28)
    voussoirs(site.part("山门 · stone door surround", "stone"), 0, -29.38, 1.48, 1.36)
    roof(site, "山门 · painted terrace roof", 0, -28.3, 12.22, 4.32, 3.26, 1.37, "ink", kick=.51)
    plaque(site, "归元禅寺山门", 0, -30.43, 3.36, .66, .84)
    threshold = site.part("山门 · dressed threshold and inner stone margins", "stone")
    slab(threshold, 0, -29.63, 2.88, .62, .04, .18)
    side_doors = site.part("山门 · timber side doors and transoms", "vermilion")
    for sign in (-1, 1):
        x = sign * 2.57
        slab(threshold, x, -29.47, 1.12, .73, .04, .34)
        slab(threshold, x, -29.47, .94, .61, .34, .49)
        slab(threshold, sign * 6.06, -19.33, .31, 6.9, .04, .23)
        slab(side_doors, sign*3.64, -29.38, 1.26, .26, .22, 2.38)
        slab(threshold, sign*3.64, -29.49, 1.75, .34, 2.25, 2.52)
    for s in (-1, 1):
        x = s * 8
        label = "钟楼" if s < 0 else "鼓楼"
        slab(ground, x, -15.22, 5.74, 5.4, .04, .64)
        floor = site.part(label + " · upper gallery", "stone")
        slab(floor, x, -15.22, 3.44, 3.31, 3.79, 4)
        frame = site.part(label + " · lower and upper timber frame", "timber")
        canopy_supports(frame, x, -15.22, 4.06, 3.85, .64, 2.26)
        canopy_supports(frame, x, -15.22, 3.10, 2.87, 4, 1.91)
        roof(site, label + " lower roof", x, -15.22, 4.98, 4.79, 2.78, 1.08, "ink",
             inner=(3.16, 3), kick=.29)
        roof(site, label + " upper roof", x, -15.22, 5.57, 5.15, 5.79, 1.27, "ink",
             ridge=0, kick=.44)
        hanging = site.part(label + " · suspended instrument", "bronze")
        circular(hanging, x, -15.22, [(r, z) for r, z in
                 ((.63, 4.11), (.63, 4.26), (.54, 4.53), (.38, 5.15), (.12, 5.35))])

    slab(ground, 0, -.51, 19.32, 16.52, .04, 1.27)
    flight(ground, 0, -10.77, 5.66, 2.0, .12, 1.27, 7)
    moon_terrace = site.part("大雄宝殿 · moon terrace stone balustrade", "plaster")
    for sign in (-1, 1):
        x = sign * 6.17
        slab(moon_terrace, x, -8.71, 6.12, .31, 1.22, 1.76)
        for offset in (-3.16, 0, 3.16):
            slab(moon_terrace, x+offset, -8.71, .42, .42, 1.22, 1.94)
    hall(site, "大雄宝殿", 0, .65, 15.24, 10.62, 1.27, 4.92, 5, "ink",
         wall="roofGold", rise=3.17, kick=1.04, style="vermilion")
    roof(site, "大雄宝殿 · lower skirt roof", 0, -.08, 18.63, 12.37, 4.84, 1.15, "ink",
         inner=(13.6, 8.75), kick=.66)
    censer = site.part("大雄宝殿 · incense cauldron", "bronze")
    foot = site.part("大雄宝殿 · incense stone bases", "stone")
    for x in (-4.14, 4.14):
        y, base = -7.42, 1.27
        slab(foot, x, y, 1.03, 1.03, base, base+.27)
        circular(censer, x, y, [(r, base+z) for r, z in
                    ((.28, .27), (.29, .59), (.57, .79), (.59, 1.06), (.44, 1.19), (.32, 1.02))])
        for sign in (-1, 1):
            censer.beam((x + sign*.49, y, base+.85), (x + sign*.69, y, base+1.24), .25)
    plaque(site, "大雄宝殿", 0, -4.79, 5.82, 3.35, .63)

    # Four open courts are defined by the cross and perimeter rooms of the Arhat Hall.
    rx, ry = 22.38, -.6
    slab(ground, rx, ry, 17.68, 17.68, .04, .57)
    rooms = site.part("罗汉堂 · galleries around four light courts", "plaster")
    doors = site.part("罗汉堂 · south gallery doors", "timber")
    for offset in (-7.08, 0, 7.08):
        slab(rooms, rx+offset, ry, 2.92, 17.08, .57, 3.08)
        slab(doors, rx+offset, ry-8.45, 1.38, .25, .59, 2.39)
        for sign in (-1, 1):
            slab(rooms, rx+sign*3.54, ry+offset, 4.16, 2.92, .57, 3.08)
    arhat_roof(site.part("罗汉堂 · interlocking tiled ridges", "ink"), rx, ry)

    pond = site.part("翠微古池 · stone pond rim", "stone")
    for x in (-4.56, 4.56):
        slab(pond, x, 12.45, .45, 5.4, .04, .62)
    for y in (9.75, 15.15):
        slab(pond, 0, y, 9.55, .49, .04, .62)
    slab(site.part("翠微古池 · reflective basin", "glaze"), 0, 12.45, 8.92, 5.03, .05, .22)
    coping = site.part("翠微古池 · dressed rim stones", "plaster")
    for sign in (-1, 1):
        for i in range(6):
            slab(coping, sign * 4.56, 10.24 + .885 * i, .55, .855, .61, .735)
        for i in range(8):
            slab(coping, (i - 3.5) * 1.065, 12.45 + sign * 2.7, 1.04, .58, .61, .735)
    slab(ground, 0, 23.22, 15.0, 10.5, .04, .79)
    flight(ground, 0, 16.32, 3.76, 1.65, .12, .79, 3)
    lower_canopy(site, "藏经阁 · lower gallery", 0, 23.22, 12.03, 7.82, .79, 3.35, 5, "ink", wall="plaster")
    upper_floor = site.part("藏经阁 · upper timber platform", "timber")
    slab(upper_floor, 0, 23.22, 10.50, 6.46, 3.94, 5.12)
    hall(site, "藏经阁 · sutra storey", 0, 23.22, 10.13, 6.1, 5.1, 2.98, 5, "ink", rise=2.13,
         kick=.67)
    plaque(site, "藏经阁", 0, 20.05, 7.74, 2.7, .53)
    return site.finish()


def qintai():
    """The low courts of Guqin Terrace, with white marble, steles and a side porch."""
    site = Assembly("古琴台")
    base = site.part("琴台园 · stone perimeter and paving", "stone")
    slab(base, -.15, 1.2, 29.8, 37.5, -3.2, .04)
    for i in range(13):
        slab(base, 0, -14.8 + 2.48 * i, 4.4, 2.40, .04, .13)
    perimeter(site, "月湖山墙", [(-14.56, 1.1, .51, 36.7), (14.56, 1.1, .51, 36.7),
                                  (0, 19.16, 29.2, .46), (-9.41, -17.25, 10.1, .5),
                                  (9.41, -17.25, 10.1, .5)], 1.94, "plaster")
    pale = site.part("伯牙抚琴台 · white marble margins", "plaster")
    slab(pale, 0, -3.8, 10.8, 10.12, .04, .41)
    slab(pale, 0, -3.8, 10.52, 9.9, .41, 1.16)
    slab(pale, 0, -3.8, 10.74, 10.06, 1.16, 1.39)
    flight(pale, 0, -11.13, 4.3, 2.33, .04, 1.39, 6)
    rails(site.part("伯牙抚琴台 · carved stone balusters", "plaster"),
          [(-2.2, -8.74, 1.39), (-5.03, -8.74, 1.39),
           (-5.03, 1.04, 1.39), (5.03, 1.04, 1.39),
           (5.03, -8.74, 1.39), (2.2, -8.74, 1.39)], height=.93, pitch=1.36, width=.24)
    inscribed = site.part("琴台 · inscribed stone", "cityShade")
    slab(inscribed, -.3, -2.38, 1.42, .68, 1.39, 1.58)
    inscribed.box((-.3, -2.38, 2.12), (1.19, .36, 1.08))

    slab(base, 0, 10.01, 13.66, 9.14, .04, .82)
    flight(base, 0, 3.91, 4.8, 1.68, .09, .82, 4)
    hall(site, "高山流水 · main hall", 0, 10.01, 11.67, 7.13, .82, 3.8, 5,
         "glaze", rise=2.47, kick=.69)
    lower_canopy(site, "高山流水 · forward portico", 0, 5.96, 5.66, 2.38, .82,
                 2.93, 2, "glaze")
    plaque(site, "高山流水", 0, 4.67, 3.58, 2.48, .53)

    for s in (-1, 1):
        x = s * 11.17
        label = "碑廊 east" if s > 0 else "碑廊 west"
        hall(site, label, x, 4.29, 2.48, 12.21, .18, 2.23, 1, "ink",
             wall=None, rise=1.01, ridge=.06, kick=.32)
        steles = site.part(label + " · stone inscriptions", "cityShade")
        for j in range(5):
            y = -.7 + j * 2.29
            steles.box((x + s * .5, y, 1.25), (.22, 1.15, 1.54))
            steles.box((x + s * .5, y, .36), (.65, 1.23, .31))

    gate = site.part("古琴台 · white gateway", "plaster")
    arcade_body(gate, 0, 8.86, -17.84, -16.43, .04, 1.95, 3.12, 4.22)
    roof(site, "古琴台 · gateway ridge", 0, -17.14, 10.3, 3.67, 4.14, 1.24, "glaze",
         ridge=.48, kick=.56)
    plaque(site, "古琴台山门", 0, -17.99, 3.72, 2.36, .48)
    stone = site.part("古琴台 · gate arch trim and garden terrace edging", "stone")
    voussoirs(stone, 0, -17.84, 1.95, 1.56, .16, .23)
    slab(stone, 0, -17.98, 3.24, .69, .03, .17)
    for sign in (-1, 1):
        slab(stone, sign * 2.16, -17.94, .86, .57, .04, .54)
        slab(stone, sign * 2.16, -17.96, .99, .64, .54, .68)
        # Low stone-edged beds run from the white marble terrace to the stele gallery.
        for x in (sign * 6.57, sign * 9.0):
            slab(stone, x, -2.39, .22, 6.6, .04, .35)
        for y in (-5.66, .88):
            slab(stone, sign * 7.785, y, 2.21, .22, .04, .35)
        slab(site.part("琴台园 · planted court beds", "glaze"),
             sign * 7.785, -2.39, 2.21, 6.37, .045, .19)
    screen = site.part("印心石屋 · inscribed screen wall", "plaster")
    slab(screen, -8.16, -12.88, 4.76, .54, .04, 2.54)
    slab(site.part("印心石屋 · screen roof", "ink"), -8.16, -12.88, 5.03, .82, 2.54, 2.76)
    plaque(site, "印心石屋", -8.16, -13.27, 1.78, 2.74, .59)
    return site.finish()


def walk_deck(deck, piers, handrail, path, w, *, stone=False):
    """Lay out a pedestrian boardwalk on piles and keep both handrails continuous."""
    edges = [[], []]
    for index, (x, y, z) in enumerate(path):
        before, after = path[max(index - 1, 0)], path[min(index + 1, len(path) - 1)]
        dx, dy = after[0] - before[0], after[1] - before[1]
        length = hypot(dx, dy)
        for j, sign in enumerate((-1, 1)):
            edges[j].append((x + sign * dy * w / (2 * length),
                             y - sign * dx * w / (2 * length), z))
        deck_start = edges[0][-1]
        deck_end = edges[1][-1]
        for px, py, top in (deck_start, deck_end):
            piers.cylinder(px, py, -2.8, top - .13, .16 if stone else .135, 8)
    for i in range(len(path) - 1):
        panels = (edges[0][i], edges[1][i], edges[1][i + 1], edges[0][i + 1])
        deck.solid([(x, y, z + dz) for dz in (-.24, 0) for x, y, z in panels],
                   [(3, 2, 1, 0), (4, 5, 6, 7), (0, 1, 5, 4),
                    (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)])
    for edge in edges:
        rails(handrail, edge, height=.77, pitch=1.53, width=.17, levels=(.37, .88))


def qu_yuan(site, x, y, z):
    """Low-poly robe folds, crossed sleeves and high scholar's cap."""
    robe = site.part("屈原像 · carved robes and high cap", "stone")
    light = site.part("屈原像 · raised garment folds", "plaster")
    circular(robe, x, y, [(.61, z), (.56, z + .3), (.52, z + .89),
                          (.40, z + 1.64), (.48, z + 2.12), (.37, z + 2.64),
                          (.13, z + 2.85)], 8, angle=pi / 8, sy=.7)
    circular(robe, x, y - .04, [(.135, z + 2.82), (.227, z + 2.94), (.253, z + 3.16),
                                (.207, z + 3.33), (.141, z + 3.44)], 8, sy=.76)
    circular(robe, x, y - .012, [(.207, z + 3.28), (.248, z + 3.42), (.175, z + 3.76),
                                 (.065, z + 3.83)], 8, angle=pi / 8, sy=.67)
    robe.beam((x - .40, y - .03, z + 2.36), (x - .27, y - .40, z + 1.66), .31)
    robe.beam((x + .39, y - .02, z + 2.34), (x + .15, y - .43, z + 1.7), .32)
    robe.beam((x + .27, y - .38, z + 1.87), (x - .19, y - .44, z + 1.7), .22)
    robe.beam((x - .21, y - .16, z + 2.99), (x - .04, y - .25, z + 2.72), .10)
    for i, r in enumerate((-.48, -.34, -.18, .02, .19, .34, .48)):
        light.beam((x + r * .58, y - .26, z + 1.59), (x + r, y - .36, z + .43),
                   .045 + i % 2 * .009)


def lake():
    """Xingyin Pavilion and walks, centred at 114.37112 E, 30.56733 N."""
    site = Assembly("东湖听涛 · 行吟阁")
    base = site.part("湖心岛 · ashlar waterfront retaining edge", "stone")
    profile = [(-15.8, -18.2), (-9.8, -21.5), (2.9, -21.95), (11.15, -18.36),
               (15.1, -11.74), (17.22, -3.41), (16.8, 7.64), (11.87, 14.39),
               (3.11, 17.45), (-6.23, 16.64), (-14.8, 12.6), (-19.14, 4.33),
               (-19.2, -4.1), (-18.44, -13.68)]
    loft(base, [[(x * radius, y * radius, z) for x, y in profile]
                for radius, z in ((.89, -2.5), (1.0, .54), (1.03, .82))])
    top = site.part("湖心岛 · grass terrace and waterside walks", "glaze")
    top.prism([(x * .955, y * .955) for x, y in profile], .75, .91)
    path = site.part("湖心岛 · paved shrine approach", "plaster")
    for y in (-18.65, -15.5, -12.35, -9.2, -6.05):
        slab(path, 0, y, 6.32, 3.12, .91, .98)
    slab(base, 0, .09, 15.17, 13.96, .91, 1.84)
    slab(base, 0, .09, 15.43, 14.19, 1.71, 1.94)
    flight(base, 0, -9.05, 4.75, 2.11, .92, 1.94, 6)
    rails(site.part("行吟阁 · white stone terrace balusters", "plaster"),
          [(-2.43, -6.77, 1.94), (-7.38, -6.77, 1.94), (-7.38, 6.93, 1.94),
           (7.38, 6.93, 1.94), (7.38, -6.77, 1.94), (2.43, -6.77, 1.94)],
          height=.79, pitch=1.6, width=.21)

    # A pale open ground-floor colonnade, green tiled eaves and square pyramidal crown.
    terraces = ((1.94, 12.8, 5.31, 1.32), (8.57, 10.33, 3.92, 1.15),
                (13.58, 7.5, 3.47, 3.45))
    core = site.part("行吟阁 · walkaround gallery paving", "stone")
    for i, (z, size, h, rise) in enumerate(terraces):
        label = f"行吟阁 · tier {i + 1}"
        if i:
            slab(core, 0, 0, size + .8, size + .8, z - .29, z + .03)
        timber_frame(site, label, 0, 0, size - .48, size - .48, z, h, 3,
                     wall="plaster", style="plaster" if i == 0 else "timber")
        inner = (terraces[i + 1][1],) * 2 if i < 2 else None
        roof(site, label + " green glazed roof", 0, 0, size + 2.3, size + 2.3,
             z + h - .13, rise, "glaze", inner=inner, ridge=0, kick=.69 - .08 * i)
        if i:
            balcony(site.part(label + " · open gallery railing", "plaster"), 0, 0, size + .63,
                    size + .63, z, height=.75, pitch=1.8)
    plaque(site, "行吟阁", 0, -6.22, 6.59, 2.86, .63)

    plinth = site.part("屈原像 · masonry pedestal", "stone")
    slab(plinth, 0, -13.95, 3.3, 2.82, .98, 1.3)
    slab(plinth, 0, -13.95, 2.76, 2.33, 1.3, 1.72)
    slab(plinth, 0, -13.95, 2.12, 1.78, 1.72, 3.78)
    slab(plinth, 0, -13.95, 2.34, 1.9, 3.78, 4.07)
    qu_yuan(site, 0, -13.95, 4.07)
    for x in (-4.55, 4.55):
        slab(plinth, x, -9.98, 1.35, 1.35, .91, 1.16)
        circular(site.part("行吟阁前 · bronze ritual vessels", "bronze"), x, -9.98,
                 [(.27, 1.16), (.34, 1.37), (.6, 1.64), (.64, 1.94), (.49, 2.1)], 8)

    walk_deck(site.part("荷风桥 · promenade deck", "stone"),
              site.part("荷风桥 · masonry piers", "stone"),
              site.part("荷风桥 · stone handrails", "plaster"),
              [(0, -19.3, .98), (-.13, -23.6, 1.1), (-.29, -27.5, 1.15),
               (-.49, -31.45, 1.05), (-.65, -35.7, .91)], 3.58, stone=True)
    walk_deck(site.part("落羽桥 · connecting footway", "deck"),
              site.part("落羽桥 · approach supports", "stone"),
              site.part("落羽桥 · handrails", "plaster"),
              [(-7.32, 13.56, .89), (-11.08, 17.12, .96), (-16.08, 21.55, 1.01),
               (-21.55, 26.48, .9)], 2.93, stone=True)
    # Island-side threshold stones remain on the built bridge axes so the shore walk can meet them.
    threshold = site.part("荷风桥与落羽桥 · bridgehead coping and newels", "plaster")
    for x, y, z, w, angle in ((0, -20.44, .998, 3.64, -.03),
                             (-8.94, 15.10, .925, 2.99, .81)):
        threshold.box((x, y, z), (w, .36, .17), angle)
        for sign in (-1, 1):
            px = x + sign * w / 2 * cos(angle)
            py = y + sign * w / 2 * sin(angle)
            threshold.box((px, py, z + .38), (.36, .36, .79), angle)
            threshold.box((px, py, z + .81), (.46, .46, .13), angle)
    dock = site.part("行吟阁码头 · boarding terrace", "deck")
    slab(dock, 15.6, -9.91, 8.6, 6.02, -.15, .89)
    slab(dock, 21.5, -9.91, 3.2, 4.1, -.3, .49)
    piles = site.part("行吟阁码头 · waterside piles and bollards", "steel")
    for x in (14.55, 18.3, 21.6, 23.6):
        for y in (-11.86, -7.92):
            piles.cylinder(x - .75, y, -2.5, .99 if x < 19 else .63, .19, 8)
    rails(site.part("行吟阁码头 · safety barriers", "steel"),
          [(14.55, -12.65, .89), (19.37, -12.65, .89), (19.37, -11.7, .89)], height=.72, pitch=1.7)
    rails(site.part("行吟阁码头 · safety barriers", "steel"),
          [(14.55, -7.15, .89), (19.37, -7.15, .89), (19.37, -8.07, .89)], height=.72, pitch=1.7)
    plaque(site, "行吟阁码头", 17.11, -12.64, 1.62, 2.16, .38)
    return site.finish()
