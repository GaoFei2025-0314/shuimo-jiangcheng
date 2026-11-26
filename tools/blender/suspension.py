"""Yingwuzhou Yangtze River Bridge, modeled along Blender's Y axis."""
from math import cos, hypot, sin, tau

import bmesh
import bpy

from bridge import deck_ribbon, loft
from mesh import Part


# Four-span design by China Railway Major Bridge Engineering Group.
# https://www.crecg.com/web/xwzx61/zfgsdt39/2025021110090542360/index.html
# Portal, lettering and railing details use the Hanyang tourism photo gallery.
# https://hanyang.hmltec.com/index.php?c=show&id=227
# The centre tower has an A-shaped longitudinal elevation. The side towers taper gently.
# The contractor distinguishes the concrete lower frame from the steel upper tower.
# https://www.crecg.com/web/xwzx61/zfgsdt39/2025021110084953628/index.html
HALF_LENGTH = 100
SIDE_TOWER = 71.5
ANCHOR = 91
DECK = 7.70
CABLE_X = 7.34
GIRDER_X = 6.50
GIRDER_BOTTOM = -1.66
SADDLES = ((-ANCHOR, 6.45), (-SIDE_TOWER, 32.20), (0, 36.10),
           (SIDE_TOWER, 32.20), (ANCHOR, 6.45))


def road_height(y):
    return DECK - max(0, abs(y) - SIDE_TOWER) * .095


