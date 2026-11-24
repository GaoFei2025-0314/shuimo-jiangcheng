"""Wuhan Yangtze River Bridge, drawn in the map's vertically exaggerated units."""

from math import cos, hypot, pi, sin, tau

import bpy

from mesh import Part


MAIN_END = 72
ROAD = 11.9
LOWER_CHORD = 5.15
UPPER_CHORD = 11.15
ROAD_STATIONS = (-154, -MAIN_END, MAIN_END, 154)
HANYANG_BEND_START = 83
HANYANG_BEND_RUN = 12
HANYANG_BEND_SLOPE = 1.24
MAP_LENGTH_RATIO = .81


def road_height(y):
    return ROAD - max(0, abs(y) - MAIN_END) * .127


def bend_hanyang(parts):
    """Ease the landward alignment around Guishan, outside the bridgehead pavilions."""
    for obj in parts:
        for v in obj.data.vertices:
            x, y, z = v.co
            d = -y - HANYANG_BEND_START
            if d <= 0:
                continue
            t = min(1, d / HANYANG_BEND_RUN)
            offset = HANYANG_BEND_SLOPE * (HANYANG_BEND_RUN * t**3 * (1 - .5*t)
                                           + max(0, d - HANYANG_BEND_RUN))
            slope = HANYANG_BEND_SLOPE * t*t * (3 - 2*t)
            length = hypot(MAP_LENGTH_RATIO, slope)
            v.co = (offset + x * MAP_LENGTH_RATIO / length,
                    y + x * slope / (MAP_LENGTH_RATIO * length), z)
        obj.data.update()


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
    granite = Part("Cutwater piers / dressed granite springing course", "stone")
    # Long upstream and downstream noses face across the deck.
    plan = [(-6.3, 0), (-5.65, -1.12), (-3.8, -1.66), (3.8, -1.66),
            (5.65, -1.12), (6.3, 0), (5.65, 1.12), (3.8, 1.66),
            (-3.8, 1.66), (-5.65, 1.12)]
    for y in range(-56, 57, 16):
        loft(piers, [[(x * scale, y + dy * scale, z) for x, dy in plan]
                     for z, scale in [(-3, 1.06), (.7, 1.06), (4.23, .89)]])
        piers.box((0, y, 4.37), (11.3, 3.34, .46))
        loft(granite, [[(x * scale, y + dy * scale, z) for x, dy in plan]
                       for z, scale in ((.68, 1.058), (.73, 1.082),
                                        (.90, 1.082), (.98, 1.052))])
    for y in (-MAIN_END, MAIN_END):
        piers.box((0, y, .76), (11.3, 3.25, 7.65))
    for y in range(-MAIN_END, MAIN_END + 1, 16):
        for side in (-1, 1):
            x = side * 4.18
            seats.box((x, y, 4.65), (1.20, 1.29, .24))
            seats.box((x, y, 4.83), (.86, .95, .22))
    piers.finish()
    seats.finish()
    granite.finish()


def side_plate(part, x, outline, depth):
    """Extrude a counterclockwise outline in the bridge's longitudinal elevation."""
    n = len(outline)
    vertices = [(xx, y, z) for xx in (x - depth / 2, x + depth / 2) for y, z in outline]
    faces = [tuple(reversed(range(n))), tuple(range(n, n * 2))]
    faces.extend((i, (i + 1) % n, (i + 1) % n + n, i + n) for i in range(n))
    part.solid(vertices, faces)


