"""Low-poly building types for the three towns. Each street frontage faces -Y."""
from functools import partial
from math import cos, hypot, pi, sin

from mesh import Part


def _section(part, profile, front, back, along_x=False):
    """Extrude a counterclockwise XZ profile (or YZ profile along the X axis)."""
    n = len(profile)
    if along_x:
        vertices = [(depth, s, z) for depth in (back, front) for s, z in profile]
    else:
        vertices = [(s, depth, z) for depth in (front, back) for s, z in profile]
    faces = [tuple(range(n)), tuple(reversed(range(n, 2 * n)))]
    faces.extend((i, n + i, n + (i + 1) % n, (i + 1) % n) for i in range(n))
    part.solid(vertices, faces)


def _windows(part, centers, y, sill, width, height):
    """Glaze the back of an opening or a shallow sash facing along Y."""
    for center in centers:
        left, right = center - width / 2, center + width / 2
        face = (0, 1, 2, 3) if y < 0 else (3, 2, 1, 0)
        part.solid([(left, y, sill), (right, y, sill),
                    (right, y, sill + height), (left, y, sill + height)], [face])


def _parapet(part, x, y, width, depth, roof):
    """A continuous 0.36-metre coping with the bottom buried in the roof."""
    def corners(inset, z):
        w, d = width / 2 - inset, depth / 2 - inset
        return [(x - w, y - d, z), (x + w, y - d, z),
                (x + w, y + d, z), (x - w, y + d, z)]

    vertices = (corners(0, roof - .02) + corners(0, roof + .72)
                + corners(.36, roof + .72) + corners(.36, roof - .02))
    faces = []
    for i in range(4):
        j = (i + 1) % 4
        faces.extend([(i, j, j + 4, i + 4), (i + 4, j + 4, j + 8, i + 8),
                      (i + 8, j + 8, j + 12, i + 12)])
    part.solid(vertices, faces)


def _water_tank(part, x, y, roof):
    part.box((x, y, roof + 1.28), (1.64, 1.64, 1.24))
    for dx in (-.57, .57):
        for dy in (-.57, .57):
            part.box((x + dx, y + dy, roof + .34), (.24, .24, .72))


def _shopfront(wall, roof, glass, width, depth, height, bays, entry=None):
    """Keep the footprint piers at the old facade and open the shop bays behind them."""
    face = -depth / 2
    recess, sill, head = .56, .34, height - .50
    rear = face + recess
    left, right = -width / 2, width / 2
    wall.box((0, recess / 2, height / 2), (width, depth - recess, height))

    def panel(start, end, bottom, top):
        wall.solid([(start, face, bottom), (end, face, bottom),
                    (end, face, top), (start, face, top)], [(0, 1, 2, 3)])

    panel(left, right, 0, sill)
    panel(left, right, head, height)
    wall.solid([(x, y, z) for y in (face, rear)
                for x in (left, right) for z in (0, height)],
               [(0, 1, 5, 4), (1, 3, 7, 5), (2, 6, 7, 3)])
    pier = left
    for x, span in bays:
        start, end = x - span / 2, x + span / 2
        panel(pier, start, sill, head)
        profile = [(start, sill), (end, sill), (end, head), (start, head)]
        wall.solid([(x, y, z) for y in (face, rear) for x, z in profile],
                   [(0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)])
        _windows(glass, [x], rear - .012, sill, span, head - sill)
        pier = end
    panel(pier, right, sill, head)
    if entry is not None:
        # The old street walk attaches its threshold details at this face.
        _windows(glass, [entry], face - .012, .055, 1.47, 1.93)
    roof.box((0, rear - .55, height - .34), (width - .46, 1.12, .46))


def _balcony(part, x, width, wall_y, floor):
    """Cast slab and solid guard, with clearance above 0.90 m after quantization."""
    profile = [(0, 0), (.96, 0), (.96, 1.12), (.73, 1.12), (.73, .20), (0, .20)]
    if wall_y < 0:
        profile = [(-d, z) for d, z in reversed(profile)]
    _section(part, [(wall_y + d, floor + z) for d, z in profile],
             x - width / 2, x + width / 2, True)