def cable_height(span, y):
    (start, low), (stop, high) = SADDLES[span:span+2]
    run = stop - start
    sag = 22.75 if span in (1, 2) else .79
    t = (y - start) / run
    height = low + (high-low)*t - 4*sag*t*(1-t)
    # Ease the approach to the saddles so adjacent spans share a horizontal tangent there.
    for distance, slope, at_tower in ((y-start, (high-low-4*sag)/run, span > 0),
                                      (stop-y, (low-high-4*sag)/run, span < 3)):
        if at_tower and distance < 2.5:
            height -= slope * distance * (1-distance/2.5)**2
    return height


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
    metalwork = Part("Yingwuzhou / portal fascias and inspection platforms", "vermilion")
    for tower, (y, top) in enumerate(SADDLES[1:-1], start=1):
        center_tower = y == 0
        depth = 16.5 if center_tower else 8.9
        loft(stone, [chamfered_ring(0, y, z, w, d, cut) for z, w, d, cut in
                     ((-3.2, 23.5, depth+1, 1.4), (-.12, 23.5, depth+1, 1.4),
                      (.44, 22.6, depth, 1.3), (.69, 22.6, depth, 1.3))])
        girder_bottom = road_height(y) + GIRDER_BOTTOM
        landing = girder_bottom - .29
        crown_floor = top-(2.62 if center_tower else 2.08)
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
                                   (crown_floor+.03, 7.36, .67, 2.45, 2.30, .23))])
                    # The narrow splice collar marks the material junction at the roadway frame.
                    loft(metalwork, [chamfered_ring(side*8.10, y+direction*5.83, z,
                                                    2.98, 3.66, .28)
                                      for z in (6.64, 6.75)])
                loft(orange, [chamfered_ring(x, y, z, w, d, cut) for z, w, d, cut in
                              ((crown_floor-.36, 2.55, 3.74, .24), (crown_floor, 2.53, 3.55, .24))])
            else:
                loft(orange, [chamfered_ring(side*xx, y, z, w, d, cut) for z, xx, w, d, cut in
                              ((.61, 8.18, 3.16, 3.42, .31), (DECK, 7.97, 2.85, 3.01, .28),
                               (crown_floor, CABLE_X, 2.24, 2.34, .25))])
            # The cable axis at the saddle is shared with cables(). Both ends of the cover are open.
            crown_depth = 2.78 if center_tower else 2.30
            pedestal_height = top-.45-crown_floor
            orange.box((x, y, crown_floor + pedestal_height/2), (1.04, .55, pedestal_height))
            saddle_rings = []
            for offset in (-.66, -.33, 0, .33, .66):
                station = y + offset
                seat = cable_height(tower - (offset < 0), station) - .22
                saddle_rings.append([(x+dx, station, seat-dz) for dx, dz in
                                     ((-.52, 0), (.52, 0), (.52, .28), (-.52, .28))])
            loft(saddles, saddle_rings)
            for dx in (-.78, .78):
                cheek_height = top+.29-crown_floor
                orange.box((x+dx, y, crown_floor+cheek_height/2), (.48, crown_depth, cheek_height))
            metalwork.box((x, y, top+.415), (2.40, crown_depth, .25))
            # The existing access rails flank the housing.
            for dx in (-1.17, 1.17):
                pale.box((x+dx, y, top+.68), (.05, crown_depth-.14, .06))
                for dy in (-crown_depth*.42, 0, crown_depth*.42):
                    pale.box((x+dx, y+dy, top+.51), (.057, .061, .35))
            # Orange maintenance stages wrap the edge towers just beneath the road.
            if not center_tower:
                foot, platform = side*7.88, DECK-1.33
                metalwork.box((foot, y, platform), (3.38, 3.59, .25))
                for dx in (-1.61, 1.61):
                    orange.box((foot+dx, y, platform+.47), (.08, 3.55, .08))
                    for dy in (-1.75, 1.75):
                        orange.box((foot+dx, y+dy, platform+.22), (.08, .09, .50))
                for dy in (-1.75, 1.75):
                    orange.box((foot, y+dy, platform+.47), (3.27, .08, .08))
        # The centre portal spans both longitudinal legs, with bearings under the main beams.
        beam_depth = 10.7 if center_tower else 3.46
        loft(orange, [chamfered_ring(0, y, z, w, d, cut) for z, w, d, cut in
                      ((landing-1.64, 16.20, beam_depth-.55, .28),
                       (landing-1.28, 16.58, beam_depth, .28),
                       (landing, 16.58, beam_depth, .28))])
        for side in (-1, 1):
            saddles.box((side*GIRDER_X, y, (landing+girder_bottom)/2), (1.14, 1.72, .33))
        # Faceted haunches on the upper crossbeam leave the characteristic tall, open portal.
        outline = [(-7.83, top-3.78), (-5.90, top-3.51), (-3.60, top-3.03),
                   (0, top-2.75), (3.60, top-3.03), (5.90, top-3.51), (7.83, top-3.78),
                   (7.83, top-1.12), (-7.83, top-1.12)]
        vertices = [(u, y+dy, z) for dy in (-1.03, 1.03) for u, z in outline]
        n = len(outline)
        faces = [tuple(range(n)), tuple(reversed(range(n, n*2)))]
        faces.extend((i, i+n, (i+1)%n+n, (i+1)%n) for i in range(n))
        orange.solid(vertices, faces)
        for direction in (-1, 1):
            face = y+direction*1.04
            metalwork.box((0, face, top-1.16), (12.33, .16, .15))
            # A shallow inspection walk under the crown frames the haunched beam.
            edge = face+direction*.30
            pale.box((0, edge, top-.63), (11.75, .05, .058))
            metalwork.box((0, face+direction*.18, top-1.12), (11.74, .36, .12))
            for x in (-5.84, -2.93, 0, 2.93, 5.84):
                pale.box((x, edge, top-.86), (.059, .055, .46))
    for sign in (-1, 1):
        for span, width in ((83, 12.8), (97.2, 13.1)):
            y = sign*span
            h = road_height(y)
            loft(stone, [chamfered_ring(0, y, z, w, d, c) for z, w, d, c in
                         ((-2.9, width-1, 3.45, .36), (h+GIRDER_BOTTOM-.54, width-2.1, 2.16, .30),
                          (h+GIRDER_BOTTOM+.02, width, 2.68, .39))])
        for x in (-CABLE_X, CABLE_X):
            y = sign*ANCHOR
            loft(stone, [chamfered_ring(x, y, z, w, d, c) for z, w, d, c in
                         ((-1.9, 4.82, 7.6, .48), (2.6, 4.36, 7.2, .42),
                          (5.22, 3.88, 6.8, .38), (7.12, 3.67, 6.0, .37))])
    for part in (stone, orange, saddles, pale, metalwork):
        part.finish()


