"""Low-poly building types for the three towns. Each street frontage faces -Y."""
from math import cos, pi, sin

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
    """Recess colour on the street and courtyard walls, one quad per opening."""
    for center in centers:
        left, right = center - width / 2, center + width / 2
        face = (0, 1, 2, 3) if y < 0 else (3, 2, 1, 0)
        part.solid([(left, y, sill), (right, y, sill),
                    (right, y, sill + height), (left, y, sill + height)], [face])


def lane():
    walls = Part("Lane houses | brickwork and stepped party walls", "cityBrick")
    roofs = Part("Lane houses | common tiled ridge", "cityRoof")
    joinery = Part("Lane houses | doors and paired sashes", "cityShade")
    walls.box((0, 0, 1.36), (9.55, 5.42, 2.72))
    _section(roofs, [(-2.94, 2.68), (2.94, 2.68), (0, 4.14)], -4.8, 4.8, True)

    # The stepped parapets divide a continuous tiled roof into three households.
    party_wall = [(-2.77, 2.67), (2.77, 2.67), (2.77, 3.00), (1.68, 3.50),
                  (1.68, 3.68), (.49, 4.15), (.49, 4.40), (-.49, 4.40),
                  (-.49, 4.15), (-1.68, 3.68), (-1.68, 3.50), (-2.77, 3.00)]
    for x in (-4.73, -1.58, 1.58, 4.73):
        _section(walls, party_wall, x - .09, x + .09, True)
    for x in (-3.16, 0, 3.16):
        _windows(joinery, [x - .75], -2.72, .05, .70, 1.72)
        _windows(joinery, [x + .43, x + .97], -2.72, .65, .40, .95)
        _windows(joinery, [x - .72, x + .66], 2.72, 1.1, .68, 1.05)
    for part in (walls, roofs, joinery):
        part.finish()


def arcade():
    stone = Part("Riverfront trading house | pavilions and portico", "cityWall")
    caps = Part("Riverfront trading house | hipped pavilion roofs", "cityRoof")
    shade = Part("Riverfront trading house | gallery and window bays", "cityShade")
    stone.box((0, .42, 2.8), (9.56, 5.04, 5.60))
    # Independent masonry bays leave a walkable gallery in front of the recessed wall.
    for x in (-2.30, 0, 2.30):
        radius, spring = .93, 1.25
        arch = [(x - 1.15, 0), (x - radius, 0)]
        for i in range(7):
            angle = pi - i * pi / 6
            arch.append((x + radius * cos(angle), spring + radius * sin(angle)))
        arch.extend([(x + radius, 0), (x + 1.15, 0),
                     (x + 1.15, 2.48), (x - 1.15, 2.48)])
        _section(stone, arch, -3.02, -2.54)
    stone.box((0, -2.66, 2.53), (7.42, 1.18, .20))
    _windows(shade, [-2.30, 0, 2.30], -2.11, .13, 1.16, 1.66)
    _windows(shade, [-2.16, -.72, .72, 2.16], -2.11, 3.02, .72, 1.6)
    caps.box((0, .34, 5.67), (9.72, 5.44, .18))
    for x in (-4.02, 4.02):
        stone.box((x, -.12, 3.06), (1.70, 6.20, 6.12))
        stone.box((x, -.12, 6.18), (1.91, 6.46, .20))
        # Ridge shorter than the pavilion: the front and back slope inward.
        points = [(x-.95,-3.34,6.28), (x+.95,-3.34,6.28), (x+.95,3.10,6.28),
                  (x-.95,3.10,6.28), (x,-2.18,7.34), (x,1.94,7.34)]
        caps.solid(points, [(3,2,1,0), (0,1,4), (1,2,5,4), (2,3,5), (3,0,4,5)])
        _windows(shade, [x], -3.23, 2.95, .76, 1.76)
    _windows(shade, [-2.7, -1.35, 0, 1.35, 2.7], 2.95, 3.04, .64, 1.54)
    for part in (stone, caps, shade):
        part.finish()


