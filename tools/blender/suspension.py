"""Yingwuzhou Yangtze River Bridge, modeled along Blender's Y axis."""
from math import cos, hypot, sin, tau

from bridge import deck_ribbon, loft, side_plate
from mesh import Part


# Proportions use the four-span design described by the bridge builder:
# https://www.cbridge.com.cn/newsinfo/6069721.html
# The centre tower has an A-shaped longitudinal elevation. The side towers are straight.
HALF_LENGTH = 100
SIDE_TOWER = 71.5
ANCHOR = 91
DECK = 7.70
CABLE_X = 7.34
SADDLES = ((-ANCHOR, 6.45), (-SIDE_TOWER, 32.20), (0, 36.10),
           (SIDE_TOWER, 32.20), (ANCHOR, 6.45))


def road_height(y):
    return DECK - max(0, abs(y) - SIDE_TOWER) * .095


def chamfered_ring(x, y, z, width, depth, cut):
    a, b = width/2, depth/2
    outline = [(-a+cut, -b), (a-cut, -b), (a, -b+cut), (a, b-cut),
               (a-cut, b), (-a+cut, b), (-a, b-cut), (-a, -b+cut)]
    return [(x+dx, y+dy, z) for dx, dy in outline]


def towers():
    stone = Part("Yingwuzhou / capped concrete piers and cable anchorages", "stone")
    orange = Part("Yingwuzhou / three orange suspension towers", "suspensionOrange")
    saddles = Part("Yingwuzhou / main-cable saddles and bearing plates", "shadow")
    pale = Part("Yingwuzhou / saddle access platforms and rails", "plaster")
    for y, top in SADDLES[1:-1]:
        center_tower = y == 0
        depth = 16.5 if center_tower else 8.9
        loft(stone, [chamfered_ring(0, y, z, w, d, cut) for z, w, d, cut in
                     ((-3.2, 23.5, depth+1, 1.4), (-.12, 23.5, depth+1, 1.4),
                      (.44, 22.6, depth, 1.3), (.69, 22.6, depth, 1.3))])
        landing = 7.05 if center_tower else 6.20
        for side in (-1, 1):
            x = side*CABLE_X
            if center_tower:
                for direction in (-1, 1):
                    # Both longitudinal legs meet the same saddle; the road threads between them.
                    loft(orange, [chamfered_ring(side*8.10, y+direction*spread, z, w, d, cut)
                                  for z, spread, w, d, cut in
                                  ((.61, 6.60, 3.10, 3.82, .31), (6.72, 5.82, 2.96, 3.63, .29))])
                    loft(orange, [chamfered_ring(side*xx, y+direction*spread, z, w, d, cut)
                                  for z, xx, spread, w, d, cut in
                                  ((6.64, 8.10, 5.84, 2.87, 3.42, .26),
                                   (8.23, 8.08, 5.47, 2.71, 3.30, .25),
                                   (top-1.98, 7.36, .67, 2.45, 2.95, .23))])
                loft(orange, [chamfered_ring(x, y, z, w, d, cut) for z, w, d, cut in
                              ((top-2.33, 2.55, 3.74, .24), (top+.58, 2.53, 3.55, .24))])
            else:
                loft(orange, [chamfered_ring(side*xx, y, z, w, d, cut) for z, xx, w, d, cut in
                              ((.61, 8.03, 2.84, 3.15, .26), (DECK, 7.88, 2.68, 2.83, .24),
                               (top+.58, CABLE_X, 2.42, 2.41, .21))])
            # Shallow metal covers and working platforms are visible at every cable crest.
            saddles.box((x, y, top-.06), (.84, 2.88, .43))
            orange.box((x, y, top+.47), (2.7, 2.78, .19))
            for dx in (-1.18, 1.18):
                pale.box((x+dx, y, top+.69), (.05, 2.59, .07))
                for dy in (-1.24, 0, 1.24):
                    pale.box((x+dx, y+dy, top+.57), (.06, .06, .28))
            for dy in (-1.24, 1.24):
                pale.box((x, y+dy, top+.69), (2.39, .05, .07))
        orange.box((0, y, landing-.65), (15.91, 3.23, 1.61))
        for x in (-5.34, 5.34):
            saddles.box((x, y, road_height(y)-1.17), (1.06, 1.63, .43))
        # Faceted haunches on the upper crossbeam leave the characteristic tall, open portal.
        outline = [(-7.83, top-3.31), (-5.90, top-3.06), (-3.60, top-2.55),
                   (0, top-2.01), (3.60, top-2.55), (5.90, top-3.06), (7.83, top-3.31),
                   (7.83, top-1.12), (-7.83, top-1.12)]
        vertices = [(u, y+dy, z) for dy in (-1.03, 1.03) for u, z in outline]
        n = len(outline)
        faces = [tuple(range(n)), tuple(reversed(range(n, n*2)))]
        faces.extend((i, i+n, (i+1)%n+n, (i+1)%n) for i in range(n))
        orange.solid(vertices, faces)
    for sign in (-1, 1):
        for span, width in ((83, 12.8), (97.2, 13.1)):
            y = sign*span
            h = road_height(y)
            loft(stone, [chamfered_ring(0, y, z, w, d, c) for z, w, d, c in
                         ((-2.9, width-1, 3.45, .36), (h-1.70, width-2.1, 2.16, .30),
                          (h-1.17, width, 2.68, .39))])
        for x in (-CABLE_X, CABLE_X):
            y = sign*ANCHOR
            loft(stone, [chamfered_ring(x, y, z, w, d, c) for z, w, d, c in
                         ((-1.9, 4.82, 7.6, .48), (2.6, 4.36, 7.2, .42),
                          (5.22, 3.88, 6.8, .38), (7.12, 3.67, 6.0, .37))])
    for part in (stone, orange, saddles, pale):
        part.finish()