def cables():
    cables = Part("Yingwuzhou / continuous twin main cables", "suspensionOrange")
    hangers = Part("Yingwuzhou / paired hangers and anchor sockets", "suspensionOrange")
    clamps = Part("Yingwuzhou / main-cable bands", "vermilion")
    sockets = Part("Yingwuzhou / hanger clevises and edge-girder anchorage", "vermilion")
    maintenance = Part("Yingwuzhou / main-cable access handlines", "suspensionOrange")
    for x in (-CABLE_X, CABLE_X):
        path, hung, walks = [], [], []
        for i, ((start, _), (stop, _)) in enumerate(zip(SADDLES, SADDLES[1:])):
            main = i in (1, 2)
            samples = 48 if main else 12
            supports = []
            for k in range(samples):
                # Keep the hanger stations and sample the approach trims more closely.
                near_saddle = (i == 0 and k >= samples-2) or (i == 3 and k < 2)
                subdivisions = 3 if main or near_saddle else 1
                for sub in range(subdivisions):
                    t = (k+sub/subdivisions)/samples
                    y = start + (stop-start)*t
                    z = cable_height(i, y)
                    index = len(path)
                    path.append((y, z))
                    if main and sub == 0 and 0 < k < samples:
                        supports.append(index)
                        if 1 < k < samples-1 and k%2 == 0:
                            hung.append(index)
            if main:
                walks.append(supports)
        path.append(SADDLES[-1])

        def ring(index, radius, sides=8, along=0):
            prev_y, prev_z = path[max(0, index-1)]
            next_y, next_z = path[min(len(path)-1, index+1)]
            dy, dz = next_y-prev_y, next_z-prev_z
            length = hypot(dy, dz)
            y, z = path[index]
            return [(x+radius*cos(j*tau/sides),
                     y+(dz*radius*sin(j*tau/sides)+dy*along)/length,
                     z+(-dy*radius*sin(j*tau/sides)+dz*along)/length) for j in range(sides)]

        loft(cables, [ring(i, .248, sides=10) for i in range(len(path))])
        # Decimate the denser cable stations for the thin handlines, keeping both ends and every post.
        for supports in walks:
            span = sorted(set(range(supports[0], supports[-1]+1, 2)) |
                          set(supports[::8]) | {supports[-1]})
            for side in (-1, 1):
                loft(maintenance, [[(px + side * .31, py, pz + .44)
                                   for px, py, pz in ring(index, .038, 4)]
                                  for index in span])
                for index in supports[::8]:
                    y, z = path[index]
                    maintenance.beam((x + side * .18, y, z + .02),
                                     (x + side * .31, y, z + .44), .052)
        for index in hung:
            y, z = path[index]
            # The split clamp sleeves follow the actual cable tangent in both main spans.
            loft(clamps, [ring(index, radius, sides=8, along=along)
                          for along, radius in ((-.24, .254), (-.18, .301), (.18, .301), (.24, .254))])
            sockets.box((x, y, z-.30), (.33, .43, .24))
            bottom = road_height(y)
            # One common side plate carries both sockets into the wind nose, as on the bridge.
            sign = 1 if x > 0 else -1
            outboard = sign*(CABLE_X+.35)
            sockets.box((outboard, y, bottom-.20), (.24, .64, .52))
            hangers.box(((x+outboard)/2, y, bottom+.017), (.56, .63, .16))
            # Two small sloping ribs seat the projecting top flange against the plate.
            profile = [(sign*7.60, bottom-.36), (sign*7.94, bottom+.037), (sign*7.55, bottom+.041)]
            if sign < 0:
                profile.reverse()
            for dy in (-.215, .215):
                vertices = [(px, y+dy+offset, pz)
                            for offset in (-.034, .034) for px, pz in profile]
                sockets.solid(vertices, [(0, 1, 2), (5, 4, 3), (0, 3, 4, 1),
                                         (1, 4, 5, 2), (2, 5, 3, 0)])
            for dy in (-.13, .13):
                hangers.cylinder(x, y+dy, bottom+.08, z-.39, .057, 6)
                sockets.cylinder(x, y+dy, bottom+.023, bottom+.44, .102, 6)
    for part in (cables, hangers, clamps, sockets, maintenance):
        obj = part.finish()
        # Native shading follows the round tubes; the web export derives normals from indexed rings.
        if part in (cables, maintenance):
            for polygon in obj.data.polygons:
                polygon.use_smooth = True


def deck_section(part, stations, profile):
    """Sweep a counter-clockwise cross section with the bridge grade."""
    loft(part, [[(x, y, road_height(y) + lift) for x, lift in reversed(profile)] for y in stations])