def build_trusses_and_rail():
    truss = Part("Three continuous steel truss units", "steel")
    plates = Part("Gussets and chord flanges", "shadow")
    railbed = Part("Lower railway bed and stringers", "deck")
    rails = Part("Two tracks and cross ties", "ink")
    deck_ribbon(railbed, 0, 8.56, (-107, 107), 0, .49, height=lambda _: 5.345)
    for track in (-2.02, 2.02):
        for offset in (-.72, .72):
            deck_ribbon(rails, track + offset, .15, (-107, 107), 0, .19, height=lambda _: 5.635)
        for y in range(-106, 107, 2):
            rails.box((track, y, 5.39), (2.24, .33, .14))
    # Each continuous unit covers three spans. Tiny joints separate the flanges.
    for start in (-72, -24, 24):
        for side in (-1, 1):
            x = side * 4.18
            for z in (LOWER_CHORD, UPPER_CHORD):
                truss.box((x, start + 24, z), (.55, 47.95, .52))
                plates.box((x, start + 24, z - .23), (.72, 47.93, .13))
                plates.box((x, start + 24, z + .24), (.66, 47.93, .09))
            for y in range(start, start + 48, 8):
                low_a = (x, y, LOWER_CHORD)
                high_a = (x, y, UPPER_CHORD)
                low_b = (x, y + 8, LOWER_CHORD)
                high_b = (x, y + 8, UPPER_CHORD)
                truss.beam(low_a, high_b, .40, .34)
                truss.beam(high_a, low_b, .31, .29)
                # Cover the lapped X joint with a distinct octagonal gusset and rivets.
                middle = (LOWER_CHORD + UPPER_CHORD) / 2
                side_plate(plates, x + side * .19,
                           [(y + 4 + .67*cos(i*tau/8), middle + .61*sin(i*tau/8))
                            for i in range(8)], .08)
                for dy in (-.25, .25):
                    for dz in (-.22, .22):
                        side_plate(truss, x + side * .235,
                                   [(y + 4 + dy + .06*cos(k*tau/6), middle + dz + .06*sin(k*tau/6))
                                    for k in range(6)], .035)
    for y in range(-72, 73, 8):
        for x in (-4.18, 4.18):
            truss.box((x, y, (LOWER_CHORD + UPPER_CHORD) / 2),
                      (.39, .34, UPPER_CHORD - LOWER_CHORD))
            for z in (LOWER_CHORD + .3, UPPER_CHORD - .3):
                plates.box((x, y, z), (.60, .93, .7))
            # Steel brackets carry the sidewalks outside the principal trusses.
            truss.beam((x, y, UPPER_CHORD - 1.01),
                       (x * 1.42, y, UPPER_CHORD + .44), .24)
        truss.box((0, y, LOWER_CHORD - .07), (8.76, .42, .42))
        truss.box((0, y, UPPER_CHORD + .15), (12.1, .42, .47))
        if y < MAIN_END:
            truss.beam((-4.1, y, LOWER_CHORD - .23),
                       (4.1, y + 8, LOWER_CHORD - .23), .17)
    for part in (truss, plates, railbed, rails):
        part.finish()


def deck_ribbon(part, x, width, stations, offset, thickness, height=road_height):
    """A closed strip with one cross-section at each change of slope."""
    lo, hi = min(stations), max(stations)
    # The long slabs need cross-sections in the curved interval before their vertices turn.
    bend = [-s for s in range(HANYANG_BEND_START, HANYANG_BEND_START + HANYANG_BEND_RUN + 1)
            if lo < -s < hi]
    stations = sorted({*stations, *bend})
    vertices = [(x + u*width/2, y, height(y) + offset + h)
                for y in stations for u, h in ((-1, -thickness), (1, -thickness), (1, 0), (-1, 0))]
    end = len(vertices) - 4
    faces = [(0, 1, 2, 3), (end+3, end+2, end+1, end)]
    for i in range(0, end, 4):
        for j in range(4):
            a, b = i+j, i+(j+1)%4
            faces.append((a, a+4, b+4, b))
    part.solid(vertices, faces)


def cast_profile(part, x, path, depth):
    """Join a rectangular casting through the bends in a railing motif."""
    rings = []
    for i, (y, z) in enumerate(path):
        earlier, later = path[max(0, i-1)], path[min(i+1, len(path)-1)]
        dy, dz = (b-a for a, b in zip(earlier, later))
        section = .034 / hypot(dy, dz)
        rings.append([(x+u*depth/2, y+v*dz*section, z-v*dy*section)
                      for u, v in ((-1, -1), (1, -1), (1, 1), (-1, 1))])
    loft(part, rings)