def _recessed_shaft(wall, glass, outline, divisions, depth, low, high, levels):
    """Cut full-height window channels into selected edges of a CCW floor plan."""
    profile = []
    for i, ((x, y), bays) in enumerate(zip(outline, divisions)):
        profile.append((x, y))
        if not bays:
            continue
        end_x, end_y = outline[(i + 1) % len(outline)]
        dx, dy = end_x - x, end_y - y
        length = hypot(dx, dy)
        ux, uy = dx / length, dy / length
        nx, ny = -uy, ux
        # Where two cuts share a corner, leave a solid pier as deep as either reveal.
        start = depth + .07 if divisions[i - 1] else 0
        end = depth + .07 if divisions[(i + 1) % len(outline)] else 0
        pitch = (length - start - end) / bays
        for bay in range(bays):
            left, right = start + (bay + .16) * pitch, start + (bay + .84) * pitch
            a, b = (x + left * ux, y + left * uy), (x + right * ux, y + right * uy)
            inset_a = (a[0] + depth * nx, a[1] + depth * ny)
            inset_b = (b[0] + depth * nx, b[1] + depth * ny)
            profile.extend([a, inset_a, inset_b, b])
            u = (inset_a[0] - .012 * nx, inset_a[1] - .012 * ny)
            v = (inset_b[0] - .012 * nx, inset_b[1] - .012 * ny)
            for sill, head in levels:
                glass.solid([(*u, sill), (*v, sill), (*v, head), (*u, head)], [(0, 1, 2, 3)])
    wall.prism(profile, low, high)


def lane():
    walls = Part("Lane houses | brickwork and stepped party walls", "cityBrick")
    roofs = Part("Lane houses | common tiled ridge", "cityRoof")
    joinery = Part("Lane houses | doors and paired sashes", "cityShade")
    walls.box((0, 0, 1.36), (9.55, 5.42, 2.72))
    # The handmade street tiles follow the original slope down to the drip line.
    _section(roofs, [(-3.25, 2.27), (3.25, 2.27), (3.25, 2.65), (2.94, 2.68),
                     (0, 4.14), (-2.94, 2.68), (-3.25, 2.65)], -4.80, 4.80, True)

    # The stepped parapets divide a continuous tiled roof into three households.
    party_wall = [(-2.81, 2.67), (2.81, 2.67), (2.81, 3.18), (1.67, 3.57),
                  (1.67, 3.89), (.55, 4.19), (.55, 4.79), (-.55, 4.79),
                  (-.55, 4.19), (-1.67, 3.89), (-1.67, 3.57), (-2.81, 3.18)]
    for x in (-4.73, -1.58, 1.58, 4.73):
        _section(walls, party_wall, x - .17, x + .17, True)
    for x in (-3.16, 0, 3.16):
        door = x - .75
        _windows(joinery, [door], -2.72, .05, .70, 1.72)
        _windows(joinery, [x + .43, x + .97], -2.72, .65, .40, .95)
        _windows(joinery, [x - .72, x + .66], 2.72, 1.1, .68, 1.05)
        surround = [(-.67, .48), (-.38, .48), (-.38, 1.75), (.38, 1.75),
                    (.38, .48), (.67, .48), (.67, 1.98), (0, 2.29), (-.67, 1.98)]
        _section(walls, [(door + u, z) for u, z in surround], -3.16, -2.68)
        # Chamfer the jamb feet back to the wall above the map's ground-contact band.
        footing = [(-2.70, .16), (-2.68, .16), (-2.68, .48), (-3.16, .48)]
        for left, right in ((-.67, -.38), (.38, .67)):
            _section(walls, footing, door + left, door + right, True)
    walls.box((2.72, .65, 4.16), (.62, .61, 1.16))
    roofs.box((2.72, .65, 4.83), (.79, .78, .24))
    for part in (walls, roofs, joinery):
        part.finish()


def _gable(wall, roof, left, peak, right, start, end, eave, ridge, along_x=False):
    """A tiled roof with masonry closing both gables."""
    _section(wall, [(left + .09, eave - .20), (right - .09, eave - .20), (peak, ridge - .11)],
             start + .17, end - .17, along_x)
    _section(roof, [(left, eave - .12), (peak, ridge - .14), (right, eave - .12),
                    (right, eave + .03), (peak, ridge + .04), (left, eave + .03)],
             start, end, along_x)