def wharf():
    brick = Part("Wharf stores | twin brick sheds and loading apron", "cityBrick")
    tin = Part("Wharf stores | twin gables and loading canopy", "cityRoof")
    shade = Part("Wharf stores | loading doors and gable vents", "cityShade")
    brick.box((0, -.02, .22), (9.75, 7.1, .44))
    for x, eave, ridge in ((-2.39, 3.71, 5.58), (2.39, 3.21, 4.94)):
        brick.box((x, .18, (.44 + eave) / 2), (4.68, 5.56, eave - .44))
        gable = [(x - 2.33, eave), (x + 2.33, eave), (x, ridge - .12)]
        _section(brick, gable, -2.60, 2.96)
        roof = [(x - 2.38, eave - .06), (x, ridge - .12), (x + 2.38, eave - .06),
                (x + 2.38, eave + .09), (x, ridge + .06), (x - 2.38, eave + .09)]
        _section(tin, roof, -2.76, 3.13)
        _windows(shade, [x], -2.61, .44, 2.65, 2.28)
        _windows(shade, [x], -2.61, eave + .18, 1.16, .40)
        _windows(shade, [x - .96, x + .96], 2.97, 1.62, .86, .90)
    _section(tin, [(-3.54, 2.90), (-2.58, 3.16), (-2.58, 3.27), (-3.54, 3.01)],
             -4.34, 4.34, True)
    for part in (brick, tin, shade):
        part.finish()


def apartment():
    walls = Part("Apartment block | podium and two setbacks", "cityWall")
    brick = Part("Apartment block | stair tower and balcony fronts", "cityBrick")
    shade = Part("Apartment block | balcony recesses and stair glazing", "cityShade")
    walls.box((0, 0, 1.34), (9.74, 6.56, 2.68))
    walls.box((0, .14, 5.11), (8.95, 5.40, 4.86))
    walls.box((-.55, .26, 8.30), (6.30, 4.60, 1.52))
    brick.box((2.04, .40, 8.70), (1.88, 3.62, 2.44))
    _windows(shade, [-3.22, 1.12, 3.29], -3.29, .34, 1.60, 1.54)
    _windows(shade, [-1.05], -3.29, .055, 1.47, 1.93)
    brick.box((-1.05, -3.49, 2.11), (2.03, .69, .16))
    for y in (-2.57, 2.85):
        for z in (3.02, 4.55, 6.08):
            _windows(shade, [-2.92, -.92, 1.08, 3.08], y, z, 1.6, 1.03)
        for x, z in ((-2.77, 3.02), (2.60, 3.02), (-2.77, 6.08), (2.60, 6.08)):
            brick.box((x, y, z - .06), (2.65, .72, .25))
    _windows(shade, [-2.46, -.46, 1.54], -2.05, 7.85, 1.34, .86)
    _windows(shade, [2.04], -1.42, 9.12, .75, .56)
    for part in (walls, brick, shade):
        part.finish()


