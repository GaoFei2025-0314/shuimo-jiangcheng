"""Yellow Crane Tower. Dimensions are in the map's exaggerated landmark units."""
from math import cos, hypot, sin, tau

from mesh import Part


def turn(x, y, side):
    return ((x, y), (-y, x), (-x, -y), (y, -x))[side]


# One quarter of the roof, beginning on the broad projecting central gallery.
# Two gallery corners and one diagonal wing per quarter give twelve tips per storey.
QUARTER = ((-.45, -1, 1), (.45, -1, 1), (.46, -.76, 0),
           (.83, -.83, .85), (.76, -.46, 0))
PERIMETER = [(*turn(x, y, side), lift)
             for side in range(4) for x, y, lift in QUARTER]


def perimeter(radius):
    return [(x * radius, y * radius) for x, y, _ in PERIMETER]


def clipped_square(radius, bevel):
    return [turn(x, -radius, side) for side in range(4)
            for x in (-radius + bevel, radius - bevel)]


def edges(points):
    return zip(points, points[1:] + points[:1])


def terrace():
    plinth = Part('Terrace - stone courses and stair flights', 'stone')
    coping = Part('Terrace - pale coping and pierced balustrade', 'plaster')
    for r, z0, z1 in ((11.9, -7, .15), (12.2, .15, .45), (11.6, .45, 1.55),
                      (11.8, 1.55, 1.85), (11.35, 1.85, 2.28)):
        plinth.prism(clipped_square(r, 1.4), z0, z1)
    coping.prism(clipped_square(11.55, 1.5), 2.28, 2.48)
    for side in range(4):
        # Two opposite staircases cut real openings in the balustrade.
        intervals = [(-9.9, -3.4), (3.4, 9.9)] if side % 2 == 0 else [(-9.9, 9.9)]
        if side % 2 == 0:
            for i in range(8):
                z = (i + 1) * .31
                p = turn(0, -15.20 + .51 * i, side)
                plinth.box((*p, z / 2), (6.4, .53, z))
            for x in (-3.33, 3.33):
                coping.beam((*turn(x, -15.4, side), .42),
                            (*turn(x, -11.4, side), 2.80), .34, .38)
        for lo, hi in intervals:
            bays = max(2, round((hi - lo) / 2.65))
            for i in range(bays + 1):
                u = lo + (hi - lo) * i / bays
                x, y = turn(u, -11.18, side)
                coping.box((x, y, 3.03), (.32, .32, 1.10))
                coping.box((x, y, 3.60), (.43, .43, .15))
                coping.cylinder(x, y, 3.68, 3.85, .17, 8)
                if i == bays:
                    continue
                v = lo + (hi - lo) * (i + 1) / bays
                for h, width in ((2.77, .22), (3.35, .19)):
                    coping.beam((x, y, h), (*turn(v, -11.18, side), h), width)
                coping.beam((*turn(u + (v-u)*.5, -11.18, side), 2.74),
                            (*turn(u + (v-u)*.5, -11.18, side), 3.35), .16)
        coping.beam((*turn(9.9, -11.18, side), 3.35),
                    (*turn(11.18, -9.9, side), 3.35), .19)
    plinth.finish()
    coping.finish()


def raised_tile(part, path, radius, height):
    """A continuous crested tile, open where it beds into the roof."""
    verts = []
    for i, point in enumerate(path):
        prev, nxt = path[max(0, i - 1)], path[min(len(path) - 1, i + 1)]
        dx, dy = nxt[0] - prev[0], nxt[1] - prev[1]
        length = hypot(dx, dy)
        if length < 1e-8:
            return
        nx, ny = -dy / length * radius, dx / length * radius
        x, y, z = point
        verts.extend(((x + nx, y + ny, z), (x, y, z + height), (x - nx, y - ny, z)))
    faces = [(j+k, j+k+1, j+k+4, j+k+3)
             for j in range(0, len(verts) - 3, 3) for k in range(2)]
    part.solid(verts, faces)


