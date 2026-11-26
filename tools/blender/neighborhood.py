"""Low-poly building types for the three towns. Each street frontage faces -Y."""
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


def arcade():
    stone = Part("Riverfront trading house | pavilions and portico", "cityWall")
    caps = Part("Riverfront trading house | hipped pavilion roofs", "cityRoof")
    shade = Part("Riverfront trading house | gallery and window bays", "cityShade")
    stone.box((0, .90, 1.24), (9.56, 4.08, 2.48))
    stone.box((0, .42, 4.04), (9.56, 5.04, 3.12))
    # Independent masonry bays leave a walkable gallery in front of the recessed wall.
    for x in (-2.30, 0, 2.30):
        radius, spring = .93, 1.25
        arch = [(x - 1.15, 0), (x - radius, 0)]
        for i in range(7):
            angle = pi - i * pi / 6
            arch.append((x + radius * cos(angle), spring + radius * sin(angle)))
        arch.extend([(x + radius, 0), (x + 1.15, 0),
                     (x + 1.15, 2.48), (x - 1.15, 2.48)])
        _section(stone, arch, -3.09, -2.43)
    stone.box((0, -2.22, 2.56), (7.42, 2.20, .38))
    _windows(shade, [-2.30, 0, 2.30], -1.15, .13, 1.30, 1.80)
    _windows(shade, [-2.16, -.72, .72, 2.16], -2.11, 3.02, .72, 1.6)
    caps.box((0, .26, 5.72), (9.72, 6.06, .46))
    stone.box((0, -2.20, 2.87), (6.68, .55, .38))
    for y in (-1.94, 2.63):
        stone.box((0, y, 5.98), (6.55, .26, .43))
    for x in (-4.02, 4.02):
        stone.box((x, -.12, 3.06), (1.70, 6.20, 6.12))
        stone.box((x, -.12, 6.28), (2.06, 7.23, .40))
        # Ridge shorter than the pavilion: the front and back slope inward.
        points = [(x-.99,-3.72,6.46), (x+.99,-3.72,6.46), (x+.99,3.48,6.46),
                  (x-.99,3.48,6.46), (x,-2.18,7.59), (x,1.94,7.59)]
        caps.solid(points, [(3,2,1,0), (0,1,4), (1,2,5,4), (2,3,5), (3,0,4,5)])
        _windows(shade, [x], -3.23, 2.95, .76, 1.76)
    _windows(shade, [-2.7, -1.35, 0, 1.35, 2.7], 2.95, 3.04, .64, 1.54)
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


def terrace_tower():
    """Residential terraces with wrapped balconies and a narrow stair spine."""
    wall = Part("Terrace tower | stepped residential wings", "cityWall")
    trim = Part("Terrace tower | cast terrace bands and stair crown", "cityBrick")
    glass = Part("Terrace tower | shaded balconies and street glazing", "cityShade")
    _podium(wall, trim, glass, 10.20, 6.98, 3.48, -1.13)
    terrace_levels = [(3.49, 10.08, 7.28, 5.56, -.51), (10.08, 16.14, 6.19, 4.86, -.05),
                      (16.14, 21.41, 5.11, 4.18, .42), (21.41, 24.82, 3.85, 3.44, .84)]
    for low, high, width, depth, x in terrace_levels:
        center_y = .09
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
    wall.box((2.67, .87, 13.33), (1.45, 3.68, 19.72))
    _windows(glass, [2.68], -.98, 4.20, .58, 18.12)
    trim.box((3.24, -1.00, 13.37), (.28, .30, 19.65))
    wall.box((1.48, .83, 25.13), (1.88, 1.95, .73))
    trim.box((1.48, .83, 25.57), (2.10, 2.13, .26))
    wall.box((.73, .99, 25.95), (.58, .92, .52))
    for part in (wall, trim, glass):
        part.finish()


def slab_tower():
    """Office slab with a glazed reveal and unequal sloping roof shoulders."""
    wall = Part("Slab tower | office slabs and corner piers", "cityWall")
    trim = Part("Slab tower | rooftop plant, sloping caps and transfer belt", "cityRoof")
    glass = Part("Slab tower | recessed glass stacks and lobby glazing", "cityShade")
    _podium(wall, trim, glass, 9.96, 7.50, 4.15, 1.13)
    # The gallery recess separates the slabs all the way to the top of the lower shoulder.
    trim.box((0, .14, 4.22), (9.35, 6.68, .27))
    glass.box((.03, .35, 12.93), (1.51, 3.17, 17.25))
    for x, width, top, ridge, sign in ((-2.05, 3.46, 28.5, 30.92, -1),
                                       (2.12, 3.54, 21.0, 23.44, 1)):
        low, center_y, depth = 4.28, .04, 4.64
        a, b = x - width / 2, x + width / 2
        front, back = center_y - depth / 2, center_y + depth / 2
        outline = [(a, front), (b, front), (b, back), (a, back)]
        levels = [(low + .48, low + 6.5), (low + 6.98, low + 12.90), (low + 13.38, top - .64)]
        _recessed_shaft(wall, glass, outline, (2, 3, 2, 3), .62, low, top - .27, levels)
        wall.box((x, center_y, top - .135), (width, depth, .27))
        _parapet(wall, x, center_y, width, depth, top)
        # The sloped plant-room caps leave a flat service deck facing the street.
        wall.box((x, 1.36, top + .52), (width - .46, 1.65, 1.04))
        ha, hb = (top + 1.03, ridge) if sign < 0 else (ridge, top + 1.03)
        _section(trim, [(a, top + .98), (b, top + .98), (b, hb), (a, ha)], .44, 2.37)
        for sill, _ in levels[1:]:
            trim.box((x, center_y, sill - .24), (width + .13, depth + .17, .34))
    wall.box((2.12, -.85, 22.10), (2.02, 2.50, 2.20))
    _water_tank(trim, -2.05, -1.10, 28.50)
    for part in (wall, trim, glass):
        part.finish()
