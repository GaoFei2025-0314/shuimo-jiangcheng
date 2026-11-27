"""Yellow Crane Tower. Dimensions are in the map's exaggerated landmark units."""
from math import cos, hypot, sin, tau

import bmesh
import bpy

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
                # Each stair cheek has an outward cap, carved newels and a sloped handrail.
                coping.beam((*turn(x, -15.4, side), .43),
                            (*turn(x, -11.4, side), 2.86), .32, .26)
                for y, z in ((-15.34, .27), (-13.40, 1.45), (-11.46, 2.43)):
                    px, py = turn(x, y, side)
                    coping.box((px, py, z + .25), (.38, .39, .60))
                    coping.box((px, py, z + .58), (.48, .49, .13))
                    coping.cylinder(px, py, z + .65, z + .79, .143, 8)
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


# The west-facing fifth-floor gold inscription reads 黃鶴樓 from right to left.
# Outlines from LXGW WenKai TC Bold, © 2024 The LXGW WenKai Project Authors.
# https://github.com/lxgw/LxgwWenKaiTC — SIL Open Font License 1.1.
# Only the three scaled glyph outlines are used, with the title rendered as relief.
GLYPH_OUTLINES = {
    '樓': (
        '567,145 714,152 686,117 647,79 588,95 535,108 548,124',
        '600,363 600,317 494,312 487,357',
        '795,372 785,326 668,320 669,365',
        '601,554 600,513 515,508 512,549',
        '756,563 752,520 670,515 670,557',
        '601,649 601,610 506,604 503,643',
        '767,658 763,618 671,613 671,652',
        '264,-72 269,350 292,318 318,274 342,254 369,265 387,290 374,318 342,363 306,406 276,424 270,424 '
        '271,479 371,487 390,494 397,508 388,527 366,546 343,555 334,554 300,546 271,543 274,743 268,763 '
        '240,779 206,787 192,784 188,773 192,761 200,744 203,725 201,538 111,532 103,532 94,531 66,534 '
        '64,534 60,535 47,523 52,508 68,480 101,466 116,466 132,468 183,472 118,298 38,131 29,105 41,90 '
        '61,102 94,140 136,204 187,295 200,326 199,296 198,204 198,111 196,38 196,10 194,-16 189,-42 '
        '188,-50 187,-56 208,-88 240,-102 258,-94',
        '800,157 949,164 971,169 978,178 967,202 943,220 923,228 914,227 906,223 887,219 865,217 615,207 '
        '624,220 629,234 622,250 608,263 858,275 874,278 882,290 876,305 859,323 874,372 878,382 882,394 '
        '865,418 833,428 827,428 669,419 669,460 819,467 841,470 851,480 844,498 822,517 830,566 922,571 '
        '942,575 951,586 942,603 920,621 894,629 888,629 882,628 862,624 840,622 839,622 845,659 849,666 '
        '852,678 836,702 800,715 789,715 671,709 672,787 656,806 625,814 606,816 589,803 591,792 598,776 '
        '601,759 601,706 497,700 452,712 425,716 412,713 407,703 415,683 424,664 431,640 434,601 416,600 '
        '406,600 385,601 362,604 357,604 346,594 347,587 364,560 382,548 408,544 418,544 429,545 440,546 '
        '442,524 444,510 444,496 444,486 442,476 442,472 441,467 454,447 478,436 498,432 514,438 520,456 '
        '520,454 600,458 600,417 481,410 438,420 413,423 396,411 400,400 407,387 416,356 424,303 425,294 '
        '422,275 422,268 434,246 460,235 480,232 496,237 502,253 502,258 502,259 551,261 551,257 549,244 '
        '546,233 536,217 527,202 390,197 382,196 373,196 354,198 333,201 326,202 315,194 316,184 325,165 '
        '339,149 356,141 385,138 398,138 480,141 458,112 453,95 454,85 476,61 503,54 550,44 586,35 545,13 '
        '492,-8 360,-45 332,-55 322,-70 330,-81 352,-85 358,-85 366,-84 456,-70 536,-50 604,-22 661,10 '
        '762,-30 862,-76 892,-86 916,-70 923,-43 918,-26 892,-9 866,3 829,18 780,35 718,56',
        '202,331 203,334 207,342 201,315',
    ),
    '鶴': (
        '292,137 291,67 203,63 203,131',
        '569,-28 591,61 602,145 602,151 603,156 596,172 575,179 568,180 563,180 546,174 539,155 526,73 '
        '505,4 499,-16 504,-31 521,-42 545,-49 559,-44',
        '697,36 697,42 696,48 689,100 682,136 670,174 653,184 645,183 626,177 617,158 617,152 618,145 '
        '626,92 631,37 637,15 655,7 680,10 692,20',
        '791,67 785,93 770,136 749,184 727,203 717,202 700,194 691,179 695,159 710,114 724,61 733,42 '
        '747,36 775,44',
        '293,257 293,195 203,189 204,251',
        '295,375 294,315 204,309 205,369',
        '786,537 781,489 615,480 616,526',
        '798,638 794,596 616,584 617,625',
        '202,2 488,13 506,18 513,33 506,51 488,72 463,81 453,79 422,72 354,69 355,140 468,146 487,152 '
        '493,165 476,194 443,209 433,207 418,203 404,201 356,198 356,260 471,266 488,272 493,285 484,303 '
        '465,321 445,329 435,327 422,324 405,322 357,319 358,379 500,388 517,394 523,407 514,424 495,444 '
        '472,452 462,450 446,446 429,444 362,440 382,468 395,497 382,519 355,534 335,540 322,526 323,517 '
        '324,509 321,493 294,435 233,431 273,504 311,588 454,597 442,563 428,523 420,495 431,481 447,487 '
        '466,505 492,538 525,590 536,601 543,619 528,644 487,660 474,660 335,651 365,753 366,756 366,760 '
        '348,786 315,800 297,805 282,791 282,786 284,780 287,770 288,758 286,744 278,714 270,685 258,646 '
        '187,641 191,661 192,670 181,690 160,696 145,698 130,693 123,678 100,592 68,507 64,492 82,468 '
        '112,457 127,465 144,499 156,532 171,578 236,583 162,430 53,271 37,238 49,226 79,242 118,280 '
        '134,296 141,304 136,20 134,-6 131,-25 130,-34 142,-57 166,-70 182,-75 197,-67 202,-44',
        '612,216 879,231 868,120 864,131 844,170 820,206 798,222 776,215 762,196 764,187 770,177 792,138 '
        '811,94 821,78 832,72 857,81 863,85 854,42 840,-3 833,-21 832,-20 830,-20 789,-4 746,18 713,32 '
        '702,22 717,-8 754,-48 799,-84 842,-99 871,-91 890,-68 912,0 921,43 931,102 946,237 950,246 '
        '953,258 938,282 906,294 898,294 613,277 613,320 895,336 918,342 925,355 908,384 875,401 866,400 '
        '836,394 614,381 615,420 839,431 858,434 867,447 862,464 845,484 869,640 873,650 876,663 866,682 '
        '846,696 830,701 824,700 818,700 700,692 732,740 746,764 750,778 738,800 712,816 693,823 681,819 '
        '677,806 677,798 673,779 662,752 627,687 614,686 573,700 550,705 537,693 539,684 545,670 550,650 '
        '551,620 547,287 546,258 542,230 542,227 541,222 552,200 575,186 591,180 607,188 612,211',
    ),
    '黃': (
        '822,-89 844,-78 855,-55 858,-38 851,-19 829,-5 728,35 648,62 594,79 573,84 550,70 541,42 546,26 '
        '563,16 684,-26 793,-78 808,-86',
        '108,-83 116,-83 266,-56 425,-5 436,4 442,18 433,46 412,75 397,86 747,101 772,104 782,117 776,134 '
        '757,159 781,347 786,357 790,372 772,400 741,411 734,410 727,410 527,399 527,440 938,461 960,464 '
        '969,478 960,496 937,520 907,531 900,530 892,529 841,521 104,483 91,483 72,484 51,488 49,488 '
        '45,489 35,479 36,472 50,445 62,431 84,422 108,420 126,420 454,437 454,396 277,386 234,400 '
        '208,404 192,392 199,375 208,352 213,325 229,152 230,138 231,125 230,114 229,104 229,98 248,68 '
        '283,57 299,62 304,79 304,82 380,85 368,71 354,53 334,39 232,-6 108,-47 88,-57 81,-68 88,-79',
        '454,216 454,150 300,144 294,207',
        '694,227 688,162 526,153 526,219',
        '454,332 454,277 290,267 285,323',
        '706,345 701,289 526,280 527,335',
        '580,653 575,602 403,591 399,642',
        '648,656 825,666 842,670 851,684 841,706 818,727 792,736 777,732 729,723 658,719 667,778 667,781 '
        '658,799 631,814 597,822 580,809 582,802 591,763 590,756 590,749 587,715 395,704 391,763 374,788 '
        '344,796 324,798 306,787 309,779 320,756 324,731 327,700 203,693 194,692 184,692 155,695 146,696 '
        '134,684 136,676 155,646 191,630 205,630 223,632 332,638 335,596 336,586 336,577 336,563 334,547 '
        '334,546 333,541 344,522 368,508 387,502 402,507 407,522 407,525 406,533 641,546 658,548 666,561 '
        '660,578 640,602',
    ),
}


