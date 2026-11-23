"""Wuhan Yangtze River Bridge, drawn in the map's vertically exaggerated units."""

from math import cos, pi, sin

from mesh import Part


MAIN_END = 72
ROAD = 11.9
LOWER_CHORD = 5.15
UPPER_CHORD = 11.15


def road_height(y):
    return ROAD - max(0, abs(y) - MAIN_END) * .127


def loft(part, rings):
    """Cap and join counterclockwise horizontal rings, from bottom to top."""
    n = len(rings[0])
    faces = [tuple(reversed(range(n)))]
    for j in range(len(rings) - 1):
        for i in range(n):
            a, b = j * n + i, j * n + (i + 1) % n
            faces.append((a, b, b + n, a + n))
    faces.append(tuple(range((len(rings) - 1) * n, len(rings) * n)))
    part.solid([point for ring in rings for point in ring], faces)


def build_piers():
    piers = Part("Eight cutwater piers and two abutments", "stone")
    seats = Part("Pier caps and bearing shoes", "steel")
    # Long upstream and downstream noses face across the deck.
    plan = [(-6.3, 0), (-5.65, -1.12), (-3.8, -1.66), (3.8, -1.66),
            (5.65, -1.12), (6.3, 0), (5.65, 1.12), (3.8, 1.66),
            (-3.8, 1.66), (-5.65, 1.12)]
    for y in range(-56, 57, 16):
        loft(piers, [[(x * scale, y + dy * scale, z) for x, dy in plan]
                     for z, scale in [(-3, 1.06), (.7, 1.06), (4.23, .89)]])
        piers.box((0, y, 4.37), (11.3, 3.34, .46))
        for side in (-1, 1):
            seats.box((side * 4.18, y, 4.70), (1.1, 1.19, .35))
    for y in (-MAIN_END, MAIN_END):
        piers.box((0, y, 1.05), (11.3, 3.25, 7.35))
    piers.finish()
    seats.finish()


def build_trusses_and_rail():
    truss = Part("Three continuous steel truss units", "steel")
    plates = Part("Gussets and chord flanges", "shadow")
    railbed = Part("Lower railway bed and stringers", "deck")
    rails = Part("Two tracks and cross ties", "ink")
    railbed.box((0, 0, 5.10), (8.56, 168, .49))
    for track in (-2.02, 2.02):
        for offset in (-.72, .72):
            rails.box((track + offset, 0, 5.55), (.15, 168, .18))
        for y in range(-83, 84, 2):
            rails.box((track, y, 5.39), (2.24, .33, .13))
    # Each continuous unit covers three spans. Tiny joints separate the flanges.
    for start in (-72, -24, 24):
        for x in (-4.18, 4.18):
            for z in (LOWER_CHORD, UPPER_CHORD):
                truss.box((x, start + 24, z), (.55, 47.95, .52))
                plates.box((x, start + 24, z - .23), (.72, 47.95, .13))
            for y in range(start, start + 48, 8):
                low_a = (x, y, LOWER_CHORD)
                high_a = (x, y, UPPER_CHORD)
                low_b = (x, y + 8, LOWER_CHORD)
                high_b = (x, y + 8, UPPER_CHORD)
                truss.beam(low_a, high_b, .38)
                truss.beam(high_a, low_b, .27)
    for y in range(-72, 73, 8):
        for x in (-4.18, 4.18):
            truss.box((x, y, (LOWER_CHORD + UPPER_CHORD) / 2),
                      (.39, .34, UPPER_CHORD - LOWER_CHORD))
            for z in (LOWER_CHORD + .3, UPPER_CHORD - .3):
                plates.box((x, y, z), (.55, .93, .7))
            # Steel brackets carry the sidewalks outside the principal trusses.
            truss.beam((x, y, UPPER_CHORD - 1.01),
                       (x * 1.44, y, UPPER_CHORD + .3), .24)
        truss.box((0, y, LOWER_CHORD - .07), (8.76, .42, .42))
        truss.box((0, y, UPPER_CHORD + .15), (12.1, .42, .47))
        if y < MAIN_END:
            truss.beam((-4.1, y, LOWER_CHORD - .23),
                       (4.1, y + 8, LOWER_CHORD - .23), .17)
    for part in (truss, plates, railbed, rails):
        part.finish()


