"""Six civic landmarks, in local map units. The principal facade faces Blender -Y."""
from math import cos, hypot, pi, sin, tau

from mesh import Part


def _point(x, y, angle, u, v, z):
    return (x + cos(angle) * u - sin(angle) * v,
            y + sin(angle) * u + cos(angle) * v, z)


def _edges(items):
    return zip(items, items[1:] + items[:1])


def _loft(part, rings):
    """Join counterclockwise cross-sections with a bottom and a top."""
    n = len(rings[0])
    last = n * (len(rings) - 1)
    faces = [tuple(reversed(range(n))), tuple(range(last, last + n))]
    for start in range(0, last, n):
        for i in range(n):
            a, b = start + i, start + (i + 1) % n
            faces.append((a, b, b + n, a + n))
    part.solid([point for ring in rings for point in ring], faces)


def _round(part, profile, sides=24, x=0, y=0, angle=0):
    _loft(part, [[(x + r * cos(angle + i * tau / sides),
                   y + r * sin(angle + i * tau / sides), z)
                  for i in range(sides)] for z, r in profile])


def _course(part, profile, x=0, y=0):
    _loft(part, [[(x + sx * w / 2, y + sy * d / 2, z)
                  for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
                 for z, w, d in profile])


def _section(part, x, y, angle, profile, front, back):
    """Extrude a counterclockwise profile in the local X/Z facade plane."""
    n = len(profile)
    vertices = [_point(x, y, angle, u, v, z) for v in (front, back) for u, z in profile]
    faces = [tuple(range(n)), tuple(reversed(range(n, 2 * n)))]
    faces.extend((j, i, i + n, j + n) for i, j in _edges(list(range(n))))
    part.solid(vertices, faces)


def _finish(*parts):
    for part in parts:
        part.finish()


def _stairs(part, x, y, width, rise, run, steps, base=0):
    # The section starts at the lowest outer tread and travels up into the landing.
    profile = [(-run, base), (.20, base), (.20, base + rise)]
    for step in reversed(range(steps)):
        u = -run + run * step / steps
        profile.append((u, base + rise * (step + 1) / steps))
        if step:
            profile.append((u, base + rise * step / steps))
    _section(part, x, y, pi / 2, profile, -width / 2, width / 2)


def _opening(center, width, sill, spring, arch=0):
    return (center, width, sill, spring, arch)


def _head(opening, slices=4):
    center, width, _, spring, arch = opening
    if not arch:
        return [(center - width / 2, spring), (center + width / 2, spring)]
    return [(center - width / 2 * cos(i * pi / slices), spring + arch * sin(i * pi / slices))
            for i in range(slices + 1)]


def _wall(part, facade, width, z0, z1, depth, openings):
    """Skin both sides, then join the perimeter and the complete opening reveals."""
    panels = []
    cursor, levels = -width / 2, []
    for opening in sorted(openings):
        _, _, sill, _, _ = opening
        head = _head(opening)
        left, high_left = head[0]
        panels.append([(cursor, z0), (left, z0), (left, sill), (left, high_left),
                       (left, z1), (cursor, z1), *((cursor, z) for z in reversed(levels))])
        right, high_right = head[-1]
        panels.append([(left, z0), (right, z0), (right, sill), (left, sill)])
        panels.append([*head, (right, z1), (left, z1)])
        cursor = right
        levels = [sill, high_right]
    panels.append([(cursor, z0), (width / 2, z0), (width / 2, z1), (cursor, z1),
                   *((cursor, z) for z in reversed(levels))])
    vertices = {}
    faces = []
    boundary = set()

    def index(uv, offset):
        return vertices.setdefault((*uv, offset), len(vertices))

    for panel in panels:
        front = tuple(index(uv, 0) for uv in panel)
        back = tuple(index(uv, depth) for uv in panel)
        faces.extend((front, tuple(reversed(back))))
        for a, b in _edges(panel):
            if (b, a) in boundary:
                boundary.remove((b, a))
            else:
                boundary.add((a, b))
    for a, b in sorted(boundary):
        faces.append((index(b, 0), index(a, 0), index(a, depth), index(b, depth)))
    part.solid([_point(*facade, u, v, z) for u, z, v in vertices], faces)


def _infill(panes, frames, facade, opening, setback=.24, sill_trim=True, mullion=True):
    center, width, sill, spring, arch = opening
    angle = facade[2]
    # Place glass into the reveal, beyond the wall face and behind the sash.
    height = spring + arch - sill
    panes.box(_point(*facade, center, setback + .0325, sill + height / 2),
              (width + .045, .065, height + .045), angle)
    if sill_trim:
        frames.box(_point(*facade, center, .035, sill - .085),
                   (width + .30, .35, .16), angle)
    if mullion:
        frames.box(_point(*facade, center, setback - .065, (sill + spring + arch) / 2),
                   (.075, .10, spring + arch - sill), angle)
        if spring - sill > .7:
            frames.box(_point(*facade, center, setback - .045, sill + (spring - sill) * .60),
                       (width + .03, .095, .075), angle)


def _arch_trim(part, facade, opening, thick, segments=7, front=-.15, back=.04):
    center, width, sill, spring, rise = opening
    r = width / 2
    for i in range(segments):
        a, b = pi * i / segments + .018, pi * (i + 1) / segments - .018
        profile = [(center + rx * cos(t), spring + rz * sin(t))
                   for rx, rz, t in ((r, rise, b), (r, rise, a),
                                     (r + thick, rise + thick, a), (r + thick, rise + thick, b))]
        _section(part, *facade, profile, front, back)
    for sign in (-1, 1):
        part.box(_point(*facade, center + sign * (r + thick / 2), (front + back) / 2,
                        (sill + spring) / 2), (thick, back - front, spring - sill), facade[2])


def _sides(x, y, width, depth, corner=.025):
    return (((x, y - depth / 2, 0), width),
            ((x + width / 2, y, pi / 2), depth - corner),
            ((x, y + depth / 2, pi), width),
            ((x - width / 2, y, -pi / 2), depth - corner))


def _hip(roof, seams, x, y, w, d, z, height, neck_w, neck_d, lift, tile_pitch):
    """Closed swept hip roof. Follow its section with standing laps and closed hip rolls."""
    corners = ((-1, -1), (1, -1), (1, 1), (-1, 1))
    rows = (0, .18, .41, .67, 1)
    count_x = max(4, round(w / tile_pitch))
    count_y = max(4, round(d / tile_pitch))
    count = (count_x, count_y, count_x, count_y)

    def sample(edge, t, v):
        a, b = corners[edge], corners[(edge + 1) % 4]
        u, p = (a[k] + (b[k] - a[k]) * t for k in range(2))
        curl = lift * abs(2 * t - 1) ** 3 * (1-v) ** 2
        return (x + u * (w + (neck_w - w) * v) / 2,
                y + p * (d + (neck_d - d) * v) / 2,
                z + height * v ** 1.30 + curl)

    stations = 6 if lift > .12 else 1
    rings = [[sample(edge, i / stations, v)
              for edge in range(4) for i in range(stations)] for v in rows]
    n = len(rings[0])
    top = [p for ring in rings for p in ring]
    thickness = .19 if w < 15 else .27
    vertices = top + [(a, b, c - thickness) for a, b, c in top]
    offset = len(top)
    faces = []
    for start in range(0, offset - n, n):
        for i in range(n):
            a, b = start + i, start + (i + 1) % n
            face = (a, b, b + n, a + n)
            faces.append(face)
            faces.append(tuple(offset + j for j in reversed(face)))
    last = tuple(range(offset - n, offset))
    faces.extend((last, tuple(j + offset for j in reversed(last))))
    faces.extend((b, a, a + offset, b + offset) for a, b in _edges(list(range(n))))
    roof.solid(vertices, faces)

    def raised(path, width):
        dx, dy = (path[-1][k] - path[0][k] for k in range(2))
        length = hypot(dx, dy)
        u, v = dy * width / length / 2, -dx * width / length / 2
        _loft(seams, [[(a + u, b + v, z - .020), (a - u, b - v, z - .020),
                       (a, b, z + width * .49)] for a, b, z in path])

    for edge in range(4):
        raised([sample(edge, 0, v) for v in rows], .15 if w > 15 else .10)
        for i in range(1, count[edge]):
            raised([sample(edge, i / count[edge], v) for v in rows],
                   .072 if w > 15 else .051)
    if neck_w > 1.5:
        seams.beam((x - neck_w / 2 - .12, y, z + height + .08),
                   (x + neck_w / 2 + .12, y, z + height + .08), .20, .23)


def _disc(part, facade, u, z, radius, front, back, sides=24):
    profile = [(u + radius * cos(i * tau / sides), z + radius * sin(i * tau / sides))
               for i in range(sides)]
    _section(part, *facade, profile, front, back)


def tv():
    """Concrete shaft, glazed revolving pavilion, two viewing decks and aerial."""
    plinth = Part('Guishan / embedded footing and stepped service podium', 'stone')
    service = Part('Guishan / service pavilion walls and entry stair', 'plaster')
    portals = Part('Guishan / recessed podium glazing', 'shadow')
    doors = Part('Guishan / podium door frames and coping', 'steel')
    shaft = Part('Guishan / tapered concrete shaft', 'plaster')
    bands = Part('Guishan / shaft casting bands and service galleries', 'deck')
    pod = Part('Guishan / revolving restaurant structural shell', 'plaster')
    glass = Part('Guishan / panoramic restaurant and upper observation glazing', 'steel')
    mullions = Part('Guishan / steel glazing mullions and soffit fins', 'stone')
    walks = Part('Guishan / ring decks, balusters and safety rails', 'ink')
    mast = Part('Guishan / antenna mast and radio equipment', 'steel')
    aerial = Part('Guishan / aerial signal frame and rust-red collars', 'vermilion')

    _course(plinth, [(-14, 18, 18), (-.05, 18, 18), (.12, 19.8, 19.8),
                     (.74, 19.8, 19.8), (.92, 19.1, 19.1)])
    _stairs(service, 0, -7.6, 5.2, .90, 2.18, 5)
    _course(service, [(3.45, 16.8, 14.6), (3.75, 16.8, 14.6), (3.98, 15.6, 13.7),
                      (4.22, 14.0, 12.7)])
    for face, w in _sides(0, 0, 16, 14.1):
        for x, width in ((-4.8, 2.5), (0, 3.05), (4.8, 2.5)):
            opening = _opening(x, width, 1.12, 3.0)
            _infill(portals, doors, face, opening, .33)
        _wall(service, face, w, .87, 3.49, .62,
              [_opening(x, width, 1.12, 3.0) for x, width in ((-4.8, 2.5), (0, 3.05), (4.8, 2.5))])

    _round(shaft, [(0, 7.2), (4.0, 5.6), (7.8, 4.43), (12, 3.78),
                   (20, 3.27), (35, 2.99), (44.8, 2.86), (57, 2.77),
                   (65, 2.66), (73.7, 2.50), (76.0, 2.45)], 32)
    for z, r in ((6.2, 4.99), (12.0, 3.80), (20.0, 3.29), (31.5, 3.08),
                 (42.8, 2.93), (58.25, 2.92), (65.7, 2.94), (73.25, 2.83)):
        _round(bands, [(z - .07, r - .08), (z, r + .015), (z + .10, r + .015)], 24)
    _round(pod, [(43.8, 3.12), (44.45, 4.28), (45.3, 6.45), (46.4, 7.75),
                 (47.02, 8.30), (47.57, 8.46), (48.02, 8.46)], 36)
    for z, r, height in ((47.96, 8.39, 1.02), (50.05, 8.39, 1.03), (52.16, 8.10, 1.03),
                         (54.05, 5.67, 1.38)):
        _round(glass, [(z, r), (z + height, r - .05)], 36)
        for i in range(36 if r > 8 else 24):
            a = (i + .5) * tau / (36 if r > 8 else 24)
            rr = r - .001
            mullions.box((rr * cos(a), rr * sin(a), z + height / 2), (.18, .07, height + .09), a)
    for z, r0, r1, h in ((48.94, 8.48, 8.51, 1.15), (51.04, 8.48, 8.36, 1.15),
                          (53.14, 8.24, 7.56, .92), (55.38, 5.85, 4.54, .67),
                          (56.70, 4.65, 3.04, .68)):
        _round(pod, [(z, r0 - .10), (z + .21, r0), (z + h, r1)], 36)
    for i in range(24):
        a = i * tau / 24
        mullions.beam((3.96 * cos(a), 3.96 * sin(a), 44.47),
                      (7.0 * cos(a), 7.0 * sin(a), 45.97), .19, .25)

    for z, r, posts in ((53.88, 7.35, 36), (55.95, 4.80, 24), (65.60, 2.86, 16)):
        rail = [(r * cos(i * tau / posts), r * sin(i * tau / posts)) for i in range(posts)]
        for (x, y), (nx, ny) in _edges(rail):
            walks.box((x, y, z + .34), (.085, .085, .69))
            walks.beam((x, y, z + .66), (nx, ny, z + .66), .078)
    _round(mast, [(75.2, 1.33), (78, 1.15), (84.45, .84), (90.75, .55), (97.9, .18)], 16)
    for z, r in ((76.6, 1.67), (81.7, 1.39), (86.9, 1.13), (92.0, .80)):
        _round(aerial, [(z - .11, r - .12), (z, r), (z + .13, r)], 16)
    for i in range(4):
        a = pi * i / 2
        c, s = cos(a), sin(a)
        for z, r in ((70.0, 2.7), (76.5, 1.57), (82.0, 1.26), (87.0, 1.0)):
            aerial.beam((c * (r - .10), s * (r - .10), z - 4.65),
                        (c * r, s * r, z + .03), .12)
        for z, r in ((88.4, .91), (91.3, .74), (94.0, .56)):
            mast.beam((0, 0, z), (c * r, s * r, z), .085)
    _finish(plinth, service, portals, doors, shaft, bands, pod, glass, mullions, walks, mast, aerial)


def customs():
    """Granite customs house with giant Corinthian order and a four-dial clock."""
    base = Part('Customs / granite plinth and cascading entrance steps', 'stone')
    walls = Part('Customs / four-storey ashlar shell and square clock shaft', 'plaster')
    entablature = Part('Customs / entablatures, parapets and datums', 'stone')
    glazing = Part('Customs / recessed glazing, doorways and tower vents', 'shadow')
    sashes = Part('Customs / window stools, sashes and entrance surrounds', 'timber')
    columns = Part('Customs / Corinthian colonnades and bell-stage pilasters', 'plaster')
    carving = Part('Customs / capitals, cornice dentils and ashlar quoins', 'stone')
    clock_rim = Part('Customs / four clock escutcheons and moulded frames', 'bronze')
    clock_faces = Part('Customs / enamel clock faces', 'plaster')
    hands = Part('Customs / hour marks and hands', 'ink')
    crown = Part('Customs / belfry cover and flag mast', 'steel')

    _course(base, [(0, 32.8, 18.4), (.26, 32.8, 18.4), (.46, 32.2, 17.8),
                    (1.18, 31.4, 17.1)])
    _stairs(base, 0, -8.35, 10.0, 1.19, 2.06, 6)
    _course(entablature, [(16.32, 30.4, 14.7), (16.67, 30.5, 14.8),
                           (16.76, 31.2, 15.5), (17.26, 31.2, 15.5),
                           (17.47, 32.12, 16.35), (17.89, 32.12, 16.35),
                           (18.12, 31.8, 16.02)])
    _course(entablature, [(18.10, 29.4, 13.8), (18.32, 29.4, 13.8),
                           (18.49, 29.85, 14.3)])
    for face, w in _sides(0, 0, 29.8, 14.0):
        x0, y0, a = face
        front = a == 0
        side = abs(a) == pi / 2
        centers = [-10.55, -7.05, -3.55, 0, 3.55, 7.05, 10.55] if not side else [-4.65, -1.55, 1.55, 4.65]
        z = 1.12
        for floor, top in enumerate((4.72, 8.45, 12.33, 16.44)):
            openings = []
            for u in centers:
                if front and u == 0 and floor == 0:
                    op = _opening(u, 2.45, 1.30, 3.20, 1.03)
                    _arch_trim(carving, (0, -7.02, 0), op, .25, 9, front=-.18)
                else:
                    op = _opening(u, 1.22 if floor else 1.40, z + .68,
                                  top - (.72 if floor else 1.08), .28 if floor == 0 else 0)
                    if floor in (1, 2, 3):
                        sashes.box(_point(*face, u, -.068, op[3] + .13),
                                   (1.56, .20, .19), a)
                openings.append(op)
                _infill(glazing, sashes, face, op, .37, not (front and u == 0 and floor == 0))
            _wall(walls, face, w, z, top, .58, openings)
            z = top
        for u in (-(w / 2 - .31), w / 2 - .31):
            for j in range(12):
                carving.box(_point(*face, u, -.055, 1.62 + j * 1.21),
                            (.63 + .15 * (j % 2), .25, 1.06), a)

        # The riverside frontage has eight freestanding shafts. The returns use wall pilasters.
        positions = [3.51 * (j - 3.5) for j in range(8)] if front else (
            [-5.95, -3.12, 0, 3.12, 5.95] if side else [])
        for u in positions:
            px, py, _ = _point(*face, u, -1.25 if front else -.04, 0)
            columns.box((px, py, 3.15), (.93, .93, 2.33), a)
            _round(columns, [(4.30, .48), (4.50, .55), (4.61, .48),
                             (4.74, .43), (14.50, .35), (14.61, .40)],
                   12, px, py)
            _round(carving, [(14.57, .39), (14.86, .45), (15.22, .56),
                             (15.32, .48), (15.46, .56)], 10, px, py)
            carving.box((px, py, 15.55), (1.20, 1.20, .22), a)
            for j in range(5):
                t = a + j * tau / 5
                carving.beam((px + .37 * cos(t), py + .37 * sin(t), 14.78),
                             (px + .54 * cos(t), py + .54 * sin(t), 15.31), .115)

        for j in range(round(w / 1.0) - 1):
            u = j - (round(w / 1.0) - 2) / 2
            carving.box(_point(x0, y0, a, u, -.51, 17.42), (.33, .32, .29), a)
        for z in (4.67, 12.32):
            entablature.box(_point(*face, 0, .035, z), (w - .08, .31, .24), a)
        parapet = (x0 * 1.032, y0 * 1.073, a)
        entablature.box(_point(*parapet, 0, .03, 18.50), (w - .12, .48, .65), a)
        entablature.box(_point(*parapet, 0, .03, 18.85), (w - .16, .62, .13), a)

    shaft_x = -.15
    _course(entablature, [(18.30, 8.62, 8.62), (18.60, 8.75, 8.75),
                           (19.07, 8.47, 8.47), (19.42, 7.75, 7.75)], shaft_x)
    for face, w in _sides(shaft_x, 0, 7.2, 7.2):
        lower = [_opening(0, .88, 20.02, 22.10, .38)]
        _wall(walls, face, w, 19.36, 23.88, .65, lower)
        for op in lower:
            _infill(glazing, sashes, face, op, .35)
        _wall(walls, face, w, 23.88, 28.55, .65, [])
        for u in (-3.02, 3.02):
            columns.box(_point(*face, u, -.075, 23.84), (.79, .34, 8.75), face[2])
        for z in (19.80, 23.68, 28.52):
            entablature.box(_point(*face, 0, -.10, z), (w - .05, .47, .30), face[2])
        _disc(clock_rim, face, 0, 26.01, 1.85, -.32, .06)
        _disc(hands, face, 0, 26.01, 1.69, -.38, -.30)
        _disc(clock_faces, face, 0, 26.01, 1.57, -.44, -.36)
        for i in range(12):
            a = i * tau / 12
            start = _point(*face, 1.23 * cos(a), -.485, 26.01 + 1.23 * sin(a))
            end = _point(*face, 1.44 * cos(a), -.485, 26.01 + 1.44 * sin(a))
            hands.beam(start, end, .08 if i % 3 == 0 else .053, .079)
        center = _point(*face, 0, -.52, 26.01)
        hands.beam(center, _point(*face, .47, -.52, 26.84), .115)
        hands.beam(center, _point(*face, -.98, -.52, 26.41), .083)
        _disc(hands, face, 0, 26.01, .14, -.61, -.43, 10)
    _course(entablature, [(28.37, 7.7, 7.7), (28.64, 8.35, 8.35),
                           (29.12, 8.35, 8.35), (29.37, 7.22, 7.22), (29.68, 6.66, 6.66)], shaft_x)
    for face, w in _sides(shaft_x, 0, 5.60, 5.60):
        arched = [_opening(u, 1.32, 29.89, 33.02, .67) for u in (-1.16, 1.16)]
        _wall(walls, face, w, 29.62, 34.33, .56, arched)
        for op in arched:
            _arch_trim(carving, face, op, .16, 5, -.13)
        for u in (-2.44, 0, 2.44):
            px, py, _ = _point(*face, u, -.23, 0)
            _round(columns, [(29.61, .35), (30.1, .29), (33.25, .24),
                             (33.68, .35), (34.19, .39)], 10, px, py)
    _course(entablature, [(34.22, 6.38, 6.38), (34.44, 6.98, 6.98),
                           (34.75, 6.98, 6.98), (34.93, 6.50, 6.50)], shaft_x)
    _course(crown, [(34.87, 6.46, 6.46), (35.09, 6.58, 6.58), (35.57, 4.20, 4.20),
                     (35.95, 2.15, 2.15)], shaft_x)
    _round(crown, [(35.92, 1.09), (36.11, 1.09), (36.27, .88)], 12, shaft_x)
    crown.cylinder(shaft_x, 0, 36.11, 42.27, .066, 8)
    _finish(base, walls, entablature, glazing, sashes, columns, carving,
            clock_rim, clock_faces, hands, crown)


def watertower():
    """Octagonal waterworks tower, brick pilasters and raised stair/bell turret."""
    base = Part('Water tower / granite plinth and stepped west approach', 'stone')
    brick = Part('Water tower / octagonal brick shell and stair turret', 'vermilion')
    trim = Part('Water tower / brick stringcourses and toothed cornices', 'timber')
    glass = Part('Water tower / recessed iron sash windows', 'shadow')
    surrounds = Part('Water tower / segmental hoods, sills and rustication', 'plaster')
    sash = Part('Water tower / window sash and hinge rails', 'steel')
    crenels = Part('Water tower / brick crown, merlons and turret parapet', 'vermilion')
    cap = Part('Water tower / inset roof and discreet alarm mast', 'ink')

    _course(base, [(-6, 15.9, 15.9), (-.10, 15.9, 15.9), (.08, 15.7, 15.7)])
    _round(base, [(-.02, 6.4), (.34, 6.4), (.48, 6.12), (.98, 6.04),
                  (1.08, 5.82), (1.39, 5.82)], 8, angle=pi / 8)
    _stairs(base, -2.8, -5.15, 2.25, 1.05, 1.9, 5)
    # The water tank occupies the tall top storey behind the old fire-watch parapet.
    floors = (1.35, 4.75, 8.38, 12.09, 15.81, 19.48, 23.53, 25.55)
    apothem = 5.38 * cos(pi / 8)
    width = 2 * apothem * sin(pi / 8) / cos(pi / 8)
    for side in range(8):
        angle = side * pi / 4
        face = (apothem * sin(angle), -apothem * cos(angle), angle)
        for floor, (z0, z1) in enumerate(zip(floors, floors[1:])):
            if floor == 6:
                _wall(brick, face, width + .027, z0, z1, .55, [])
                continue
            openings = [_opening(u, .90, z0 + .72, z1 - .92, .21)
                        for u in (-.87, .87)]
            if floor == 0 and side == 7:
                openings = [_opening(0, 1.6, z0 + .17, z1 - .78, .36)]
            _wall(brick, face, width + .027, z0, z1, .61, openings)
            for opening in openings:
                _infill(glass, sash, face, opening, .33, mullion=side in (0, 1, 7))
                u, w, _, spring, arch = opening
                surrounds.box(_point(*face, u, -.062, spring + arch + .07),
                              (w + .16, .20, .16), angle)
        for u in (-1.63, 1.63):
            brick.box(_point(*face, u, -.09, 13.19), (.22, .25, 23.65), angle)
            for z in (4.78, 12.11, 19.49, 23.51):
                trim.box(_point(*face, u, -.13, z), (.35, .30, .35), angle)
        for z in (23.46, 24.91):
            for j in range(7):
                u = (j - 3) * .50
                trim.box(_point(*face, u, -.22, z), (.155, .27, .25), angle)
        for u in (-1.32, 0, 1.32):
            crenels.box(_point(*face, u, -.02, 25.80), (.58, .47, .56), angle)
            surrounds.box(_point(*face, u, -.025, 26.10), (.64, .52, .11), angle)
    for z in (4.75, 8.38, 12.09, 15.81, 19.48, 23.53, 25.45):
        _round(trim, [(z - .19, 5.41), (z - .07, 5.56),
                      (z + .08, 5.56), (z + .16, 5.45)], 8, angle=pi / 8)
    _round(cap, [(24.91, 4.96), (25.09, 4.96)], 8, angle=pi / 8)
    tx, ty = -3.45, -3.53
    _course(trim, [(1.17, 3.38, 3.35), (1.38, 3.45, 3.43),
                   (1.65, 3.26, 3.22)], tx, ty)
    for face, w in _sides(tx, ty, 3.07, 3.18):
        for floor in range(8):
            z0 = 1.51 + floor * 3.53
            opening = _opening(0, .74, z0 + .85, z0 + 2.49, .18)
            if floor == 3:
                # The round stairwell light separates the turret from the paired tank bays.
                _wall(brick, face, w, z0, z0 + 3.53, .48, [])
                _disc(surrounds, face, 0, z0 + 1.66, .55, -.19, .023, 16)
                _disc(glass, face, 0, z0 + 1.66, .39, -.21, -.15, 16)
            else:
                _wall(brick, face, w, z0, z0 + 3.53, .48, [opening])
                _infill(glass, sash, face, opening, .26, mullion=face[2] in (0, -pi / 2))
                trim.box(_point(*face, 0, -.062, opening[3] + opening[4] + .08),
                         (1.01, .23, .19), face[2])
        for u in (-1.03, 0, 1.03):
            crenels.box(_point(*face, u, -.023, 29.96), (.52, .43, .54), face[2])
    _course(trim, [(28.79, 3.30, 3.40), (29.05, 3.60, 3.70),
                   (29.34, 3.62, 3.71), (29.47, 3.29, 3.36)], tx, ty)
    cap.box((tx, ty, 29.32), (2.91, 3.03, .34))
    cap.cylinder(tx, ty, 29.46, 31.64, .071, 8)
    _finish(base, brick, trim, glass, surrounds, sash, crenels, cap)


def wuda():
    """Four brick dormitory ranges and three hill stairways under glazed pavilions."""
    terrace = Part('Wuhan University / retaining platform and open roof walks', 'stone')
    brick = Part('Wuhan University / gray-brick dormitories and Roman arch passages', 'cityWall')
    bands = Part('Wuhan University / stone grid, ashlar arch rings and ridge finials', 'plaster')
    stairs = Part('Wuhan University / stone approach and interior hillside flights', 'stone')
    glazing = Part('Wuhan University / set-back dormitory glazing', 'shadow')
    frames = Part('Wuhan University / dark red casement sashes', 'vermilion')
    roof = Part('Wuhan University / blue-green glazed pavilion roofs', 'glaze')
    tiles = Part('Wuhan University / glazed tile rolls and pavilion ridge caps', 'steel')
    joinery = Part('Wuhan University / timber roof brackets, lintels and parapet rails', 'timber')

    _course(terrace, [(-10, 49.6, 15.1), (-.36, 49.6, 15.1), (0, 49.15, 14.8)], 0, .28)
    for k in (-1.5, -.5, .5, 1.5):
        x = k * 12.65
        for face, w in _sides(x, .80, 9.25, 11.3):
            z0 = -.035
            front = face[2] == 0
            tall_face = abs(face[2]) != pi / 2
            centers = [-3.43, -1.72, 0, 1.72, 3.43] if tall_face else [-3.85, -1.32, 1.32, 3.85]
            for level, top in enumerate((2.94, 5.91, 9.28)):
                openings = [_opening(t, 1.03 if front else .86, z0 + .73, z0 + 2.18)
                            for t in centers]
                _wall(brick, face, w, z0, top, .48, openings)
                for opening in openings:
                    _infill(glazing, frames, face, opening, .31, sill_trim=False, mullion=front)
                    bands.box(_point(*face, opening[0], -.048, opening[2] - .077),
                              (opening[1] + .22, .20, .14), face[2])
                if level:
                    bands.box(_point(*face, 0, -.042, z0), (w - .05, .24, .18), face[2])
                z0 = top
            for t in (-(w / 2 - .26), -2.65, 2.65, w / 2 - .26):
                bands.box(_point(*face, t, -.03, 4.65), (.24, .19, 9.31), face[2])

        # Two elongated roof courts for each dormitory. Parapets keep the void outlines readable.
        for y in (-4.08, .83, 5.68):
            terrace.box((x, y, 9.17), (9.46, 1.24, .35))
        for side in (-1, 1):
            terrace.box((x + side * 3.95, .82, 9.14), (1.54, 9.99, .41))
            bands.box((x + side * 4.17, .82, 9.42), (.33, 10.46, .48))
        for y in (-4.56, 6.15):
            bands.box((x, y, 9.43), (8.58, .32, .48))
        for y in (-3.19, 0, 1.66, 4.85):
            joinery.box((x, y, 9.29), (6.40, .13, .24))
        # The tiled front skirt overhangs the dormer-free, walkable roof decks.
        _hip(roof, tiles, x, -3.25, 9.76, 3.65, 8.97, .94, 8.76, 1.52, .17, 1.18)

    for i in (-1, 0, 1):
        x = i * 12.65
        facade = (x, -4.86, 0)
        portal = _opening(0, 2.38, -.08, 3.54, 1.24)
        _wall(brick, facade, 3.51, -.28, 10.15, 8.54, [portal])
        _arch_trim(bands, facade, portal, .245, 11, -.28, .06)
        _arch_trim(bands, (x, 3.69, pi), portal, .15, 7, -.14)
        _stairs(stairs, x, -4.70, 2.20, 1.0, 2.54, 7)
        _stairs(stairs, x, 2.82, 2.26, 2.98, 7.45, 14)
        stairs.box((x, 4.50, 2.84), (2.35, 3.42, .31))
        for u in (-1.23, 1.23):
            bands.box((x + u, -5.97, .46), (.26, 1.83, .90))
        _course(bands, [(9.72, 3.68, 7.12), (9.92, 3.92, 7.30),
                        (10.19, 4.06, 7.48)], x, -.85)
        for face, w in _sides(x, -.85, 3.53, 5.77):
            op = _opening(0, 1.48 if face[2] == 0 else 1.05, 10.39, 11.61, .19)
            _wall(brick, face, w, 10.13, 12.35, .41, [op])
            _infill(glazing, frames, face, op, .27)
            for u in (-1.17, 0, 1.17):
                joinery.box(_point(*face, u, -.19, 12.30), (.20, .57, .27), face[2])
                joinery.box(_point(*face, u, -.36, 12.49), (.32, .71, .19), face[2])
        _hip(roof, tiles, x, -.85, 6.25, 7.72, 12.38, 3.16 if i else 3.49,
             3.05, .42, .73, .88)
        for sx in (-1, 1):
            bands.box((x + sx * 1.55, -.85, 15.69 if i else 16.02), (.23, .35, .49))
            bands.beam((x + sx * 1.45, -.85, 15.69 if i else 16.02),
                       (x + sx * 1.66, -.85, 15.99 if i else 16.32), .13)
    _finish(terrace, brick, bands, stairs, glazing, frames, roof, tiles, joinery)


def museum():
    """North campus of the Hubei Provincial Museum, drawn as a Chu-style complex."""
    ground = Part('Hubei Museum / embedded site, stepped terraces and grand stair', 'stone')
    paving = Part('Hubei Museum / podium copings and courtyard walks', 'plaster')
    shell = Part('Hubei Museum / gallery walls and clerestory frames', 'plaster')
    curtain = Part('Hubei Museum / recessed clerestories and gallery glazing', 'shadow')
    metal = Part('Hubei Museum / window mullions and bronze entrance doors', 'steel')
    roofs = Part('Hubei Museum / deep blue-gray Chu roofs', 'steel')
    raised = Part('Hubei Museum / roof seams, hip rolls and eave trims', 'glaze')
    soffit = Part('Hubei Museum / colonnades, fascia and roofline piers', 'stone')
    _course(ground, [(-4.8, 64, 34), (-.17, 64, 34), (-.04, 63.30, 33.25)])
    _course(ground, [(-.08, 37.5, 22.2), (1.07, 37.0, 21.95),
                     (1.26, 36.72, 21.8), (2.53, 34.50, 19.78),
                     (2.73, 34.44, 19.70), (3.89, 33.4, 18.10)], 0, 3.96)
    _course(paving, [(3.85, 33.8, 18.43), (4.11, 33.80, 18.43)], 0, 3.96)
    _stairs(ground, 0, -5.47, 8.5, 4.02, 7.32, 13)
    for x in (-4.65, 4.65):
        paving.beam((x, -12.95, .38), (x, -5.21, 4.39), .41, .45)
    paving.box((0, -14.72, .055), (8.56, 3.71, .17))
    for x in (-8.91, 8.91):
        paving.box((x, -11.0, .035), (1.02, 8.11, .13))

    for k in (-1, 0, 1):
        x, y = 22 * k, (4.2 if k == 0 else -5.2)
        wing = k != 0
        z0 = 2.18 if wing else 4.05
        if wing:
            _course(ground, [(-.06, 17.0, 17.33), (.31, 17.04, 17.37),
                             (.56, 16.79, 16.92), (2.0, 16.35, 16.45)], x, y)
            _course(paving, [(1.95, 16.57, 16.67), (2.22, 16.57, 16.67)], x, y)
            _stairs(ground, x, y - 8.03, 4.16, 2.12, 2.45, 7)
            paving.box((x - k * 7.20, y + 7.67, 1.07), (5.65, 5.0, 2.13))
        # Each tier divides into an open colonnade, window ribbon and a differently pitched roof.
        tiers = ((14.35, 12.43, z0, 4.74, 17.72, 15.90, 1.07, 12.80, 10.91),
                 (12.71, 10.63, 5.76, 6.81, 14.53, 12.40, 3.05, 5.15, 3.0)) if wing else (
                    (26.90, 14.12, z0, 6.88, 33.4, 18.62, 1.30, 24.25, 12.92),
                    (24.10, 12.58, 8.12, 9.47, 27.64, 15.34, 1.37, 21.65, 11.55),
                    (21.54, 11.32, 10.77, 12.28, 24.14, 14.17, 3.86, 8.10, 3.80))
        for level, (w, d, low, eave, rw, rd, rise, nw, nd) in enumerate(tiers):
            for face, span in _sides(x, y, w, d):
                wall_span = span if level else span - 1.72
                n = max(3, round(wall_span / (3.1 if level else 2.70)))
                pitch = wall_span / n
                front = face[2] == 0
                if level == 0:
                    wall = _point(*face, 0, .86, 0)[:2] + (face[2],)
                else:
                    wall = face
                openings = [_opening((i - (n - 1) / 2) * pitch, pitch * (.60 if level == 0 else .74),
                                     low + (.24 if front else .37), eave - .40)
                            for i in range(n)]
                _wall(shell, wall, wall_span, low - .09, eave + .08, .49, openings)
                for op in openings:
                    _infill(curtain, metal, wall, op, .31, sill_trim=False,
                            mullion=level == 0)
                for i in range(1, n):
                    u = (i - n / 2) * pitch
                    soffit.box(_point(*face, u, -.045, (low + eave) / 2),
                               (.27 if level else .40, .28 if level else .58, eave - low), face[2])
                soffit.box(_point(*face, 0, -.045, eave - .18),
                           (span - .05, .39, .25), face[2])
            _hip(roofs, raised, x, y, rw, rd, eave, rise, nw, nd, .06, 2.40 if wing else 2.26)
            _course(soffit, [(eave - .23, rw - .11, rd - .11),
                              (eave - .115, rw - .10, rd - .10)], x, y)
        if not wing:
            for u in (-7.3, -3.67, 0, 3.67, 7.3):
                metal.box((u, y - 6.31, 5.51), (1.10, .15, 2.45))
            for dx in (-1, 1):
                _hip(roofs, raised, dx * 13.65, 8.40, 11.72, 13.82, 8.61, 3.47,
                     4.41, 3.52, .05, 2.4)
                shell.box((dx * 13.65, 8.47, 7.86), (10.0, 12.26, 1.62))
    _finish(ground, paving, shell, curtain, metal, roofs, raised, soffit)


def honglou():
    """Red-brick assembly hall, double loggias and sculpted entrance gable."""
    base = Part('Red Chamber / recessed site, plinth and entrance stairs', 'stone')
    brick = Part('Red Chamber / red-brick arcades, wings and central portico', 'vermilion')
    plaster = Part('Red Chamber / pale entablatures, arch keystones and gable carving', 'plaster')
    openings = Part('Red Chamber / deeply recessed doors and windows', 'shadow')
    frames = Part('Red Chamber / timber frames and louvred shutters', 'timber')
    railing = Part('Red Chamber / balcony balusters and ironwork', 'ink')
    roofs = Part('Red Chamber / terracotta main roofs and chimneys', 'vermilion')
    tiles = Part('Red Chamber / rolled red tile seams', 'timber')
    cupola = Part('Red Chamber / patinated lantern roof and flagpole', 'glaze')
    _course(base, [(-6, 45.7, 21.25), (-.17, 45.7, 21.25), (.05, 44.86, 20.94)], 0, -1.15)
    _course(base, [(-.04, 41.5, 14.2), (.36, 41.50, 14.2), (.55, 41.14, 13.88),
                    (1.0, 40.63, 13.56)], 0, .02)
    _stairs(base, 0, -9.05, 7.48, 1.11, 2.36, 7)
    for sx in (-1, 1):
        x = 12.48 * sx
        front = (x, -6.44, 0)
        gallery = (x, -4.98, 0)
        for level, (z0, z1) in enumerate(((.95, 5.13), (5.13, 9.58))):
            arches = [_opening(i * 2.03, 1.37 if level else 1.44,
                               z0 + .17, z1 - (.79 if level else 1.19), .35 if level else .54)
                      for i in range(-3, 4)]
            _wall(brick, front, 15.16, z0, z1, .62, arches)
            _wall(brick, gallery, 15.28, z0, z1, .42, arches)
            for door in arches:
                u, w, sill, spring, arch = door
                _infill(openings, frames, gallery, door, .27, sill_trim=False)
                if not level:
                    door = (u, w, sill, spring, arch)
                    _arch_trim(brick, front, door, .12, 7, -.095, .035)
                    plaster.box(_point(*front, u, -.070, spring + arch + .043),
                                (.21, .19, .22))
                else:
                    frames.box(_point(*front, u, .20, sill + .36), (w + .16, .16, .77))
                    railing.box(_point(*front, u, .11, sill + .77), (w + .15, .13, .10))
            plaster.box(_point(*front, 0, -.02, z0 + .19), (15.21, .37, .17))
        rear = (x, 6.40, pi)
        flank = (20.0 * sx, 0, sx * pi / 2)
        for face, w, bays in ((rear, 15.22, 3), (flank, 12.81, 2)):
            for z0, z1 in ((.94, 5.13), (5.13, 9.61)):
                row = [_opening(k * 2.03, 1.27, z0 + .58, z1 - 1.35, .45)
                       for k in range(-bays, bays + 1)]
                _wall(brick, face, w, z0, z1, .57, row)
                for op in row:
                    _infill(openings, frames, face, op, .33)
            for u in (-w / 2 + .19, w / 2 - .19):
                for hz in (1.51, 2.86, 4.08, 5.77, 7.04, 8.37):
                    plaster.box(_point(*face, u, -.06, hz), (.39, .24, .28), face[2])
        for u in (-7.28, -5.07, -3.05, -1.01, 1.01, 3.05, 5.07, 7.28):
            brick.box((x + u, -6.48, 5.22), (.46, .31, 8.54))
            for hz in (1.89, 5.90, 8.31):
                plaster.box((x + u, -6.62, hz), (.50, .25, .13))
        _hip(roofs, tiles, x, .05, 15.38, 13.28, 9.74, 2.14, 14.09, .39, .0, 1.83)
        # The rear wings are compressed in depth to sit on the existing terrain clearance.
        _hip(roofs, tiles, 16.46 * sx, 3.48, 7.27, 7.36, 10.13, 2.18, .82, 3.06, 0, 1.83)
        for px in (8.64 * sx, 16.27 * sx):
            brick.box((px, 2.10, 11.76), (.70, .72, 1.88))
            plaster.box((px, 2.10, 12.69), (.83, .85, .15))

    _course(plaster, [(9.49, 40.34, 13.42), (9.67, 40.87, 13.96),
                       (9.93, 40.87, 13.96), (10.05, 40.42, 13.56)])
    for face, w in _sides(0, 0, 40.08, 13.18):
        for i in range(round(w / .74) - 1):
            u = (i - (round(w / .74) - 2) / 2) * .74
            plaster.box(_point(*face, u, -.105, 9.61), (.22, .28, .20), face[2])
    rear = (0, 6.42, pi)
    back = [_opening(u, 1.40, 1.74, 4.16, .21) for u in (-2.77, 0, 2.77)]
    _wall(brick, rear, 9.98, .94, 5.22, .52, back)
    for op in back:
        _infill(openings, frames, rear, op)
    _wall(brick, rear, 9.93, 5.22, 9.76, .64, [])
    for face, w in _sides(0, -3.64, 9.72, 13.20):
        if face[2] == pi:
            continue
        if face[2] == 0:
            face = (0, -8.48, 0)
        for z0, z1 in ((.94, 5.38), (5.38, 10.14)):
            row = [_opening(u, 1.65, z0 + .16, z1 - 1.30, .53)
                   for u in (-2.63, 0, 2.63)] if face[2] == 0 else [
                       _opening(u, 1.38, z0 + .55, z1 - 1.19, .48) for u in (-3.65, 0, 3.65)]
            _wall(brick, face, w, z0, z1, .54, row)
            for op in row:
                _infill(openings, frames, face, op, .31, sill_trim=False)
                if face[2] == 0:
                    _arch_trim(plaster, face, op, .13, 7, -.10)
    for x in (-4.32, -1.50, 1.50, 4.32):
        _course(brick, [(1.01, .91, .86), (1.26, 1.01, 1.01), (1.57, .83, .86),
                        (9.50, .73, .85), (9.82, .93, .96)], x, -9.71)
        for hz in (1.80, 2.50, 3.20, 3.90, 4.60, 5.30, 6.0, 6.70, 7.40, 8.10, 8.80):
            plaster.box((x, -10.16, hz), (.81, .07, .088))
        plaster.box((x, -9.70, 9.66), (1.06, 1.16, .44))
    _course(plaster, [(4.98, 9.86, 2.51), (5.25, 10.06, 2.66),
                       (5.45, 9.87, 2.49)], 0, -9.24)
    for x in (-2.92, 0, 2.92):
        frames.box((x, -9.56, 5.83), (2.25, .15, .73))
        railing.box((x, -9.51, 6.23), (2.36, .15, .13))
    _course(plaster, [(9.73, 10.02, 2.88), (9.93, 10.51, 3.11),
                       (10.49, 10.51, 3.12), (10.63, 10.66, 3.25)], 0, -9.10)
    gable = (0, -10.76, 0)
    _section(brick, *gable, [(-5.20, 10.55), (5.20, 10.55), (0, 13.12)], 0, 1.14)
    for sx in (-1, 1):
        plaster.beam((sx * 5.22, -10.84, 10.63), (0, -10.84, 13.16), .31, .21)
        plaster.beam((sx * 4.56, -10.91, 10.87), (0, -10.91, 12.91), .125, .11)
        for dx in (.74, 1.27, 1.80, 2.33):
            z = 11.97 - dx * .27
            plaster.beam((sx * (dx - .18), -10.96, z + .105),
                         (sx * (dx + .22), -10.96, z -.06), .14)
            plaster.beam((sx * dx, -10.98, z), (sx * (dx + .15), -10.98, z -.24), .12)
    _disc(plaster, gable, 0, 11.73, .56, -.18, .03, 16)
    _disc(brick, gable, 0, 11.73, .36, -.21, -.15, 16)
    _hip(roofs, tiles, 0, -7.36, 10.8, 7.37, 10.63, 2.53, .34, 6.39, 0, 1.61)
    # The low patinated cap is visible behind the front pediment in the aerial view.
    _course(brick, [(11.18, 4.76, 4.81), (11.42, 4.65, 4.69)], 0, -.11)
    for face, w in _sides(0, -.11, 4.52, 4.55):
        row = [_opening(u, 1.05, 11.49, 12.43, .42) for u in (-1.12, 1.12)]
        _wall(brick, face, w, 11.4, 13.71, .44, row)
        for op in row:
            _infill(openings, frames, face, op, .31, sill_trim=False, mullion=False)
            _arch_trim(plaster, face, op, .11, 7, -.10)
    _course(plaster, [(13.56, 4.62, 4.66), (13.77, 5.02, 5.06)], 0, -.11)
    _course(cupola, [(13.70, 5.13, 5.17), (13.89, 5.17, 5.21),
                     (14.58, 3.31, 3.35), (15.22, 1.75, 1.78), (15.59, .37, .40)], 0, -.11)
    _round(cupola, [(15.52, .32), (15.66, .31), (15.75, .22)], 10, 0, -.11)
    cupola.cylinder(0, -.11, 15.65, 18.18, .067, 8)
    _finish(base, brick, plaster, openings, frames, railing, roofs, tiles, cupola)