def build_road():
    paving = Part("Roadway and approach surfaces", "deck")
    walks = Part("Cantilevered walks, kerbs and markings", "plaster")
    railings = Part("Cast-iron parapets with lotus panels", "steel")
    standards = Part("Historic trident lamp standards", "shadow")
    lamps = Part("Paired porcelain globe lanterns", "plaster")
    deck_ribbon(paving, 0, 12.05, ROAD_STATIONS, 0, .51)
    deck_ribbon(walks, 0, .085, ROAD_STATIONS, .019, .025)
    for side in (-1, 1):
        deck_ribbon(walks, side*5.47, 1.14, ROAD_STATIONS, .18, .29)
        x = side * 5.90
        for lo, hi in ((-154, -85), (-79, 79), (85, 154)):
            stations = [lo, *(y for y in ROAD_STATIONS if lo < y < hi), hi]
            for h, size in ((.29, .093), (1.09, .12)):
                deck_ribbon(railings, x, size, stations, h, size)
            bays = round((hi-lo)/3.4)
            for i in range(bays + 1):
                y = lo + (hi-lo)*i/bays
                h = road_height(y)
                railings.box((x, y, h+.64), (.22, .21, .94))
                railings.box((x, y, h+1.09), (.28, .28, .13))
                if i == bays:
                    continue
                dy = (hi-lo)/bays
                for t in (.14, .27, .73, .86):
                    picket = y + dy*t
                    railings.box((x, picket, road_height(picket)+.665), (.07, .068, .79))
                # Flower panels on the main crossing give way to pickets on the approaches.
                yc = y + dy*.5
                if abs(yc) < MAIN_END:
                    for sign in (-1, 1):
                        points = [(yy, road_height(yy)+hh) for yy, hh in
                                  ((yc, .24), (yc+sign*.55, .65), (yc+sign*.34, .81),
                                   (yc, .64), (yc+sign*.19, .94), (yc, 1.03))]
                        cast_profile(railings, x, points, .061+sign*.005)
                else:
                    for t in (-.12, 0, .12):
                        yy = yc+dy*t
                        railings.box((x, yy, road_height(yy)+.665), (.069, .068, .79))
        for y in range(-152, 153, 4):
            stations = sorted({y-.71, y+.71, *(p for p in ROAD_STATIONS if abs(p-y) < .71)})
            deck_ribbon(walks, side*2.4, .080, stations, .021, .025)
        for y in range(-144, 145, 16):
            if abs(y) == 80:  # Keep the bridgehead passages clear.
                continue
            x = side * 5.65
            h = road_height(y)
            walks.cylinder(x, y, h+.15, h+.34, .27, 10)
            standards.cylinder(x, y, h+.31, h+.83, .16, 10)
            standards.cylinder(x, y, h+.80, h+3.49, .099, 10)
            standards.cylinder(x, y, h+3.32, h+3.64, .068, 10)
            for sign in (-1, 1):
                dy = sign * .55
                hook = [(x, y + dy*t, h + z) for t, z in
                        ((0, 2.96), (.44, 3.08), (.79, 3.33), (1, 3.50), (1, 3.34))]
                for a, b in zip(hook, hook[1:]):
                    standards.beam(a, b, .112)
                rings = [[(x+r*cos(i*tau/8), y+dy+r*sin(i*tau/8), h+z)
                          for i in range(8)] for z, r in
                         ((2.93, .075), (3.02, .186), (3.16, .216), (3.27, .165), (3.36, .09))]
                loft(lamps, rings)
    for part in (paving, walks, railings, standards, lamps):
        part.finish()