def deck_strip(part, x, width, y0, y1, offset, thickness):
    """A road-parallel slab with vertical ends, so slopes meet without seams."""
    edge = [(x - width / 2, y0), (x + width / 2, y0),
            (x + width / 2, y1), (x - width / 2, y1)]
    loft(part, [[(px, py, road_height(py) + h) for px, py in edge]
                for h in (offset - thickness, offset)])


def build_road():
    paving = Part("Roadway and approach surfaces", "deck")
    parapets = Part("Cantilevered walks and parapet posts", "plaster")
    railings = Part("Open railings and paired lamp arms", "steel")
    lamps = Part("Porcelain lamp globes", "plaster")
    for y0, y1 in [(-154, -72), (-72, 72), (72, 154)]:
        deck_strip(paving, 0, 12.05, y0, y1, 0, .51)
        deck_strip(parapets, 0, .09, y0, y1, .015, .02)
        for x in (-5.45, 5.45):
            deck_strip(parapets, x, 1.15, y0, y1, .18, .33)
            rail_x = x * 1.078
            for height in (.64, 1.05):
                railings.beam((rail_x, y0, road_height(y0) + height),
                              (rail_x, y1, road_height(y1) + height), .1)
    for y in range(-152, 153, 4):
        h = road_height(y)
        for side in (-1, 1):
            x = side * 5.88
            parapets.box((x, y, h + .63), (.24, .27, .91))
            # Two subdued lane dividers leave the center line continuous.
            deck_strip(parapets, side * 2.4, .085, y - .71, y + .71, .025, .02)
    for y in range(-72, 73, 16):
        for x in (-5.63, 5.63):
            # Paired pendant globes recall the original 1957 lamp standard.
            parapets.cylinder(x, y, ROAD + .17, ROAD + 1.10, .20, 8)
            railings.cylinder(x, y, ROAD + 1.08, ROAD + 3.15, .095, 8)
            for side in (-1, 1):
                railings.beam((x, y, ROAD + 2.79), (x, y + side * .49, ROAD + 3.15), .095)
                lamps.cylinder(x, y + side * .49, ROAD + 2.84, ROAD + 3.10, .17, 8)
    for part in (paving, parapets, railings, lamps):
        part.finish()


def build_approaches():
    walls = Part("Masonry arcade spandrels", "stone")
    moulding = Part("Arch rings and impost courses", "plaster")
    # The intrados and spandrel share a profile. Each opening remains hollow.
    for sign in (-1, 1):
        for start in range(72, 144, 12):
            for side in (-1, 1):
                xs = sorted([side * 3.60, side * 4.68])
                shell, ring = [[], []], [[], []]
                for i in range(13):
                    t = i / 12
                    y = sign * (start + 6 - 5.25 * cos(pi * t))
                    top = road_height(y) - .48
                    # The shallower arches near grade still have positive legs.
                    spring = min(2.05, top * .23)
                    soffit = spring + (top - spring - .66) * sin(pi * t)
                    for j, x in enumerate(xs):
                        shell[j].extend([(x, y, soffit), (x, y, top)])
                        rx = x + side * .08
                        ring[j].extend([(rx, y, soffit - .035), (rx, y, soffit + .27)])
                for part, strips in ((walls, shell), (moulding, ring)):
                    vertices = strips[0] + strips[1]
                    step = len(strips[0])
                    faces = []
                    for k in range(0, step - 2, 2):
                        faces.extend([(k, k + 2, k + 3, k + 1),
                                      (step + k + 1, step + k + 3, step + k + 2, step + k),
                                      (k, step + k, step + k + 2, k + 2),
                                      (k + 3, step + k + 3, step + k + 1, k + 1)])
                    faces += [(0, 1, step + 1, step),
                              (step - 1, step - 2, 2 * step - 2, 2 * step - 1)]
                    # The approach on the opposite bank runs down in -Y.
                    part.solid(vertices, [tuple(reversed(f)) for f in faces] if sign > 0 else faces)
        for ay in [72, 84, 96, 108, 120, 132, 144]:
            y = sign * ay
            h = road_height(y) - .48
            for x in (-4.13, 4.13):
                walls.box((x, y, (h - 1.8) / 2), (1.48, 1.55, h + 1.8))
                moulding.box((x, y, h * .62), (1.64, 1.75, .25))
        # Last embankment closes the short transition from viaduct to grade.
        deck_strip(walls, 0, 11.36, *sorted([sign * 144, sign * 154]), -.50, 3.1)
    walls.finish()
    moulding.finish()