def lane_pair():
    wall = Part("Lane houses | two street gables", "cityBrick")
    roof = Part("Lane houses | paired end-on tiled roofs", "cityRoof")
    pane = Part("Lane houses | two doors and narrow sashes", "cityShade")
    for x, eave, ridge in ((-2.40, 2.70, 4.51), (2.40, 2.53, 4.18)):
        wall.box((x, 0, eave / 2), (4.74, 5.42, eave))
        _gable(wall, roof, x - 2.44, x - .19, x + 2.44, -3.15, 3.14, eave, ridge)
        _windows(pane, [x - .07], -2.73, .05, .80, 1.80)
        _windows(pane, [x - 1.25, x + 1.29], -2.73, .75, .51, 1.02)
        _windows(pane, [x - .08], -2.991, eave + .33, .58, .54)
        _windows(pane, [x - 1.06, x + 1.06], 2.72, .88, .67, 1.18)
        roof.box((x, -2.90, 2.24), (3.96, .63, .13))
        wall.box((x - .07, -2.76, .12), (1.12, .20, .24))
    for part in (wall, roof, pane):
        part.finish()


def lane_annex():
    wall = Part("Lane houses | two bays and a low service annex", "cityBrick")
    roof = Part("Lane houses | offset ridge and dropped end", "cityRoof")
    pane = Part("Lane houses | shaded sashes and service door", "cityShade")
    wall.box((-1.48, 0, 1.40), (6.59, 5.42, 2.80))
    wall.box((3.31, 0, 1.20), (2.98, 5.42, 2.40))
    _gable(wall, roof, -3.17, .29, 3.16, -4.92, 1.98, 2.77, 4.67, True)
    _gable(wall, roof, -2.97, .19, 3.00, 1.78, 4.90, 2.36, 3.66, True)
    # A raised firebreak is visible where the lower roof meets the main house.
    _section(wall, [(-2.80,2.64),(2.80,2.64),(2.80,3.20),(1.11,4.07),
                    (1.11,4.53),(-.49,4.78),(-.49,4.35),(-2.80,3.53)], 1.59, 1.84, True)
    for x in (-3.14, -.21, 3.31):
        _windows(pane, [x - .58], -2.72, .05, .73, 1.72)
        _windows(pane, [x + .58], -2.72, .86, .74, 1.00)
        _windows(pane, [x], 2.72, .93, .84, 1.07)
    wall.box((-3.08, .84, 4.32), (.56, .51, .77))
    roof.box((-3.08, .84, 4.76), (.72, .67, .16))
    for part in (wall, roof, pane):
        part.finish()