def build_approaches():
    walls = Part("Masonry arcade spandrels", "stone")
    moulding = Part("Arch rings and impost courses", "plaster")
    # Ring mouldings project from the spandrels; the rail viaduct passes through the arcade.
    for sign in (-1, 1):
        for start in range(72, 144, 12):
            for side in (-1, 1):
                xs = sorted([side * 3.60, side * 4.68])
                ring_xs = sorted([side * 4.62, side * 4.82])
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
                        ring[j].extend([(ring_xs[j], y, soffit - .065), (ring_xs[j], y, soffit + .27)])
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
        # The lower railway continues over stone on each shore before it reaches grade.
        deck_ribbon(walls, 0, 9.55, sorted((sign*72, sign*107)), 0, 1.04, height=lambda _: 4.90)
        walls.box((0, sign*106.6, 2.19), (11.4, 1.58, 5.35))
        for x in (-4.8, 4.8):
            deck_ribbon(moulding, x, .39, sorted((sign*72, sign*144)), -.45, .42)
        deck_ribbon(walls, 0, 11.36, sorted((sign*144, sign*154)), -.48, 3.1)
    walls.finish()
    moulding.finish()


def octagonal_ring(cx, cy, radius, cut, z):
    outline = [(radius, radius - cut), (radius - cut, radius),
               (-radius + cut, radius), (-radius, radius - cut),
               (-radius, -radius + cut), (-radius + cut, -radius),
               (radius - cut, -radius), (radius, -radius + cut)]
    return [(cx + x, cy + y, z) for x, y in outline]


def eave_ring(cx, cy, radius, cut, z, curl):
    corners = octagonal_ring(cx, cy, radius, cut, z)
    points = []
    for i, (x, y, _) in enumerate(corners):
        points.append((x, y, z+curl))
        if i % 2:
            xx, yy, _ = corners[(i+1) % len(corners)]
            points.append(((x+xx)/2, (y+yy)/2, z))
    return points