def cables():
    cables = Part("Yingwuzhou / continuous twin main cables", "suspensionOrange")
    hangers = Part("Yingwuzhou / paired hangers and anchor sockets", "suspensionOrange")
    clamps = Part("Yingwuzhou / main-cable bands", "timber")
    for x in (-CABLE_X, CABLE_X):
        path, suspended = [], []
        for i, ((start, z0), (stop, z1)) in enumerate(zip(SADDLES, SADDLES[1:])):
            main = i in (1, 2)
            samples = 48 if main else 16
            sag = 22.75 if main else .79
            for k in range(samples):
                t = k/samples
                y = start + (stop-start)*t
                z = z0 + (z1-z0)*t - sag*4*t*(1-t)
                path.append((y, z))
                if main and 1 < k < samples-1 and k%2 == 0:
                    suspended.append((y, z))
        path.append(SADDLES[-1])

        def ring(index, radius):
            prev_y, prev_z = path[max(0, index-1)]
            next_y, next_z = path[min(len(path)-1, index+1)]
            dy, dz = next_y-prev_y, next_z-prev_z
            length = hypot(dy, dz)
            y, z = path[index]
            return [(x+radius*cos(j*tau/8),
                     y+dz/length*radius*sin(j*tau/8),
                     z-dy/length*radius*sin(j*tau/8)) for j in range(8)]

        loft(cables, [ring(i, .228) for i in range(len(path))])
        for y, z in suspended:
            # Two rods land in sockets on each roadway edge at each cable band.
            clamps.beam((x, y-.16, z), (x, y+.16, z), .51)
            for dy in (-.10, .10):
                bottom = road_height(y) + .12
                hangers.cylinder(x, y+dy, bottom-.28, z, .040, 6)
                hangers.cylinder(x, y+dy, bottom-.36, bottom+.15, .086, 8)
    for part in (cables, hangers, clamps):
        part.finish()


def deck():
    paving = Part("Yingwuzhou / eight-lane road and orthotropic deck", "deck")
    girders = Part("Yingwuzhou / steel box girder edges and cross girders", "suspensionOrange")
    sidewalk = Part("Yingwuzhou / walks and dashed lane dividers", "plaster")
    fencing = Part("Yingwuzhou / pedestrian and median barriers", "steel")
    lighting = Part("Yingwuzhou / hooked roadway lamp standards", "suspensionOrange")
    luminaires = Part("Yingwuzhou / oval luminaire lenses", "plaster")
    stations = (-HALF_LENGTH, -SIDE_TOWER, SIDE_TOWER, HALF_LENGTH)
    deck_ribbon(paving, 0, 15.47, stations, 0, .43, road_height)
    deck_ribbon(girders, 0, 12.88, stations, -.38, .79, road_height)
    deck_ribbon(sidewalk, 0, .48, stations, .10, .16, road_height)
    for side in (-1, 1):
        x = side * 7.42
        deck_ribbon(girders, x, .66, stations, -.11, .83, road_height)
        deck_ribbon(sidewalk, side*7.15, .93, stations, .15, .21, road_height)
        for h in (.34, .97):
            deck_ribbon(fencing, side*7.63, .09, stations, h, .091, road_height)
        for y in range(-99, 100, 3):
            z = road_height(y)
            fencing.box((side*7.63, y, z+.52), (.10, .11, .77))
            for lane in range(1, 4):
                line = side * 2.0 * lane
                edge = sorted({y-.47, y+.47, *(p for p in stations if abs(p-y) < .47)})
                deck_ribbon(sidewalk, line, .065, edge, .010, .017, road_height)
        for y in range(-90, 91, 10):
            z = road_height(y)
            lighting.cylinder(x, y, z+.13, z+3.57, .079, 8)
            hook = [(x-side*dx, y, z+dz) for dx, dz in ((0, 3.47), (.55, 3.55),
                                                       (1.00, 3.74), (1.31, 3.78))]
            for a, b in zip(hook, hook[1:]):
                lighting.beam(a, b, .103)
            luminaires.box((x-side*1.29, y, z+3.72), (.42, .19, .13))
    for y in range(-96, 97, 4):
        z = road_height(y)
        girders.box((0, y, z-.79), (15.21, .28, .40))
    for y in range(-96, 97, 6):
        fencing.box((0, y, road_height(y)+.42), (.089, .105, .66))
    deck_ribbon(fencing, 0, .080, stations, .76, .09, road_height)
    for part in (paving, girders, sidewalk, fencing, lighting, luminaires):
        part.finish()


def build():
    towers()
    cables()
    deck()