def arcade(style=0):
    stone = Part("Riverfront trading house | masonry openings", "cityWall")
    caps = Part("Riverfront trading house | cornice and roof", "cityRoof")
    shade = Part("Riverfront trading house | recessed gallery and sashes", "cityShade")
    left, right, bays, arch_width, upper_bays = [
        (-3.39, 3.39, 3, .83, 4),
        (-4.66, 4.66, 4, .81, 5),
        (-1.77, 4.66, 2, 1.19, 3),
    ][style]
    pitch = (right - left) / bays
    stone.box((0, .89, 1.24), (9.56, 4.08, 2.48))
    for bay in range(bays):
        a = left + bay * pitch
        x = a + pitch / 2
        spring, head = (1.30, .80) if style != 2 else (1.20, .90)
        arch = [(a, 0), (x - arch_width, 0)]
        for i in range(7):
            angle = pi - i * pi / 6
            arch.append((x + arch_width * cos(angle), spring + head * sin(angle)))
        arch.extend([(x + arch_width, 0), (a + pitch, 0), (a + pitch, 2.48), (a, 2.48)])
        _section(stone, arch, -3.11, -2.54)
        _windows(shade, [x], -1.16, .14, arch_width * 1.48, 1.73)
    width, middle = right - left, (right + left) / 2
    face, rear = -2.62, 2.93
    outline = [(left, face), (right, face), (right, rear), (left, rear)]
    _recessed_shaft(stone, shade, outline, (upper_bays, 0, upper_bays, 0),
                    .38, 3.11, 4.74, [(3.16, 4.67)])
    stone.box((middle, .15, 2.795), (width, 5.55, .63))
    stone.box((middle, .15, 5.09), (width, 5.55, .70))
    caps.box((middle, -.02, 2.55), (width + .11, 6.49, .18))
    stone.box((middle, -2.68, 3.04), (width + .07, .29, .18))
    caps.box((middle, .03, 5.56), (width + .27, 6.01, .28))
    _parapet(stone, middle, .03, width + .09, 5.83, 5.65)
    if style == 0:
        for x in (-4.06, 4.06):
            stone.box((x, -.03, 3.07), (1.48, 6.15, 6.14))
            stone.box((x, -.02, 6.16), (1.87, 6.82, .24))
            points = [(x-.94,-3.49,6.26), (x+.94,-3.49,6.26), (x+.94,3.45,6.26),
                      (x-.94,3.45,6.26), (x,-1.93,7.56), (x,1.89,7.56)]
            caps.solid(points, [(3,2,1,0), (0,1,4), (1,2,5,4), (2,3,5), (3,0,4,5)])
            _windows(shade, [x], -3.12, 3.19, .55, 1.55)
    elif style == 1:
        # A stepped sign wall breaks the continuous roof terrace without raising it a full storey.
        _section(stone, [(-2.22,5.80),(2.22,5.80),(2.22,6.28),(1.43,6.28),
                         (1.43,6.66),(.56,6.66),(.56,6.94),(-.56,6.94),
                         (-.56,6.66),(-1.43,6.66),(-1.43,6.28),(-2.22,6.28)], -3.01,-2.62)
        caps.box((0, -2.82, 6.97), (1.24, .51, .15))
    else:
        stone.box((-3.23, -.01, 3.10), (2.91, 6.09, 6.20))
        _gable(stone, caps, -4.86, -3.63, -1.65, -3.36, 3.27, 6.13, 7.48)
        _windows(shade, [-3.43], -3.07, 3.09, 1.07, 1.83)
        _windows(shade, [-3.43], -3.07, .14, 1.29, 1.94)
        stone.box((-1.86, .53, 6.44), (.26, 1.37, .82))
    for part in (stone, caps, shade):
        part.finish()


def wharf():
    brick = Part("Wharf stores | twin brick sheds and loading apron", "cityBrick")
    tin = Part("Wharf stores | twin gables, ridge vents and loading canopy", "cityRoof")
    shade = Part("Wharf stores | loading doors and gable vents", "cityShade")
    brick.box((0, -.02, .22), (9.75, 7.1, .44))
    for x, eave, ridge in ((-2.39, 3.71, 5.58), (2.39, 3.21, 4.94)):
        brick.box((x, .18, (.44 + eave) / 2), (4.68, 5.56, eave - .44))
        gable = [(x - 2.33, eave), (x + 2.33, eave), (x, ridge - .12)]
        _section(brick, gable, -2.60, 2.96)
        roof = [(x - 2.38, eave - .06), (x, ridge - .12), (x + 2.38, eave - .06),
                (x + 2.38, eave + .09), (x, ridge + .06), (x - 2.38, eave + .09)]
        _section(tin, roof, -2.76, 3.13)
        shade.box((x, .27, ridge + .23), (.78, 3.72, .68))
        monitor = [(x - .55, ridge + .44), (x + .55, ridge + .44), (x, ridge + .91)]
        _section(tin, monitor, -1.75, 2.29)
        _windows(shade, [x], -2.61, .44, 2.65, 2.28)
        _windows(shade, [x], -2.61, eave + .18, 1.16, .40)
        _windows(shade, [x - .96, x + .96], 2.97, 1.62, .86, .90)
    _section(tin, [(-4.12, 2.66), (-2.57, 3.09), (-2.57, 3.47), (-4.12, 3.04)],
             -4.34, 4.34, True)
    for x in (-4.08, 0, 4.08):
        _section(brick, [(-3.95, 2.78), (-2.59, 1.98), (-2.59, 2.63)], x - .16, x + .16, True)
    for x in (-4.48, 4.48):
        shade.box((x, -3.27, .64), (.34, .34, .40))
        shade.box((x, -3.27, .84), (.48, .48, .25))
    for part in (brick, tin, shade):
        part.finish()