def roof(level, radius, neck, eave_z, height):
    tiles = Part(f'{level} - gold glazed roof and field tiles', 'roofGold')
    ridges = Part(f'{level} - rolled hips and sweeping eaves', 'bronze')
    soffit = Part(f'{level} - underside and eave fascia', 'timber')
    # Sample straight eave runs more closely across the wide gallery than in a valley.
    stations = []
    for i, (a, b) in enumerate(edges(PERIMETER)):
        count = (14, 4, 5, 5, 4)[i % 5]
        for j in range(count):
            t = j / count
            x, y = (a[k] + (b[k] - a[k]) * t for k in (0, 1))
            curl = a[2] * (1-t)**3.7 + b[2] * t**3.7
            stations.append((x, y, curl, j == 0 and a[2] > 0, j % 2 == 0))

    def point(station, v):
        x, y, curl = station[:3]
        # The upper ring returns to the wall while the outer four bays reach forward.
        r = radius + (neck - radius) * v
        wing = 1 + .043 * curl * (1-v)**2
        return (x * r * wing, y * r * wing,
                eave_z + height * v**1.65 + (1.18 if level == 1 else 1.38) * curl * (1-v)**2.8)

    n = len(stations)
    rows = (0, .15, .34, .56, .78, 1)
    top = [point(station, v) for v in rows for station in stations]
    faces = []
    for j in range(len(rows)-1):
        for i in range(n):
            a, b = j*n+i, j*n+(i+1)%n
            faces.extend(((a, b, b+n), (a, b+n, a+n)))
    # Close the neck under the balcony or crown. The ring is star-shaped about (0, 0).
    center = len(top)
    top.append((0, 0, eave_z + height))
    neck_start = (len(rows)-1)*n
    faces.extend((neck_start+i, neck_start+(i+1)%n, center) for i in range(n))
    tiles.solid(top, faces)
    # Matching triangles give the curved roof a constant vertical thickness, including its tips.
    lower = [(x, y, z-.20) for x, y, z in top]
    soffit.solid(lower, [face[::-1] for face in faces])
    soffit.solid(top[:n] + lower[:n],
                 [(i, i+n, (i+1)%n+n, (i+1)%n) for i in range(n)])
    raised_tile(ridges, top[:n] + [top[0]], .105, .09)
    for station in stations:
        x, y, curl, hip, field = station
        if hip:
            path = [point(station, v) for v in rows]
            raised_tile(ridges, path, .12, .15)
            # The lip rolls up and narrows towards a short ceramic finial.
            px, py, pz = path[0]
            length = hypot(x, y)
            dx, dy = x / length, y / length
            slices = ((-.20, .02, .16), (.04, .17, .15), (.20, .40, .095), (.20, .63, .025))
            verts = [(px + dx*d + cos(k*tau/6)*r, py + dy*d + sin(k*tau/6)*r, pz+h)
                     for d, h, r in slices for k in range(6)]
            quads = [(j*6+k, j*6+(k+1)%6, (j+1)*6+(k+1)%6, (j+1)*6+k)
                     for j in range(len(slices)-1) for k in range(6)]
            ridges.solid(verts, quads + [tuple(range(len(verts)-6, len(verts)))])
        elif field:
            path = [point(station, v) for v in rows[:-1]]
            # Stop the tile before the neck, following the final planar mesh edge.
            end = point(station, 1)
            path.append(tuple(a + .60*(b-a) for a, b in zip(path[-1], end)))
            raised_tile(tiles, path, .055, .055)
    tiles.finish()
    ridges.finish()
    soffit.finish()