def build_towers():
    body = Part("Bridgehead elevator shafts", "stone")
    trim = Part("Lookout corbels, stone cornices and window surrounds", "plaster")
    glass = Part("Arched ironwork gallery windows", "shadow")
    tracery = Part("Copper casements and diamond tracery", "steel")
    roof = Part("Twin stone eaves on four bridgehead pavilions", "stone")
    finials = Part("Red pearl finials", "vermilion")
    for cy in (-82, 82):
        road_z = road_height(cy)
        for cx in (-8.6, 8.6):
            # The pavement enters the pavilion at the top of its masonry lift shaft.
            loft(body, [octagonal_ring(cx, cy, r, cut, h) for h, r, cut in
                        [(-1.2, 2.78, .38), (.52, 2.78, .38), (.82, 2.53, .31),
                         (road_z-.89, 2.53, .31), (road_z-.53, 2.86, .36), (road_z+.07, 2.89, .42)]])
            loft(trim, [octagonal_ring(cx, cy, r, .45, h) for h, r in
                        [(road_z-.13, 2.86), (road_z+.08, 3.20), (road_z+.22, 3.20)]])
            for dx in (-2.14, 2.14):
                for dy in (-2.14, 2.14):
                    body.box((cx+dx, cy+dy, road_z+1.75), (.68, .68, 3.24))
                    trim.box((cx+dx, cy+dy, road_z+3.30), (.89, .89, .27))
            body.box((cx, cy, road_z+3.58), (5.16, 5.16, .66))
            for face in range(4):
                a = face * pi / 2
                def point(u, v, z):
                    return (cx + u * cos(a) - v * sin(a), cy + u * sin(a) + v * cos(a), z)

                outward = face == (3 if cx > 0 else 1)
                if not outward:
                    for z in (2.49, 4.56, 6.63, 8.70):
                        glass.box(point(0, 2.55, z), (.84, .078, .94), a)
                        for u in (-.45, .45):
                            trim.box(point(u, 2.59, z), (.095, .121, 1.05), a)
                        tracery.box(point(0, 2.59, z), (.080, .101, .94), a)
                        trim.box(point(0, 2.59, z+.49), (.99, .13, .08), a)
                        trim.box(point(0, 2.61, z-.49), (1.02, .17, .10), a)
                    continue

                # The river-facing niche has a tall copper window and a lotus-shaped corbel.
                width, bottom, spring = 1.26, 3.76, road_z-1.74
                contour = [(-width / 2, bottom), (width / 2, bottom)]
                contour += [(width * .5 * cos(i * pi / 12), spring + width * .5 * sin(i * pi / 12))
                            for i in range(13)]
                n = len(contour)
                pane = [point(u, v, z) for v in (2.51, 2.56) for u, z in contour]
                panel_faces = [tuple(range(n)), tuple(reversed(range(n, n*2)))]
                panel_faces.extend((i, i+n, (i+1)%n+n, (i+1)%n) for i in range(n))
                glass.solid(pane, panel_faces)
                for i, (u, z) in enumerate(contour):
                    uu, zz = contour[(i+1)%n]
                    trim.beam(point(u, 2.58, z), point(uu, 2.58, zz), .10, .11)
                for row in range(10):
                    z = bottom + row*(spring-bottom)/10
                    for u in (-.39, 0, .39):
                        tracery.beam(point(u-.18, 2.58, z+.25), point(u, 2.58, z+.49), .051)
                        tracery.beam(point(u, 2.58, z+.49), point(u+.18, 2.58, z+.25), .051)
                        tracery.beam(point(u+.18, 2.58, z+.25), point(u, 2.58, z+.01), .051)
                        tracery.beam(point(u, 2.58, z+.01), point(u-.18, 2.58, z+.25), .051)
                trim.box(point(0, 2.76, bottom-.08), (1.94, .71, .22), a)
                trim.box(point(0, 2.60, bottom-.30), (1.49, .46, .26), a)
                for u in (-.66, 0, .66):
                    trim.beam(point(u, 2.52, bottom-.56), point(u, 3.01, bottom-.16), .23, .22)
                    trim.beam(point(u, 2.46, road_z-.99), point(u, 2.91, road_z-.55), .30, .25)
                for u in (-.84, -.42, 0, .42, .84):
                    trim.box(point(u, 3.05, bottom+.11), (.08, .10, .22), a)
                trim.box(point(0, 3.05, bottom+.24), (1.85, .16, .10), a)
                for u in (-2.39, -1.6, -.8, 0, .8, 1.6, 2.39):
                    trim.box(point(u, 3.10, road_z+.52), (.094, .105, .65), a)
                for z in (road_z+.30, road_z+.84):
                    trim.box(point(0, 3.10, z), (4.88, .15, .08), a)

            for base, spread, peak in ((road_z+3.91, 3.19, road_z+4.65),
                                       (road_z+5.29, 2.58, road_z+6.85)):
                loft(roof, [eave_ring(cx, cy, r, cut, z, curl) for z, r, cut, curl in
                            ((base-.16, spread, .74, .15), (base, spread, .74, .18),
                             (base+(peak-base)*.14, spread*.72, .52, .11),
                             (base+(peak-base)*.51, spread*.40, .28, .043),
                             (peak, spread*.19, .15, 0))])
                loft(trim, [eave_ring(cx, cy, r, .74, z, .15) for z, r in
                            ((base-.17, spread-.04), (base-.11, spread+.04))])
            body.box((cx, cy, road_z+4.94), (3.19, 3.19, .81))
            top = road_z+6.83
            trim.cylinder(cx, cy, top-.05, top+.24, .31, 12)
            bead = [[(cx + r * cos(i * pi / 6), cy + r * sin(i * pi / 6), z)
                     for i in range(12)] for z, r in ((top+.21, .15), (top+.32, .28),
                                                       (top+.52, .34), (top+.70, .24), (top+.78, .06))]
            loft(finials, bead)
    for part in (body, trim, glass, tracery, roof, finials):
        part.finish()


def build():
    original = set(bpy.context.scene.objects)
    build_piers()
    build_trusses_and_rail()
    build_road()
    build_approaches()
    bend_hanyang(set(bpy.context.scene.objects) - original)
    build_towers()