def highrise():
    wall = Part("Modern tower | chamfered podium and shaft", "cityWall")
    trim = Part("Modern tower | setback bands and crown", "cityRoof")
    glass = Part("Modern tower | vertical window stacks", "cityShade")
    wall.box((0, 0, 1.35), (9.72, 6.8, 2.7))
    trim.box((0, 0, 2.78), (9.90, 7.0, .22))
    # Two clipped street corners make the tall narrow shaft legible from the oblique map camera.
    shaft = [(-3.32,-1.70), (-2.47,-2.55), (2.49,-2.55), (3.32,-1.72),
             (3.32,1.76), (2.55,2.53), (-2.50,2.53), (-3.32,1.71)]
    wall.prism(shaft, 2.88, 14.42)
    trim.prism(shaft, 14.42, 14.65)
    wall.box((.18,.15,15.94), (4.84,3.90,2.58))
    trim.box((.18,.15,17.31), (4.98,4.02,.18))
    wall.box((.65,.25,18.00), (2.70,2.66,1.22))
    trim.box((.65,.25,18.72), (2.76,2.72,.22))
    for y in (-2.56, 2.54):
        _windows(glass, [-1.48, 0, 1.48], y, 3.48, .82, 10.67)
    for x in (-3.33, 3.33):
        # Deep vertical reveals on the narrow ends continue the rhythm on a rotated instance.
        for y in (-.80, .80):
            v = [(x,y-.32,3.48), (x,y+.32,3.48), (x,y+.32,14.15), (x,y-.32,14.15)]
            glass.solid(v, [(0,1,2,3) if x > 0 else (3,2,1,0)])
    for y in (-1.81, 2.11):
        _windows(glass, [-.96, .37, 1.62], y, 14.98, .64, 1.86)
    _windows(glass, [-3.15, -1.05, 1.05, 3.15], -3.41, .23, 1.33, 1.75)
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
        trim.box((bay, face + .14, height - .93), (pitch - .31, .17, .105))
        trim.box((bay, face + .10, height / 2 - .13), (.075, .27, height - .67))
    trim.box((entry, face - .20, height - .86), (2.04, .84, .15))
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
    trim = Part("Terrace tower | balcony slabs, shopfront and stair crown", "cityBrick")
    glass = Part("Terrace tower | shaded balconies and street glazing", "cityShade")
    _podium(wall, trim, glass, 10.20, 6.98, 3.48, -1.13)
    terrace_levels = [(3.49, 10.08, 7.28, 5.56, -.51), (10.08, 16.14, 6.19, 4.86, -.05),
                      (16.14, 21.41, 5.11, 4.18, .42), (21.41, 24.82, 3.85, 3.44, .84)]
    for low, high, width, depth, x in terrace_levels:
        wall.box((x, .09, (low + high) / 2), (width - .62, depth - .55, high - low))
        floors = round((high - low) / 1.67)
        rise = (high - low) / floors
        for f in range(floors):
            lower = low + f * rise
            trim.box((x, .09, lower + .23), (width + .035, depth, .41))
            for y in (.09 - depth / 2 + .25, .09 + depth / 2 - .25):
                toward = -1 if y < 0 else 1
                _windows(glass, [x - width * .23, x + width * .20], y + toward * .039,
                         lower + .55, width * .31, rise - .73)
            # Freestanding lift core is the uninterrupted vertical element through the setbacks.
        trim.box((x, .09, high - .045), (width + .14, depth + .13, .22))
    wall.box((2.67, .87, 13.33), (1.45, 3.68, 19.72))
    _windows(glass, [2.68], -.98, 4.20, .58, 18.12)
    wall.box((1.48, .83, 25.13), (1.88, 1.95, .73))
    trim.box((1.48, .83, 25.57), (2.10, 2.13, .24))
    for part in (wall, trim, glass):
        part.finish()


def slab_tower():
    """Office slab with a glazed reveal and unequal sloping roof shoulders."""
    wall = Part("Slab tower | office slabs and corner piers", "cityWall")
    trim = Part("Slab tower | metal fins, setback belt and sloping crowns", "cityRoof")
    glass = Part("Slab tower | curtain-wall panes and lobby glazing", "cityShade")
    _podium(wall, trim, glass, 9.96, 7.50, 4.15, 1.13)
    # The gallery recess separates the slabs all the way to the top of the lower shoulder.
    trim.box((0, .14, 4.22), (9.35, 6.68, .27))
    glass.box((.03, .35, 12.93), (1.51, 3.17, 17.25))
    for x, width, top, ridge, sign in ((-2.05, 3.46, 28.5, 30.92, -1),
                                       (2.12, 3.54, 21.0, 23.44, 1)):
        low, depth = 4.28, 4.64
        wall.box((x, .04, (low + top) / 2), (width, depth, top - low))
        a, b = x - width / 2 - .12, x + width / 2 + .12
        ha, hb = (top + .16, ridge) if sign < 0 else (ridge, top + .16)
        _section(trim, [(a, top - .08), (b, top - .08), (b, hb), (a, ha)], -2.40, 2.48)
        for y in (-2.295, 2.375):
            for offset in (-width * .245, 0, width * .245):
                _windows(glass, [x + offset], y, low + .46, width * .215, top - low - 1.02)
            for f in range(2, round((top - low) / 3.5), 2):
                trim.box((x, y, low + f * 3.45), (width + .09, .22, .26))
        side = x + sign * (width / 2 + .018)
        for y in (-1.42, -.47, .48, 1.43):
            lo, hi, a, b = low + .48, top - .48, y - .34, y + .34
            glass.solid([(side, a, lo), (side, b, lo), (side, b, hi), (side, a, hi)],
                        [(0, 1, 2, 3) if sign > 0 else (3, 2, 1, 0)])
    for part in (wall, trim, glass):
        part.finish()