def wharf_warehouse():
    brick = Part("Wharf store | wide warehouse with a loading wing", "cityBrick")
    tin = Part("Wharf store | one broad gable and a lean-to", "cityRoof")
    pane = Part("Wharf store | tall cargo doors and attic slits", "cityShade")
    brick.box((0, -.02, .22), (9.75, 7.10, .44))
    brick.box((-.93, .18, 2.02), (7.57, 5.56, 3.16))
    _gable(brick, tin, -4.82, -.75, 3.03, -2.84, 3.15, 3.54, 5.63)
    brick.box((3.77, .15, 1.68), (1.93, 5.5, 2.48))
    _section(tin, [(2.70,3.20),(4.92,2.75),(4.92,2.91),(2.70,3.42)], -3.05, 3.11)
    _section(tin, [(-4.10,2.81),(-2.51,3.16),(-2.51,3.31),(-4.10,2.99)],
             -4.50, 1.91, True)
    _windows(pane, [-2.67, .61], -2.61, .44, 2.35, 2.36)
    _windows(pane, [-1.54, -.76, .02], -2.695, 3.77, .36, .51)
    _windows(pane, [3.75], -2.61, .47, 1.17, 1.92)
    _windows(pane, [-3.12, -1.08, .96, 3.73], 2.97, 1.42, .77, .89)
    tin.box((-.75, .32, 5.74), (.88, 2.16, .43))
    for part in (brick, tin, pane):
        part.finish()


def apartment():
    walls = Part("Apartment block | masonry piers, roof terraces and service deck", "cityWall")
    brick = Part("Apartment block | solid balconies and stair enclosure", "cityBrick")
    roof = Part("Apartment block | shop canopy and rooftop services", "cityRoof")
    shade = Part("Apartment block | shop glass and balcony doors", "cityShade")
    _shopfront(walls, roof, shade, 9.74, 6.56, 2.68,
               [(-3.22, 1.60), (1.12, 1.60), (3.29, 1.60)], -1.05)
    walls.box((0, .14, 5.11), (8.95, 5.40, 4.86))
    walls.box((-.91, .26, 8.30), (5.52, 4.58, 1.52))
    brick.box((2.04, .40, 8.64), (2.00, 2.50, 2.20))
    # Enclose the old hand-laid coping where it is fitted to the street-walk roof.
    roof.box((2.04, .40, 9.88), (2.20, 3.87, .28))
    for y in (-2.57, 2.85):
        toward = -1 if y < 0 else 1
        for x in (-4.18, .07, 4.18):
            walls.box((x, y + toward * .25, 5.11), (.55, .60, 4.86))
        for z in (3.02, 4.55, 6.08):
            _windows(shade, [-2.92, -.92, 1.08, 3.08], y, z, 1.60, 1.28)
            for x in (-2.16, 2.19):
                _balcony(brick, x, 3.46, y - toward * .02, z - .33)
    _windows(shade, [-2.24, .48], -2.04, 8.34, 1.50, .42)
    _windows(shade, [2.04], -.86, 8.30, .77, 1.08)
    _parapet(walls, 0, .14, 8.95, 5.40, 7.54)
    _parapet(brick, -.91, .26, 5.52, 4.58, 9.06)
    _water_tank(roof, -2.18, .87, 9.06)
    walls.box((-.15, .22, 9.78), (2.16, 2.43, 1.44))
    for part in (walls, brick, roof, shade):
        part.finish()