def deck():
    paving = Part("Yingwuzhou / eight-lane road and orthotropic deck", "deck")
    girders = Part("Yingwuzhou / open steel main beams, cross beams and wind noses", "suspensionOrange")
    access = Part("Yingwuzhou / wind-nose inspection walks and guards", "vermilion")
    sidewalk = Part("Yingwuzhou / walks and dashed lane dividers", "plaster")
    fencing = Part("Yingwuzhou / orange pedestrian and median barriers", "suspensionOrange")
    lighting = Part("Yingwuzhou / hooked roadway lamp standards", "suspensionOrange")
    luminaires = Part("Yingwuzhou / oval luminaire lenses", "plaster")
    stations = (-HALF_LENGTH, -SIDE_TOWER, SIDE_TOWER, HALF_LENGTH)
    deck_ribbon(paving, 0, 15.47, stations, 0, .43, road_height)
    deck_ribbon(sidewalk, 0, .48, stations, .10, .16, road_height)
    # Two open main beams with a wind nose outside each one. The floor between them is open underneath.
    main = [(-.42, GIRDER_BOTTOM), (.42, GIRDER_BOTTOM), (.42, -1.40), (.15, -1.40),
            (.15, -.67), (.43, -.67), (.43, -.38), (-.43, -.38), (-.43, -.67),
            (-.15, -.67), (-.15, -1.40), (-.42, -1.40)]
    nose = [(6.58, -.74), (7.37, -.65), (7.77, -.31), (7.77, -.05), (7.43, .02), (6.58, -.33)]
    for side in (-1, 1):
        x = side * 7.42
        deck_section(girders, (-97.2, -SIDE_TOWER, SIDE_TOWER, 97.2),
                     [(side*GIRDER_X+dx, z) for dx, z in main])
        for start, stop in ((-HALF_LENGTH, -97.2), (97.2, HALF_LENGTH)):
            deck_ribbon(girders, side*GIRDER_X, .86, (start, stop), -.38, .79, road_height)
        profile = [(side*px, z) for px, z in nose]
        deck_section(girders, stations, profile if side > 0 else profile[::-1])
        for start, stop in ((-68.5, -7.5), (7.5, 68.5)):
            deck_ribbon(access, side*7.32, .78, (start, stop), -1.31, .26, road_height)
            deck_ribbon(access, side*7.69, .26, (start, stop), -.58, .25, road_height)
            for i in range(13):
                y = start + (stop-start)*i/12
                z = road_height(y)
                access.box((side*7.69, y, z-.99), (.26, .26, .67))
                girders.box((side*7.04, y, z-1.56), (1.27, .30, .25))
        deck_ribbon(sidewalk, side*7.15, .93, stations, .15, .21, road_height)
        for h in (.29, .99):
            deck_ribbon(fencing, side*7.63, .13, stations, h, .11, road_height)
        for post in range(-66, 67):
            y = post*1.5
            z = road_height(y)
            fencing.box((side*7.63, y, z+.57), (.12, .15, .82))
        for y in range(-99, 100, 3):
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
        girders.box((0, y, z-.90), (13.44, .31, 1.00))
    for y in range(-96, 97, 6):
        fencing.box((0, y, road_height(y)+.42), (.089, .105, .66))
    deck_ribbon(fencing, 0, .080, stations, .76, .09, road_height)
    for part in (paving, girders, access, sidewalk, fencing, lighting, luminaires):
        part.finish()