def gallery(level, radius, floor, clear):
    deck = Part(f'{level} - balcony deck and sills', 'timber')
    columns = Part(f'{level} - vermilion columns and fretwork', 'vermilion')
    painted = Part(f'{level} - blue-green tie beams', 'glaze')
    interior = Part(f'{level} - recessed screens', 'shadow')
    brackets = Part(f'{level} - interlocking bracket sets', 'timber')
    panels = Part(f'{level} - ochre window transoms', 'plaster')
    deck.prism(perimeter(radius * 1.055), floor, floor + .29)
    interior.prism(clipped_square(radius * .64, radius * .16), floor + .28, floor + clear)
    top = floor + clear
    for side in range(4):
        def at(x, y, z):
            return (*turn(x, y, side), z)

        def box(part, x, y, z, w, d, h):
            part.box(at(x, y, z), (w, d, h), side*tau/4)

        # The openings sit behind a deep gallery, in contrast to its outer columns.
        for i in (-1, 0, 1):
            x = i * radius * .294
            w = radius * .25
            box(panels, x, -radius*.645, top-.74, w, .10, .36)
            box(columns, x - w*.55, -radius*.66, floor+clear*.5, .13, .14, clear-.60)
            box(columns, x, -radius*.66, top-.74, .07, .15, .4)
        box(painted, 0, -radius*.925, top-.27, radius*.92, .29, .29)
        box(deck, 0, -radius*.927, top-.05, radius*.99, .38, .15)

        # Outer square galleries and the four diagonal returns have their own columns.
        positions = [(-radius*.43, -radius*.92), (-radius*.15, -radius*.92),
                     (radius*.15, -radius*.92), (radius*.43, -radius*.92),
                     (radius*.73, -radius*.73)]
        for x, y in positions:
            cx, cy = turn(x, y, side)
            r = .19 if level == 1 else .155
            columns.cylinder(cx, cy, floor+.28, top-.18, r, 10)
            deck.cylinder(cx, cy, floor+.28, floor+.48, r*1.35, 10)
            box(brackets, x, y, top-.44, .52, .50, .24)
            box(painted, x, y, top-.26, .74, .42, .17)
            brackets.beam(at(x, y, top-.64), at(x, y-.63, top+.08), .21, .23)
            for sign in (-1, 1):
                brackets.beam(at(x, y, top-.43), at(x+sign*.43, y, top-.08), .16, .19)

        if level == 1:
            continue
        for (x0, y0, _), (x1, y1, _) in list(edges(PERIMETER))[5*side:5*side+5]:
            x0, y0, x1, y1 = (v * radius * 1.025 for v in (x0, y0, x1, y1))
            def rail(t, h):
                return (x0 + t*(x1-x0), y0 + t*(y1-y0), floor + h)
            bays = max(1, round(hypot(x1-x0, y1-y0) / 1.25))
            for h in (.46, .98):
                columns.beam(rail(0, h), rail(1, h), .11)
            for j in range(bays):
                a, b = j/bays, (j+1)/bays
                columns.beam(rail(a, .29), rail(a, 1.04), .13)
                if y0 == y1 or x0 == x1:
                    columns.beam(rail(a, .47), rail((a+b)/2, .89), .072)
                    columns.beam(rail((a+b)/2, .89), rail(b, .47), .072)
    for part in (deck, columns, painted, interior, brackets, panels):
        part.finish()


# Original stroke paths for the gold inscription, right to left as seen from the stair.
# These are outlined as meshes so the map and the .blend need no CJK font at runtime.
GLYPHS = {
    '黃': [
        [(1, 10), (11, 10)], [(4, 11.5), (4, 8.8)], [(8, 11.5), (8, 8.8)],
        [(2, 8), (10, 8)], [(2.6, 6.7), (2.6, 3)], [(2.6, 6.7), (9.6, 6.7), (9.2, 3), (2.6, 3)],
        [(6, 7.9), (6, 3)], [(3, 5), (9.2, 5)], [(4.3, 2.3), (1.4, .5)], [(7.3, 2.1), (10.7, .6)]],
    '鶴': [
        [(.5, 9.7), (.4, 8.2)], [(.6, 9.6), (5.8, 9.6), (5.2, 8.4)],
        [(3.5, 11.6), (2.6, 8.7), (.4, 5.4)], [(1.8, 7.3), (1.5, 1)],
        [(3.7, 8.2), (4.4, 7.4)], [(1.8, 7), (5.7, 7)], [(3.8, 6.9), (3.7, 2)],
        [(2, 5.4), (5.3, 5.4)], [(1.9, 3.8), (5.2, 3.8)], [(1.7, 2.1), (5.7, 2.1)],
        [(8.5, 11.5), (7.7, 10)], [(6.7, 9.9), (10.7, 9.9), (10.5, 6.8), (6.7, 6.8)],
        [(6.8, 10), (6.6, 3.6), (11.2, 3.6), (10.8, 1), (9.8, .7)],
        [(6.8, 8.4), (10.5, 8.4)], [(6.6, 5.2), (11.1, 5.2)],
        [(6.7, 2.8), (6, 1.5)], [(7.9, 2.8), (8.1, 1.5)], [(9.1, 2.8), (9.4, 1.7)]],
    '樓': [
        [(.4, 8), (4.5, 8)], [(2.7, 11.4), (2.5, .6)], [(2.5, 7.8), (.5, 3.8)],
        [(2.7, 6.9), (4.3, 5.3)], [(5.2, 10.2), (10.5, 10.2), (10.2, 8.1), (5.1, 8.1), (5.2, 10.2)],
        [(4.4, 7.3), (11.5, 7.3)], [(5.7, 6.6), (10.2, 6.6), (10.1, 5.1), (5.6, 5.1), (5.7, 6.6)],
        [(8, 11.6), (7.8, 5.1)], [(4.6, 3.7), (11.4, 3.7)], [(7.2, 4.8), (5.9, 2.6), (10.7, .6)],
        [(9.8, 3.9), (8.6, 2.1), (6.9, 1), (4.7, .5)]],
}