def apartment_terraces(style):
    wall = Part("Apartment block | street shops and recessed upper storeys", "cityWall")
    brick = Part("Apartment block | offset balconies and coping", "cityBrick")
    roof = Part("Apartment block | terrace or pitched service roof", "cityRoof")
    pane = Part("Apartment block | shopfront and apartment sashes", "cityShade")
    _shopfront(wall, roof, pane, 9.74, 6.56, 2.68,
               [(-3.23,1.63),(1.10,1.69),(3.27,1.58)], -1.05)
    storeys = 7.72 if style == 1 else 8.21
    width, depth, x, y = (8.96, 5.39, .02, .16) if style == 1 else (8.72, 5.31, -.12, .18)
    wall.box((x, y, (2.68 + storeys) / 2), (width, depth, storeys - 2.68))
    _parapet(wall, x, y, width, depth, storeys)
    for direction in (-1, 1):
        front = y + direction * depth / 2
        for z in (3.01, 4.58, 6.19):
            panes = [-2.90,-.94,1.02,2.98] if style == 1 else [-2.85,-.18,2.51]
            _windows(pane, panes, front + direction * .012, z, 1.24 if style == 1 else 1.57, 1.27)
            if style == 1:
                # The banner-like balcony moves to the opposite side of the second storey.
                _balcony(brick, -.66 + (z > 4.8) * 1.36, 6.82, front, z - .29)
            elif z > 4:
                _balcony(brick, -1.67 if direction < 0 else 1.21, 4.63, front, z - .32)
        for column in (-3.97, 3.97):
            wall.box((column, front, 5.05), (.40, .34, 4.73))
    if style == 1:
        wall.box((1.09, .61, 8.70), (5.88, 3.80, 1.96))
        _parapet(brick, 1.09, .61, 5.88, 3.80, 9.68)
        _windows(pane, [-.70, 1.05, 2.80], -1.30, 8.35, .85, .86)
        roof.box((2.52, .84, 10.35), (1.96, 1.64, .27))
        wall.box((2.52, .84, 10.13), (1.76, 1.45, .46))
    else:
        wall.box((-1.25, .27, 8.55), (5.74, 4.07, .71))
        _gable(wall, roof, -1.95, .67, 2.43, -4.21, 1.71, 8.88, 10.55, True)
        _windows(pane, [-2.96, -1.08, .70], -1.78, 8.42, .76, .38)
        roof.box((2.69, .91, 8.84), (1.29, 1.37, 1.26))
    for part in (wall, brick, roof, pane):
        part.finish()


def highrise():
    wall = Part("Modern tower | chamfered podium and shaft", "cityWall")
    trim = Part("Modern tower | shop canopy and rooftop plant", "cityRoof")
    glass = Part("Modern tower | recessed vertical glazing", "cityShade")
    _shopfront(wall, trim, glass, 9.72, 6.80, 2.70,
               [(-3.15, 1.50), (-1.05, 1.50), (1.05, 1.50), (3.15, 1.50)])
    wall.box((0, 0, 2.77), (9.72, 6.80, .22))
    # Two clipped street corners make the tall narrow shaft legible from the oblique map camera.
    shaft = [(-3.32,-1.70), (-2.47,-2.55), (2.49,-2.55), (3.32,-1.72),
             (3.32,1.76), (2.55,2.53), (-2.50,2.53), (-3.32,1.71)]
    _recessed_shaft(wall, glass, shaft, (0, 3, 0, 1, 0, 3, 0, 1), .65, 2.88, 14.24,
                    [(3.30, 8.31), (8.81, 14.09)])
    wall.prism(shaft, 14.24, 14.64)
    _parapet(wall, 0, -.01, 4.88, 5.04, 14.64)
    wall.box((-1.25, .40, 16.07), (2.00, 2.50, 2.86))
    wall.box((1.05, .42, 15.79), (2.24, 2.58, 2.30))
    _water_tank(trim, 1.06, .47, 16.94)
    for part in (wall, trim, glass):
        part.finish()


def highrise_spine():
    wall = Part("Modern tower | window grooves and projecting stair spine", "cityWall")
    trim = Part("Modern tower | podium canopy and stepped cap", "cityRoof")
    pane = Part("Modern tower | glazed offices, stairs and shop bays", "cityShade")
    _shopfront(wall, trim, pane, 9.72, 6.80, 2.70,
               [(-3.03,1.65),(-.93,1.51),(1.27,1.69),(3.32,1.59)])
    wall.box((0, 0, 2.77), (9.72, 6.80, .22))
    outline = [(-3.61,-2.03),(-2.99,-2.48),(2.63,-2.48),(3.12,-1.93),
               (3.12,2.29),(-3.61,2.29)]
    _recessed_shaft(wall, pane, outline, (0, 3, 0, 2, 3, 0), .52, 2.88, 14.93,
                    [(3.34,7.06),(7.54,11.13),(11.66,14.62)])
    wall.prism(outline, 14.93, 15.19)
    _parapet(wall, -.20, -.05, 6.03, 4.50, 15.19)
    wall.box((-2.77, .97, 10.69), (1.74, 3.46, 15.63))
    _windows(pane, [-2.78], -.77, 4.12, .48, 12.55)
    trim.box((-2.77, .97, 18.56), (1.86, 3.58, .22))
    wall.box((.40, -.22, 15.94), (3.89, 3.41, 1.49))
    trim.box((.40, -.22, 16.72), (4.14, 3.65, .24))
    for part in (wall, trim, pane):
        part.finish()