# Glyph outlines from LXGW WenKai Medium, © The LXGW WenKai Project Authors.
# https://github.com/lxgw/LxgwWenKai — SIL Open Font License 1.1.
# The embedded outlines preserve the lettering on hosts without a Chinese font.
GLYPH_OUTLINES = {
    '鹦': (
        '-420,-98 -430,-94 -434,-80 -422,-56 -376,-10 -347,42 -330,114 -326,150 -325,198 -324,260 '
        '-331,284 -326,299 -311,304 -283,296 -270,286 -265,270 -266,208 -268,157 -271,120 -290,33 '
        '-315,-16 -353,-58 -403,-93',
        '-165,-244 -109,-159 -210,-164 -223,-184 -245,-210 -196,-230',
        '-422,-422 -442,-419 -448,-409 -441,-396 -420,-385 -336,-354 -267,-321 -214,-288 -266,-266 '
        '-296,-254 -311,-242 -316,-218 -308,-198 -286,-168 -390,-171 -424,-162 -443,-137 -447,-117 '
        '-438,-108 -423,-111 -396,-114 -247,-108 -234,-69 -235,-59 -232,-43 -222,-38 -200,-45 -178,-60 '
        '-166,-75 -157,-52 -120,-5 -96,47 -82,120 -79,155 -78,204 -77,267 -80,280 -83,291 -78,305 '
        '-62,310 -37,302 -25,292 -21,276 -22,214 -24,164 -26,126 -41,40 -61,-9 -92,-51 -132,-86 -151,-92 '
        '-164,-85 -170,-102 -171,-104 -105,-101 -52,-99 -13,-97 13,-95 25,-93 47,-89 59,-93 76,-104 '
        '90,-119 95,-132 84,-149 66,-151 28,-153 -31,-156 -68,-220 -105,-270 -46,-298 -6,-318 14,-331 '
        '28,-351 24,-368 11,-390 -3,-397 -21,-390 -59,-368 -154,-317 -225,-361 -310,-394 -363,-410 '
        '-401,-419',
        '-200,-43 -211,-38 -228,-22 -272,14 -282,32 -270,52 -250,62 -234,55 -204,34 -176,9 -167,-8 '
        '-180,-32',
        '47,-70 29,-58 6,-28 -25,6 -32,24 -22,43 -4,54 15,44 46,16 72,-16 81,-38 66,-62',
        '98,-248 70,-235 52,-208 46,-192 49,-182 59,-179 93,-184 106,-184 135,-182 180,-180 224,-178 '
        '254,-176 268,-174 284,-170 300,-168 312,-172 330,-184 344,-200 349,-213 342,-229 321,-236 '
        '128,-246',
        '359,-453 332,-448 301,-431 267,-404 237,-375 219,-352 213,-335 217,-327 228,-324 257,-335 '
        '281,-348 308,-360 334,-372 345,-376 348,-367 352,-340 359,-294 368,-230 372,-192 376,-138 '
        '379,-69 154,-85 149,-110 133,-119 105,-106 91,-93 86,-78 89,-54 90,-40 91,-9 92,38 93,101 '
        '95,180 96,276 90,326 84,352 89,362 103,366 123,360 154,342 165,344 198,407 211,446 210,464 '
        '215,478 229,483 263,466 277,449 282,435 277,420 262,391 236,349 349,359 378,344 393,320 388,297 '
        '362,51 359,22 349,5 333,-1 312,6 278,28 232,60 216,76 211,90 216,101 229,105 243,102 267,95 '
        '301,82 320,293 158,279 155,-23 399,-5 421,-9 436,-20 448,-41 446,-52 443,-61 438,-165 431,-253 '
        '421,-325 409,-381 395,-421 378,-445',
        '238,148 200,187 176,214 168,227 177,249 199,262 221,252 258,222 283,198 298,181 303,170 291,142 '
        '266,127 252,132',
        '-120,45 -134,48 -155,60 -162,78 -159,99 -156,130 -164,343 -174,380 -182,400 -178,408 -166,410 '
        '-146,406 -109,393 24,402 58,389 70,370 65,345 60,261 56,192 52,139 50,100 48,77 44,61 30,56 '
        '12,60 -8,72 -15,98 -13,102 -11,110 -8,118 -7,129 -5,157 -3,204 1,268 5,350 -107,342 -101,71 '
        '-106,52',
        '-364,51 -382,55 -402,65 -409,82 -409,92 -408,111 -406,144 -405,191 -405,254 -404,331 -414,370 '
        '-423,388 -419,396 -407,399 -388,394 -349,380 -241,388 -207,384 -186,372 -179,351 -183,328 '
        '-186,289 -190,234 -192,164 -195,78 -200,62 -213,57 -232,62 -250,73 -256,88 -251,129 -245,335 '
        '-348,328 -349,159 -344,74 -349,57',
    ),
    '鹉': (
        '251,140 245,140 234,145 221,160 172,204 153,222 146,235 156,256 178,269 202,260 241,231 267,209 '
        '283,192 288,181 276,156',
        '355,-453 326,-448 292,-431 253,-404 221,-375 202,-352 196,-335 200,-327 212,-324 227,-328 '
        '249,-338 271,-348 308,-364 329,-373 338,-376 342,-369 347,-349 353,-315 360,-268 371,-164 '
        '376,-69 131,-85 126,-110 109,-119 79,-106 64,-93 59,-78 62,-56 64,-41 65,-11 66,36 67,100 '
        '68,180 69,276 63,326 57,352 62,362 77,366 98,360 132,342 144,344 171,392 188,426 193,446 '
        '193,466 198,479 213,483 230,479 250,466 265,450 270,439 265,424 251,398 220,349 343,359 375,345 '
        '391,321 388,307 384,297 374,215 367,150 361,102 358,71 357,57 348,31 326,19 304,26 267,47 '
        '214,78 193,95 186,109 190,120 204,124 220,121 249,114 292,101 312,293 136,279 132,-23 397,-5 '
        '422,-9 438,-20 450,-41 448,-52 445,-61 439,-165 432,-253 421,-325 408,-381 393,-421 375,-445',
        '89,-248 61,-235 43,-208 37,-192 40,-182 50,-179 83,-184 97,-184 126,-182 172,-180 217,-178 '
        '246,-176 260,-174 277,-170 293,-168 306,-172 323,-184 338,-200 343,-213 336,-229 315,-236 '
        '119,-246',
        '-327,229 -335,229 -367,238 -387,265 -391,284 -381,295 -370,292 -351,290 -253,295 -228,300 '
        '-218,303 -185,286 -169,258 -178,242 -191,240 -220,237 -265,234',
        '-8,195 -26,206 -50,252 -72,286 -87,310 -92,324 -79,343 -57,353 -44,347 -27,328 -5,297 15,264 '
        '27,241 31,227 16,206',
        '-19,-413 -44,-405 -67,-380 -87,-338 -105,-280 -120,-205 -137,-88 -162,-98 -216,-101 -217,-242 '
        '-177,-226 -150,-216 -137,-213 -126,-216 -122,-226 -128,-238 -147,-255 -179,-277 -224,-303 '
        '-281,-334 -328,-357 -362,-370 -384,-375 -422,-362 -444,-335 -450,-319 -445,-310 -429,-307 '
        '-376,-300 -381,-49 -392,-11 -396,0 -392,9 -378,12 -346,6 -322,-6 -320,-16 -319,-40 -317,-78 '
        '-316,-130 -314,-197 -313,-278 -279,-266 -281,35 -288,68 -296,88 -292,96 -279,98 -246,92 -221,78 '
        '-216,57 -216,-42 -202,-38 -188,-35 -165,-42 -143,-63 -139,-70 -145,-4 -150,66 -154,111 -387,98 '
        '-413,103 -432,119 -444,146 -445,155 -435,165 -424,162 -404,159 -157,171 -162,256 -166,326 '
        '-167,362 -169,387 -170,400 -179,422 -182,429 -177,439 -162,442 -124,433 -107,422 -101,409 '
        '-98,319 -94,241 -90,174 -44,177 -14,180 -1,182 13,186 23,182 40,170 54,155 59,142 50,124 37,123 '
        '11,120 -31,117 -87,114 -80,20 -73,-61 -65,-128 -56,-181 -38,-262 -20,-321 -20,-322 -16,-303 '
        '-11,-263 -4,-201 2,-174 14,-165 27,-172 32,-192 34,-225 34,-270 25,-368 16,-393 1,-408',
    ),
    '洲': (
        '408,-452 390,-448 362,-432 348,-407 352,-382 354,-359 354,-321 350,383 349,413 344,428 338,442 '
        '342,452 352,455 376,452 404,443 421,431 426,414 428,-427 422,-446',
        '-198,-427 -211,-423 -216,-411 -204,-385 -144,-298 -100,-205 -72,-112 -56,-23 -44,257 -46,339 '
        '-48,367 -56,384 -62,398 -56,408 -38,412 4,403 22,391 28,374 28,282 26,152 20,40 10,-55 -4,-131 '
        '-29,-209 -65,-282 -111,-348 -168,-408 -185,-422',
        '-216,222 -242,238 -298,298 -358,349 -374,374 -362,398 -336,411 -321,406 -296,389 -262,362 '
        '-218,323 -192,299 -177,280 -172,268 -188,238',
        '-410,127 -428,150 -418,174 -392,189 -378,185 -355,171 -322,150 -273,115 -241,91 -223,74 -218,61 '
        '-224,48 -238,26 -258,14 -270,19 -289,32 -316,56',
        '-142,-103 -174,-92 -186,-71 -184,-60 -176,-39 -166,-7 -155,39 -146,87 -140,124 -137,150 '
        '-134,164 -116,171 -90,168 -76,160 -72,141 -88,22 -116,-85 -124,-98',
        '306,-68 289,-59 280,-33 262,41 228,128 224,146 234,161 264,169 279,164 288,150 293,141 301,120 '
        '314,89 332,40 344,4 350,-21 352,-37 348,-51 334,-60',
        '108,-67 84,-58 79,-42 74,-12 65,28 50,76 37,116 32,132 49,153 76,160 92,151 101,132 112,102 '
        '126,60 140,12 148,-21 148,328 146,355 142,370 136,384 141,394 154,398 188,392 213,378 222,358 '
        '222,-303 216,-323 200,-330 183,-326 156,-310 144,-279 146,-261 148,-238 148,-193 148,-43 '
        '136,-58',
        '-352,-397 -372,-392 -401,-383 -418,-372 -424,-359 -412,-343 -378,-310 -303,-178 -238,-47 '
        '-222,-22 -206,-13 -196,-18 -192,-33 -195,-50 -203,-82 -216,-126 -237,-185 -268,-258 -308,-346 '
        '-323,-374 -337,-391',
    ),
    '长': (
        '-455,54 -452,64 -441,68 -426,66 -402,63 -236,71 -236,372 -252,420 -258,435 -254,444 -242,447 '
        '-215,444 -178,430 -164,418 -160,402 -161,75 -32,82 78,87 169,92 241,96 345,103 364,106 385,98 '
        '413,76 422,54 414,38 390,31 5,12 56,-59 119,-129 215,-212 318,-278 428,-327 448,-338 455,-350 '
        '443,-372 416,-398 391,-407 388,-407 313,-372 235,-325 154,-266 66,-185 -12,-94 -80,8 -161,4 '
        '-162,-300 -96,-270 -45,-244 -7,-223 22,-212 25,-212 36,-216 40,-226 27,-252 10,-268 -17,-288 '
        '-98,-343 -168,-386 -223,-416 -258,-433 -292,-444 -316,-435 -345,-407 -360,-378 -354,-369 '
        '-328,-364 -294,-356 -242,-335 -237,-333 -237,1 -397,-6 -425,1 -448,27',
        '-130,119 -140,122 -144,133 -144,135 -138,147 -120,158 -8,222 91,294 142,340 175,377 190,406 '
        '197,422 208,427 234,414 253,386 260,364 249,342 172,266 89,206 2,160 -47,139 -86,127 -114,121',
    ),
    '江': (
        '-361,350 -377,371 -373,386 -360,407 -343,414 -324,407 -291,386 -245,352 -186,303 -171,279 '
        '-185,250 -198,235 -211,230 -230,240 -263,268 -308,308',
        '-166,-338 -186,-336 -197,-332 -218,-304 -228,-286 -232,-273 -228,-262 -215,-259 -159,-265 '
        '73,-257 78,208 -72,199 -94,200 -105,205 -139,260 -136,270 -125,273 -83,268 -70,269 -40,270 '
        '7,273 72,277 154,282 253,288 292,296 313,301 336,291 364,266 374,244 366,230 344,224 154,212 '
        '151,-255 230,-252 293,-250 339,-248 368,-246 380,-245 398,-242 419,-252 444,-276 455,-300 '
        '448,-313 427,-319',
        '-289,18 -308,27 -342,54 -437,126 -450,138 -455,150 -444,176 -424,191 -411,187 -386,174 -351,151 '
        '-304,117 -275,94 -257,77 -251,66 -264,36 -277,22',
        '-381,-416 -413,-409 -436,-397 -450,-384 -455,-373 -440,-358 -409,-330 -305,-176 -212,-25 '
        '-198,-6 -183,1 -173,-3 -170,-14 -173,-31 -183,-58 -198,-97 -220,-147 -268,-246 -309,-322 '
        '-331,-360 -347,-386 -356,-402',
    ),
    '大': (
        '-454,-429 -468,-426 -472,-415 -466,-401 -448,-386 -357,-325 -278,-257 -212,-184 -159,-104 '
        '-118,-18 -90,75 -168,71 -233,67 -282,65 -317,63 -336,62 -362,67 -382,82 -396,108 -402,130 '
        '-388,141 -340,136 -326,137 -292,138 -238,141 -166,146 -74,151 -62,254 -58,371 -72,418 -78,434 '
        '-73,443 -58,446 -22,438 14,419 28,387 21,261 10,155 294,172 324,178 344,183 366,173 396,148 '
        '406,125 397,107 372,100 40,82 109,-37 191,-144 284,-237 365,-298 452,-348 467,-358 472,-368 '
        '458,-390 429,-415 406,-423 394,-418 370,-405 284,-346 194,-264 115,-175 45,-76 -14,32 -47,-65 '
        '-96,-155 -162,-238 -252,-321 -352,-385 -398,-409 -433,-424',
    ),
    '桥': (
        '263,-456 240,-448 217,-428 207,-406 210,-375 212,-361 212,-332 213,-287 214,-226 214,-149 '
        '214,-56 204,-22 194,-2 199,8 215,12 251,4 278,-13 285,-36 286,-424 280,-448',
        '-131,-438 -143,-425 -138,-414 -123,-396 -58,-324 -11,-247 17,-165 26,-79 25,-50 23,-32 19,-26 '
        '17,-36 -20,-80 -68,-125 -106,-154 -128,-163 -144,-159 -149,-147 -135,-124 -76,-55 -27,17 -1,62 '
        '17,98 29,126 -49,122 -82,133 -105,165 -106,168 -127,160 -209,153 -210,97 -209,97 -190,90 '
        '-165,70 -133,36 -104,1 -86,-25 -80,-42 -97,-66 -125,-79 -138,-74 -151,-60 -184,-13 -200,10 '
        '-211,23 -216,-421 -222,-444 -240,-451 -260,-446 -282,-432 -295,-410 -290,-376 -286,-328 '
        '-286,-241 -286,-169 -286,-111 -285,-67 -285,-37 -284,-21 -296,-47 -317,-83 -349,-130 -391,-187 '
        '-424,-229 -449,-255 -465,-263 -474,-259 -477,-247 -466,-219 -371,-46 -287,145 -343,140 -379,137 '
        '-397,136 -416,141 -434,157 -447,176 -451,190 -448,202 -437,206 -405,203 -385,204 -280,213 '
        '-278,390 -286,420 -295,438 -290,448 -274,452 -238,444 -212,430 -206,408 -208,220 -183,223 '
        '-169,226 -154,229 -134,221 -111,203 -101,185 -94,186 -55,182 50,190 72,259 81,307 28,298 '
        '-11,292 -36,290 -60,294 -68,305 -56,320 -21,332 77,357 87,363 95,362 169,387 223,412 257,436 '
        '271,442 290,430 312,404 321,383 316,370 290,356 260,345 212,334 179,327 159,322 151,321 158,300 '
        '155,279 146,244 130,196 209,202 271,207 317,211 347,214 360,216 382,219 404,209 424,188 431,170 '
        '424,159 403,153 262,144 317,66 385,-4 464,-66 477,-81 469,-101 448,-127 427,-136 414,-132 '
        '392,-118 339,-73 287,-16 238,55 191,139 108,132 49,8 76,-1 93,-14 98,-30 98,-70 97,-100 95,-118 '
        '90,-148 80,-200 62,-260 33,-310 -28,-377 -97,-424 -120,-434',
    ),
}