def raised_inscription(gold, center, face_y, side):
    # Curve filling preserves the counters and nested outlines of the three glyphs.
    relief = bpy.data.curves.new("Traditional Chinese inscription outlines", 'CURVE')
    relief.dimensions = '2D'
    relief.fill_mode = 'BOTH'
    relief.extrude = .021
    for i, char in enumerate('樓鶴黃'):
        for contour in GLYPH_OUTLINES[char]:
            points = [tuple(map(int, point.split(','))) for point in contour.split()]
            loop = relief.splines.new('POLY')
            loop.points.add(len(points) - 1)
            for point, (x, z) in zip(loop.points, points):
                point.co = ((i-1)*1.38 + (x-500)*.00140,
                            (z-398)*.00158, 0, 1)
            loop.use_cyclic_u = True
    cutter = bpy.data.objects.new("Traditional Chinese inscription outlines", relief)
    bpy.context.collection.objects.link(cutter)
    evaluated = cutter.evaluated_get(bpy.context.evaluated_depsgraph_get())
    lettering = evaluated.to_mesh()
    welded = bmesh.new()
    try:
        # The fill and the extrusion supply separate boundary vertices. Weld the
        # inscription itself so each raised glyph is an editable closed solid.
        welded.from_mesh(lettering)
        bmesh.ops.remove_doubles(welded, verts=list(welded.verts), dist=1e-6)
        welded.to_mesh(lettering)
        vertices = [(*turn(v.co.x, face_y-v.co.z, side), center+v.co.y)
                    for v in lettering.vertices]
        gold.solid(vertices, [p.vertices for p in lettering.polygons])
    finally:
        welded.free()
        evaluated.to_mesh_clear()
        bpy.data.objects.remove(cutter, do_unlink=True)
        bpy.data.curves.remove(relief)