def _podium(wall, trim, glass, width, depth, height, entry):
    """Ground-floor arcade and shopfront, set back from the corner piers."""
    face = -depth / 2
    wall.box((0, .32, height / 2), (width, depth - .64, height))
    trim.box((0, -.01, .19), (width + .13, depth + .10, .38))
    trim.box((0, -.12, height - .16), (width + .21, depth + .18, .39))
    pitch = (width - .70) / 4
    for column in range(5):
        x = (column - 2) * pitch
        wall.box((x, face + .08, height / 2), (.28, .43, height - .32))
        if column == 4:
            continue
        bay = x + pitch / 2
        _windows(glass, [bay], face + .302, .39, pitch - .33, height - .92)
        _windows(glass, [bay], -face + .01, .65, pitch - .49, height - 1.13)
        trim.box((bay, face + .15, height - .93), (pitch - .31, .34, .25))
        trim.box((bay, face + .10, height / 2 - .13), (.25, .27, height - .67))
    trim.box((entry, face - .20, height - .86), (2.04, .84, .26))
    trim.box((entry, face - .09, .23), (2.05, .58, .20))
    for sign in (-1, 1):
        x = sign * (width / 2 + .01)
        for y in (-depth * .24, 0, depth * .24):
            a, b = y - depth * .087, y + depth * .087
            glass.solid([(x, a, .73), (x, b, .73), (x, b, height - .63), (x, a, height - .63)],
                        [(0, 1, 2, 3) if sign > 0 else (3, 2, 1, 0)])


def terrace_tower(style=0):
    """Residential terraces with wrapped balconies and a narrow stair spine."""
    wall = Part("Terrace tower | stepped residential wings", "cityWall")
    trim = Part("Terrace tower | cast terrace bands and stair crown", "cityBrick")
    glass = Part("Terrace tower | shaded balconies and street glazing", "cityShade")
    _podium(wall, trim, glass, 10.20, 6.98, 3.48, -1.13)
    terrace_levels = [(3.49, 10.08, 7.28, 5.56, -.51), (10.08, 16.14, 6.19, 4.86, -.05),
                      (16.14, 21.41, 5.11, 4.18, .42), (21.41, 24.82, 3.85, 3.44, .84)]
    if style == 1:
        terrace_levels = [(3.49,12.10,7.54,5.58,.34), (12.10,17.50,6.50,4.81,-.26),
                          (17.50,24.78,4.25,3.46,-1.18)]
    for low, high, width, depth, x in terrace_levels:
        center_y = .53 if style == 1 and low > 12 else .09
        wall.box((x, center_y, (low + high) / 2), (width - .94, depth - 1.10, high - low))
        for direction in (-1, 1):
            y = center_y + direction * (depth / 2 - .29)
            wall.box((x - .015, y, (low + high) / 2), (.46, .63, high - low))
        floors = round((high - low) / 1.67)
        rise = (high - low) / floors
        for f in range(floors):
            lower = low + f * rise
            trim.box((x, center_y, lower + .29), (width + .035, depth, .54))
            for direction in (-1, 1):
                y = center_y + direction * (depth / 2 - .535)
                _windows(glass, [x - width * .21, x + width * .21], y,
                         lower + .53, width * .30, rise - .62)
        trim.box((x, center_y, high - .17), (width + .14, depth + .13, .38))
    # The lift core and its return keep a continuous vertical line through the setbacks.
    if style == 0:
        wall.box((2.67, .87, 13.33), (1.45, 3.68, 19.72))
        _windows(glass, [2.68], -.98, 4.20, .58, 18.12)
        trim.box((3.24, -1.00, 13.37), (.28, .30, 19.65))
        wall.box((1.48, .83, 25.13), (1.88, 1.95, .73))
        trim.box((1.48, .83, 25.57), (2.10, 2.13, .26))
        wall.box((.73, .99, 25.95), (.58, .92, .52))
    else:
        wall.box((-2.00, 1.00, 14.63), (1.44, 3.85, 22.30))
        _windows(glass, [-2.15], -.94, 4.52, .55, 18.97)
        trim.box((-1.83, .83, 25.87), (2.61, 3.96, .36))
        _parapet(wall, -.51, .52, 2.10, 2.73, 24.82)
    for part in (wall, trim, glass):
        part.finish()