def bridge_name():
    title = "鹦鹉洲长江大桥"
    lettering = Part("Yingwuzhou / 鹦鹉洲长江大桥 raised portal lettering", "enamelWhite")
    # Blender's curve fill preserves counters before the relief is welded into solids.
    relief = bpy.data.curves.new(title, 'CURVE')
    relief.dimensions = '2D'
    relief.fill_mode = 'BOTH'
    relief.extrude = .025
    for index, char in enumerate(title):
        for contour in GLYPH_OUTLINES[char]:
            points = [tuple(map(int, point.split(','))) for point in contour.split()]
            loop = relief.splines.new('POLY')
            loop.points.add(len(points) - 1)
            for point, (x, z) in zip(loop.points, points):
                point.co = ((index-3)*1.55 + x*.00144, z*.00122, 0, 1)
            loop.use_cyclic_u = True
    outlines = bpy.data.objects.new(title, relief)
    bpy.context.collection.objects.link(outlines)
    evaluated = outlines.evaluated_get(bpy.context.evaluated_depsgraph_get())
    glyphs = evaluated.to_mesh()
    welded = bmesh.new()
    try:
        welded.from_mesh(glyphs)
        bmesh.ops.remove_doubles(welded, verts=list(welded.verts), dist=1e-6)
        bmesh.ops.recalc_face_normals(welded, faces=list(welded.faces))
        welded.to_mesh(glyphs)
        faces = [tuple(face.vertices) for face in glyphs.polygons]
        # Across the middle tower, both directions have an unobstructed portal face.
        # The outer towers show the title on the faces seen on approach.
        signs = ((-SIDE_TOWER, SADDLES[1][1], 1), (0, SADDLES[2][1], 1),
                 (0, SADDLES[2][1], -1), (SIDE_TOWER, SADDLES[3][1], -1))
        for y, top, direction in signs:
            vertices = [(direction*v.co.x, y-direction*(1.09+v.co.z), top-1.85+v.co.y)
                        for v in glyphs.vertices]
            lettering.solid(vertices, faces)
    finally:
        welded.free()
        evaluated.to_mesh_clear()
        bpy.data.objects.remove(outlines, do_unlink=True)
        bpy.data.curves.remove(relief)
    lettering.finish()


def build():
    towers()
    cables()
    deck()
    bridge_name()