def plaque(radius):
    board = Part('West fifth gallery - blue lacquer name board', 'plaqueBlue')
    gold = Part('West fifth gallery - gilded inscription and key border', 'plaqueGold')
    mount = Part('West fifth gallery - plaque bearer and brackets', 'timber')
    side = 3
    y, z = -radius-.13, 26.56

    def box(part, x, normal, height, w, d, h):
        part.box((*turn(x, normal, side), height), (w, d, h), side*tau/4)

    box(mount, 0, y+.41, z-.97, 4.63, .60, .27)
    box(board, 0, y, z, 4.99, .27, 2.42)
    for width, height, thickness in ((4.91, 2.34, .046), (4.59, 2.02, .035)):
        for sign in (-1, 1):
            box(gold, 0, y-.142, z+sign*(height-thickness)/2, width, .038, thickness)
            box(gold, sign*(width-thickness)/2, y-.142, z, thickness, .038, height-2*thickness)

    # Continuous stepped fret between the coved inner and outer gold fillets.
    step = ((0, 0), (.85, 0), (.85, .075), (.23, .075),
            (.23, .042), (.65, .042))
    for sign in (-1, 1):
        for along, across, count, spacing in ((True, 1.07, 16, .295), (False, 2.365, 7, .310)):
            for i in range(count):
                points = []
                for t, depth in step:
                    u = (i+t-count/2)*spacing
                    x, h = (u, sign*(across+depth)) if along else (sign*(across+depth), u)
                    points.append((*turn(x, y-.149, side), z+h))
                for first, last in zip(points, points[1:]):
                    gold.beam(first, last, .020)
    for x in (-1.42, 1.42):
        box(mount, x, y+.09, z-1.21, .35, .55, .26)
        box(gold, x, y-.197, z-1.18, .32, .09, .23)
    for x in (-2.35, 2.35):
        for h in (-1.10, 1.10):
            box(gold, x, y-.176, z+h, .082, .038, .082)
    raised_inscription(gold, z, y-.150, side)
    for part in (board, gold, mount):
        part.finish()


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
    plaque(radii[-1])
    spire(floors[-1]+3.58-.42+5.30-.04)