def octagonal_ring(cx, cy, radius, cut, z):
    outline = [(radius, radius - cut), (radius - cut, radius),
               (-radius + cut, radius), (-radius, radius - cut),
               (-radius, -radius + cut), (-radius + cut, -radius),
               (radius - cut, -radius), (radius, -radius + cut)]
    return [(cx + x, cy + y, z) for x, y in outline]


def build_towers():
    body = Part("Bridgehead elevator shafts", "stone")
    trim = Part("Lookout corbels and recessed window tracery", "plaster")
    glass = Part("Arched ironwork gallery windows", "shadow")
    roof = Part("Twin eaves on four bridgehead pavilions", "steel")
    finials = Part("Red pearl finials", "vermilion")
    for cy in (-82, 82):
        for cx in (-8.6, 8.6):
            # The long lift shaft opens into an overhanging observation gallery.
            loft(body, [octagonal_ring(cx, cy, r, cut, h) for h, r, cut in
                        [(-1.2, 2.78, .38), (.52, 2.78, .38), (.82, 2.53, .31),
                         (12.72, 2.53, .31), (13.16, 2.83, .36), (13.65, 2.89, .42)]])
            loft(trim, [octagonal_ring(cx, cy, r, .45, h) for h, r in
                        [(13.55, 2.85), (13.98, 3.24), (14.29, 3.24)]])
            body.box((cx, cy, 15.39), (4.66, 4.66, 2.34))
            for face in range(4):
                a = face * pi / 2
                def point(u, v, z):
                    return (cx + u * cos(a) - v * sin(a), cy + u * sin(a) + v * cos(a), z)

                # A single tall arch with a projecting balcony is the signature
                # of the stone face. Tracery sits clear of the dark glazing.
                width, bottom, spring = 1.28, 4.22, 11.76
                contour = [(-width / 2, bottom), (width / 2, bottom)]
                contour += [(width * .5 * cos(i * pi / 12), spring + width * .5 * sin(i * pi / 12))
                            for i in range(13)]
                glass.solid([point(u, 2.55, z) for u, z in contour],
                            [tuple(reversed(range(len(contour))))])
                for u in (-.27, .27):
                    trim.box(point(u, 2.58, 8.21), (.064, .07, 7.93), a)
                for row in range(1, 14):
                    trim.box(point(0, 2.58, bottom + row * .56), (1.20, .07, .065), a)
                for u in (-1.93, 1.93):
                    trim.box(point(u, 2.55, 7.26), (.20, .13, 10.75), a)
                    trim.box(point(u, 2.75, 13.34), (.40, .54, .70), a)
                trim.box(point(0, 2.72, 4.06), (1.79, .66, .26), a)
                trim.box(point(0, 2.60, 3.82), (1.27, .37, .26), a)
                glass.box(point(0, 2.35, 15.39), (2.57, .12, 1.42), a)
                for u in (-.74, 0, .74):
                    trim.box(point(u, 2.43, 15.39), (.13, .12, 1.47), a)
                trim.box(point(0, 2.43, 15.57), (2.58, .12, .12), a)
            for base, spread, peak in [(16.46, 3.24, 17.25), (18.12, 2.55, 19.32)]:
                cap = []
                for z, r, cut in [(base - .18, spread, .76), (base, spread, .76),
                                  (base + .19, spread * .68, .53), (peak, spread * .21, .15)]:
                    cap.append(octagonal_ring(cx, cy, r, cut, z))
                loft(roof, cap)
            body.box((cx, cy, 17.60), (3.04, 3.04, 1.05))
            trim.cylinder(cx, cy, 19.29, 19.56, .30, 12)
            bead = [[(cx + r * cos(i * pi / 6), cy + r * sin(i * pi / 6), z)
                     for i in range(12)] for z, r in [(19.54, .16), (19.65, .31),
                                                       (19.85, .35), (20.03, .25), (20.12, .06)]]
            loft(finials, bead)
    for part in (body, trim, glass, roof, finials):
        part.finish()


def build():
    build_piers()
    build_trusses_and_rail()
    build_road()
    build_approaches()
    build_towers()