def plaque(radius, z):
    board = Part('Upper gallery - lacquer name board', 'ink')
    gold = Part('Upper gallery - gilded characters and moulding', 'bronze')
    y = -radius * .97
    board.box((0, y, z), (4.88, .23, 1.80))
    for h in (-.85, .85):
        gold.box((0, y-.14, z+h), (4.87, .09, .09))
    for x in (-2.39, 2.39):
        gold.box((x, y-.14, z), (.09, .09, 1.7))
    for i, char in enumerate('樓鶴黃'):
        for stroke in GLYPHS[char]:
            for (a, b), (c, d) in zip(stroke, stroke[1:]):
                x0, z0 = (i-1)*1.38+(a-6)*.104, z+(b-6)*.104
                x1, z1 = (i-1)*1.38+(c-6)*.104, z+(d-6)*.104
                dx, dz = x1-x0, z1-z0
                length = hypot(dx, dz)
                w = .040
                nx, nz = -dz*w/length, dx*w/length
                gold.solid([(x0-nx, y-.155, z0-nz), (x1-nx*.78, y-.155, z1-nz*.78),
                            (x1+nx*.78, y-.155, z1+nz*.78), (x0+nx, y-.155, z0+nz)], [(0, 1, 2, 3)])
    board.finish()
    gold.finish()


def spire(base):
    finial = Part('Crown - turned bronze gourd and spire', 'bronze')
    profile = ((.58, 0), (.65, .14), (.53, .29), (.34, .39), (.62, .62),
               (.71, .88), (.62, 1.17), (.32, 1.39), (.29, 1.55),
               (.44, 1.68), (.49, 1.89), (.33, 2.10), (.17, 2.19),
               (.15, 2.44), (.065, 2.63), (.026, 2.90))
    sides = 14
    verts = [(r*cos(k*tau/sides), r*sin(k*tau/sides), base+h)
             for r, h in profile for k in range(sides)]
    faces = [(j*sides+i, j*sides+(i+1)%sides,
              (j+1)*sides+(i+1)%sides, (j+1)*sides+i)
             for j in range(len(profile)-1) for i in range(sides)]
    finial.solid(verts, faces + [tuple(range(len(verts)-sides, len(verts)))])
    finial.finish()


def build():
    terrace()
    floors = (2.46, 8.80, 14.08, 19.34, 24.60)
    radii = (8.55, 6.63, 6.04, 5.54, 5.02)
    for i, (floor, radius) in enumerate(zip(floors, radii)):
        clear = 3.95 if i == 0 else 3.58
        gallery(i+1, radius, floor, clear)
        eave_z = floor + clear - .42
        neck = radii[i+1] * .91 if i+1 < len(radii) else .33
        rise = floors[i+1] - eave_z + .10 if i+1 < len(floors) else 5.30
        roof(i+1, radius*1.34, neck, eave_z, rise)
    plaque(radii[-1], floors[-1]+2.41)
    spire(floors[-1]+3.58-.42+5.30-.04)