def slab_tower(style=0):
    """Office slab with a glazed reveal and unequal sloping roof shoulders."""
    wall = Part("Slab tower | office slabs and corner piers", "cityWall")
    trim = Part("Slab tower | rooftop plant, sloping caps and transfer belt", "cityRoof")
    glass = Part("Slab tower | recessed glass stacks and lobby glazing", "cityShade")
    _podium(wall, trim, glass, 9.96, 7.50, 4.15, 1.13)
    # The gallery recess separates the slabs all the way to the top of the lower shoulder.
    trim.box((0, .14, 4.22), (9.35, 6.68, .27))
    glass.box((.03, .35, 12.93), (1.51, 3.17, 17.25))
    slabs = [(-2.05, .04, 3.46, 28.50, 30.92, -1), (2.12, .04, 3.54, 21.00, 23.44, 1)]
    if style == 1:
        slabs = [(-2.06, -.43, 3.36, 22.24, 24.40, 1), (1.94, .77, 3.59, 28.65, 30.63, -1)]
    for x, center_y, width, top, ridge, sign in slabs:
        low, depth = 4.28, 4.64
        a, b = x - width / 2, x + width / 2
        front, back = center_y - depth / 2, center_y + depth / 2
        outline = [(a, front), (b, front), (b, back), (a, back)]
        levels = [(low + .48, low + 6.5), (low + 6.98, low + 12.90), (low + 13.38, top - .64)]
        _recessed_shaft(wall, glass, outline, (2, 3, 2, 3), .62, low, top - .27, levels)
        wall.box((x, center_y, top - .135), (width, depth, .27))
        _parapet(wall, x, center_y, width, depth, top)
        # The sloped plant-room caps leave a flat service deck facing the street.
        if style == 0:
            wall.box((x, 1.36, top + .52), (width - .46, 1.65, 1.04))
            ha, hb = (top + 1.03, ridge) if sign < 0 else (ridge, top + 1.03)
            _section(trim, [(a, top + .98), (b, top + .98), (b, hb), (a, ha)], .44, 2.37)
        else:
            wall.box((x, center_y + .52, top + .73), (width - .46, 2.99, 1.46))
            wall.box((x + sign * .42, center_y + .91, (top + ridge) / 2), (1.43, 1.54, ridge - top))
            trim.box((x, center_y + .52, top + 1.42), (width - .26, 3.11, .21))
        for sill, _ in levels[1:]:
            trim.box((x, center_y, sill - .24), (width + .13, depth + .17, .34))
    if style == 0:
        wall.box((2.12, -.85, 22.10), (2.02, 2.50, 2.20))
        _water_tank(trim, -2.05, -1.10, 28.50)
    else:
        _water_tank(trim, 2.27, -.64, 28.65)
    for part in (wall, trim, glass):
        part.finish()


BUILDERS = {builder.__name__: builder for builder in
            (lane, arcade, wharf, apartment, highrise, terrace_tower, slab_tower)}
BUILDERS.update({
    "lane_2": lane_pair, "lane_3": lane_annex,
    "arcade_2": partial(arcade, 1), "arcade_3": partial(arcade, 2),
    "wharf_2": wharf_warehouse,
    "apartment_2": partial(apartment_terraces, 1), "apartment_3": partial(apartment_terraces, 2),
    "highrise_2": highrise_spine,
    "terrace_tower_2": partial(terrace_tower, 1),
    "slab_tower_2": partial(slab_tower, 1),
})
