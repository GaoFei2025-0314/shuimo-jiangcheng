"""West forecourt assets. Origins are at grade; Blender -Y is the front.

Architectural references: 《黄鹤楼设计纪事》 figures 4-1-8, 10–12, 14–15 and
17–18, in the Yellow Crane Tower Management Office's digital archive.
The small pavilion interprets the side buildings visible beside the paifang.
"""
from math import cos, pi, sin, tau

from mathutils import Vector

from gardens import Assembly, circular, elevation_prism, loft, slab


def _sweep(part, centers, radii, sides=8, lateral=(1, 0, 0)):
    """Close a tapered section around a spatial centerline."""
    points = list(map(Vector, centers))
    preferred = Vector(lateral)
    rings = []
    for i, (p, (width, depth)) in enumerate(zip(points, radii, strict=True)):
        tangent = (points[min(i + 1, len(points) - 1)] - points[max(0, i - 1)]).normalized()
        up = tangent.cross(preferred)
        if up.length_squared < .002:
            up = tangent.cross(Vector((0, 0, 1)))
        up.normalize()
        side = up.cross(tangent)
        rings.append([p + side * (width * cos(j * tau / sides))
                      + up * (depth * sin(j * tau / sides)) for j in range(sides)])
    loft(part, rings)


def _roof(site, label, x, width, depth, eave, rise, ridge, kick):
    """Gold glazed hip roof with curved eaves, a closed soffit and raised rolls."""
    corners = [(-width / 2, -depth / 2), (width / 2, -depth / 2),
               (width / 2, depth / 2), (-width / 2, depth / 2)]
    crown = [(-ridge / 2, -.067), (ridge / 2, -.067), (ridge / 2, .067), (-ridge / 2, .067)]

    def section(edge, t):
        j = (edge + 1) % 4
        ox, oy = (a * (1 - t) + b * t for a, b in zip(corners[edge], corners[j]))
        ix, iy = (a * (1 - t) + b * t for a, b in zip(crown[edge], crown[j]))
        return [(x + ox + u * (ix - ox), oy + u * (iy - oy),
                 eave + h * rise + turn * kick * abs(2 * t - 1) ** 4)
                for u, h, turn in ((0, 0, 1), (.24, .077, .53), (.58, .34, .19),
                                   (.81, .64, .07), (1, 1, 0))]

    rows = [section(edge, j / 12) for edge in range(4) for j in range(12)]
    rings = list(zip(*rows))
    soffit = [(x + (px - x) * .92, py * .87, eave - .21 + .25 * (pz - eave))
              for px, py, pz in rings[0]]
    fascia = [(px, py, pz - .122) for px, py, pz in rings[0]]
    tile = site.part(label + ' · 瓦面', 'roofGold')
    loft(tile, [soffit, fascia, *rings])
    ridges = site.part(label + ' · 筒瓦与正脊', 'bronze')
    for edge in range(4):
        count = round((width if edge % 2 == 0 else depth) / .36)
        lateral = (1, 0, 0) if edge % 2 == 0 else (0, 1, 0)
        for j in range(1, count):
            row = section(edge, j / count)
            _sweep(ridges, [(a, b, c + .021) for a, b, c in row], [(.035, .033)] * len(row),
                   4, lateral=lateral)
        _sweep(ridges, [(a, b, c + .048) for a, b, c in section(edge, 0)],
               [(.10, .075), (.095, .072), (.083, .061), (.072, .053), (.068, .045)], 7,
               lateral=lateral)
    top = eave + rise
    ridges.beam((x - ridge / 2 - .12, 0, top + .060),
                (x + ridge / 2 + .12, 0, top + .060), .158, .148)
    beasts = site.part(label + ' · 正吻', 'roofGold')
    for side in (-1, 1):
        end = x + side * ridge / 2
        profile = [(-.20, 0), (.17, 0), (.27, .17), (.33, .39), (.23, .54),
                   (.06, .51), (.01, .38), (.14, .35), (.11, .22), (-.20, .09)]
        shape = [(end + side * u, top + z) for u, z in profile]
        elevation_prism(beasts, shape if side > 0 else shape[::-1], -.093, .093)


def _brackets(part, x, y, z, size):
    """Three tiers of bracket arms above an ornamental dou block."""
    part.box((x, y, z + .08 * size), (.34 * size, .42 * size, .20 * size))
    for i in range(3):
        height = z + (.26 + .17 * i) * size
        arm = (.67 + .21 * i) * size
        part.box((x, y, height), (arm, .22 * size, .19 * size))
        part.box((x, y, height + .045 * size), (.21 * size, arm * .85, .136 * size))
        for side in (-1, 1):
            part.box((x + side * arm * .42, y, height + .062 * size),
                     (.19 * size, .31 * size, .165 * size))


# Raised, hand-drawn strokes preserve the right-to-left plaque readings from
# figures 4-1-11 and 12 without a font installation or baked label texture.
_PLAQUE_STROKES = {
    '三': (((.18,.78),(.80,.83)), ((.25,.52),(.73,.56)), ((.10,.20),(.90,.25))),
    '一': (((.08,.48),(.35,.51),(.70,.53),(.92,.56)),),
    '楚': (((.06,.79),(.45,.80)), ((.25,.93),(.25,.55)), ((.23,.74),(.09,.58)),
          ((.28,.71),(.42,.62)), ((.53,.80),(.92,.82)), ((.72,.94),(.72,.54)),
          ((.70,.74),(.54,.60)), ((.74,.73),(.91,.57)), ((.18,.48),(.83,.51),(.72,.41)),
          ((.51,.47),(.51,.13)), ((.52,.32),(.77,.33)), ((.33,.38),(.28,.22),(.12,.06)),
          ((.30,.24),(.58,.11),(.91,.07))),
    '樓': (((.07,.67),(.36,.69)), ((.22,.92),(.21,.09)), ((.21,.65),(.14,.46),(.05,.30)),
          ((.23,.58),(.35,.46)), ((.42,.79),(.89,.81)), ((.43,.62),(.89,.64)),
          ((.44,.82),(.46,.51),(.84,.52),(.88,.82)), ((.65,.93),(.65,.44)),
          ((.38,.42),(.92,.45)), ((.62,.42),(.50,.22),(.75,.13),(.89,.06)),
          ((.80,.35),(.71,.21),(.52,.11),(.37,.07)), ((.36,.29),(.91,.32))),
    '江': (((.12,.86),(.24,.76)), ((.10,.62),(.23,.54)), ((.09,.21),(.29,.46)),
          ((.42,.73),(.86,.76)), ((.64,.73),(.61,.20)), ((.36,.18),(.92,.21))),
    '山': (((.49,.92),(.47,.19)), ((.15,.67),(.16,.16),(.82,.19)), ((.85,.72),(.83,.12))),
    '入': (((.46,.84),(.49,.67),(.44,.50),(.32,.33),(.09,.14)),
          ((.49,.78),(.56,.59),(.68,.37),(.92,.14))),
    '畫': (((.18,.82),(.79,.84),(.77,.60)), ((.12,.72),(.92,.75)), ((.20,.61),(.80,.64)),
          ((.19,.52),(.83,.54)), ((.48,.95),(.49,.44)),
          ((.23,.44),(.77,.45),(.75,.16),(.24,.15),(.23,.44)), ((.25,.30),(.75,.32)),
          ((.49,.43),(.49,.16)), ((.12,.065),(.87,.08))),
}


def _inscription(part, text, y, z, face):
    for index, glyph in enumerate(text):
        for stroke in _PLAQUE_STROKES[glyph]:
            centers = [(face * ((1.5 - index) * .79 + (u - .5) * .71), y,
                        z + (v - .5) * .68) for u, v in stroke]
            _sweep(part, centers, [(.030, .021)] * len(centers), 6, lateral=(0, 1, 0))


def paifang():
    site = Assembly('三楚一楼')
    stone = site.part('石柱础、抱鼓与压顶线', 'stone')
    shafts = site.part('四根朱漆柱', 'vermilion')
    lintel = site.part('枋额、挂落与彩画底', 'timber')
    bracket = site.part('三楼分布斗栱', 'glaze')
    painting = site.part('枋额描金、垂饰', 'bronze')
    for x, height in [(-7.75, 6.20), (-3.25, 9.38), (3.25, 9.38), (7.75, 6.20)]:
        for z, w, d, h in [(.09, 1.21, 1.59, .18), (.41, 1.08, 1.38, .48),
                           (.79, 1.16, 1.52, .14), (1.03, .90, 1.00, .36)]:
            stone.box((x, 0, z), (w, d, h))
        circular(shafts, x, 0, [(.344, 1.17), (.326, height)], sides=16, angle=pi/16, sy=1.05)
        for y in (-.83, .83):
            stone.box((x, y, .28), (.85, .49, .55))
            _sweep(stone, [(x, y * .80, .47), (x, y, .51), (x, y * 1.09, .65),
                           (x, y * .94, .81)], [(.34, .30), (.35, .27), (.30, .22), (.21, .18)], 10)
    for bay, x, width, depth, beam, eave, rise, ridge in [
        ('明间主楼', 0, 10.62, 4.60, 7.51, 9.41, 1.67, 6.23),
        ('北次间', 6.63, 6.74, 3.28, 5.58, 6.88, 1.28, 3.91),
        ('南次间', -6.63, 6.74, 3.28, 5.58, 6.88, 1.28, 3.91),
    ]:
        # Lower wing openings are kept entirely clear below their painted beams.
        w = 6.66 if x == 0 else 5.02
        axis = x * 5.50 / 6.63
        lintel.box((axis, 0, beam), (w, .72, .39))
        lintel.box((axis, 0, beam + .37), (w + .22, .89, .42))
        lintel.box((axis, 0, eave - .77), (w + .77, .99, .20))
        lintel.box((axis, 0, (beam + .56 + eave - .61) / 2),
                   (w-.04, .76, eave - beam - 1.17))
        for face in (-1, 1):
            y = face * .449
            for dz in (.18, .52):
                painting.box((axis, y, beam + dz), (w - .14, .042, .032))
            for i in range(11 if x == 0 else 9):
                u = axis + w * (.12 + .76 * i / (10 if x == 0 else 8) - .5)
                painting.box((u, y * 1.017, beam + .36), (.108, .037, .157), 0)
            for offset in (-w * .405, w * .405):
                painting.box((axis + offset, y * 1.018, beam + .368), (.46, .042, .223))
            count = 9 if x == 0 else 7
            for i in range(count):
                _brackets(bracket, x + width * .77 * (i / (count-1) - .5),
                          face * depth * .229, eave - .81, .97 if x == 0 else .80)
        _roof(site, bay, x, width, depth, eave, rise, ridge, .59 if x == 0 else .47)

    board = site.part('双面白底匾额', 'plaster')
    surround = site.part('匾框与镶条', 'glaze')
    gold = site.part('三楚一樓与江山入畫 · 阳文', 'plaqueGold')
    for face, text in [(1, '三楚一樓'), (-1, '江山入畫')]:
        y, z = -face * .46, 8.32
        surround.box((0, y, z), (3.85, .20, 1.11))
        board.box((0, y - face * .118, z), (3.65, .12, .90))
        for dx in (-1.77, 1.77):
            gold.box((dx, y - face * .178, z), (.022, .030, .78))
        for dz in (-.397, .397):
            gold.box((0, y - face * .178, z + dz), (3.57, .030, .024))
        _inscription(gold, text, y - face * .192, z, face)
    site.finish()


def _folded_course(part, profile):
    rings = [[(r * lip * cos(a), r * lip * sin(a), z)
              for i in range(12) for delta, lip in ((-.208,.89),(-.109,1),(.109,1),(.208,.89))
              for a in [i * tau / 12 + delta]] for r, z in profile]
    loft(part, rings)


def stupa():
    site = Assembly('胜像宝塔')
    base = site.part('圆台与三重十二折角塔座', 'plaster')
    circular(base, 0, 0, [(2.84, 0), (2.84, .16), (2.74, .25), (2.74, .46),
                           (2.65, .54), (2.52, .57)], sides=40)
    _folded_course(base, [(2.52,.55),(2.53,.72),(2.43,.81),(2.34,.92),(2.34,1.24),
                          (2.45,1.30),(2.48,1.45),(2.35,1.54),(2.18,1.59)])
    _folded_course(base, [(2.18,1.56),(2.23,1.72),(2.15,1.80),(2.04,1.88),
                          (2.03,2.15),(2.16,2.20),(2.18,2.39),(2.01,2.49),(1.90,2.52)])
    _folded_course(base, [(1.90,2.49),(1.95,2.62),(1.87,2.70),(1.79,2.79),(1.78,3.11),
                          (1.91,3.16),(2.01,3.32),(1.94,3.46),(1.67,3.56)])

    relief = site.part('塔座浮雕、覆莲纹与肩部小联珠', 'stone')
    white = site.part('覆莲、覆钵与塔肩', 'plaster')
    circular(white, 0, 0, [(1.59,3.51),(1.64,3.64),(1.52,3.73),(1.37,3.85)], sides=32)
    circular(white, 0, 0, [(1.33,3.82),(1.38,4.00),(1.50,4.37),(1.65,4.80),(1.71,5.15),
                           (1.67,5.39),(1.60,5.54),(1.44,5.69),(1.22,5.74),(1.06,5.76)], sides=40)
    circular(white, 0, 0, [(.87,5.74),(.89,5.90),(.94,5.98),(1.01,6.04),
                           (1.04,6.16),(1.00,6.26),(.77,6.36),(.69,6.43)], sides=28)
    for i in range(24):
        a = i * tau / 24
        leaf = [(1.60*cos(a),1.60*sin(a),3.62),(1.53*cos(a),1.53*sin(a),3.71),
                (1.43*cos(a),1.43*sin(a),3.78)]
        _sweep(relief, leaf, [(.027,.026),(.043,.035),(.016,.015)], 6,
               lateral=(-sin(a),cos(a),0))
        if i % 2:
            relief.box((.96*cos(a),.96*sin(a),6.05), (.112,.22,.087), a)
            continue
        for z, r in [(1.10,2.36),(2.02,2.065),(2.97,1.82)]:
            # Abstract relief follows the panel rhythm of the stone-carved original.
            rail = [(r*cos(a+t),r*sin(a+t),z+h) for t,h in
                    [(-.072,-.048),(-.046,.032),(0,.067),(.045,.028),(.071,-.045)]]
            _sweep(relief, rail, [(.025,.025)] * len(rail), 5, lateral=(cos(a),sin(a),0))

    finial = site.part('十三相轮与石伞盖', 'plaster')
    rings = [(.69,6.39)]
    for i in range(13):
        r = .70 - i*.024
        z = 6.44 + i*.096
        rings.extend([(r-.051,z),(r,z+.024),(r-.008,z+.060),(r-.058,z+.081)])
    rings += [(.39,7.69),(.54,7.75),(.87,7.87),(.88,7.96),(.78,8.04),(.55,8.12),(.21,8.16)]
    circular(finial, 0, 0, rings, sides=24)
    tip = site.part('铜合金宝瓶、宝珠与顶针', 'shadow')
    circular(tip, 0, 0, [(.21,8.14),(.23,8.23),(.18,8.35),(.21,8.49),(.28,8.63),
                         (.25,8.79),(.16,8.93),(.13,9.01),(.17,9.10),(.13,9.20),
                         (.067,9.24),(.043,9.36)], sides=20)
    site.finish()


def _crane(site, label, x, y, yaw, scale, lifted):
    body = site.part(label + ' · 躯身、挽颈', 'glaze')
    wing = site.part(label + ' · 层叠翼羽', 'steel')
    toes = site.part(label + ' · 跗跖、趾与喙', 'glaze')
    eyes = site.part(label + ' · 眼线', 'shadow')

    def pose(u, v, h):
        return (x + scale * (u*cos(yaw) - v*sin(yaw)),
                y + scale * (u*sin(yaw) + v*cos(yaw)), 1.17 + scale*h)

    def form(part, sections, sides=10, lateral=(1,0,0)):
        _sweep(part, [pose(*p) for p, _, _ in sections],
               [(w*scale, d*scale) for _, w, d in sections], sides, lateral=lateral)

    form(body, [((0,-.55,2.34),.138,.145), ((0,-.36,2.22),.277,.313),
                ((0,-.04,2.09),.357,.371), ((0,.24,1.93),.335,.333),
                ((0,.49,1.72),.224,.242), ((0,.76,1.53),.107,.137),
                ((0,.94,1.43),.062,.066)], 16)
    if lifted:
        neck = [((0,-.37,2.32),.194,.209), ((0,-.51,2.56),.154,.169),
                ((0,-.63,2.87),.112,.123), ((0,-.70,3.14),.083,.102),
                ((0,-.63,3.44),.075,.087), ((0,-.64,3.68),.076,.087),
                ((0,-.76,3.87),.095,.105), ((0,-.96,3.98),.121,.116),
                ((0,-1.17,3.91),.079,.078)]
        bill = [((0,-1.12,3.92),.067,.058), ((0,-1.34,3.86),.042,.036),
                ((0,-1.63,3.74),.010,.011)]
        eye_y, eye_z = -1.04, 3.972
    else:
        neck = [((0,-.38,2.31),.180,.182), ((0,-.55,2.52),.140,.147),
                ((0,-.69,2.83),.105,.106), ((0,-.79,3.13),.080,.086),
                ((0,-.84,3.39),.076,.078), ((0,-.95,3.58),.084,.091),
                ((0,-1.14,3.61),.111,.101), ((0,-1.33,3.60),.070,.066)]
        bill = [((0,-1.28,3.61),.060,.045), ((0,-1.55,3.61),.038,.028),
                ((0,-1.82,3.58),.009,.010)]
        eye_y, eye_z = -1.21, 3.638
    rounded_neck = []
    for i, (p, w, d) in enumerate(neck[:-1]):
        q, qw, qd = neck[i+1]
        before, after = neck[max(0, i-1)][0], neck[min(i+2, len(neck)-1)][0]
        mid = (9*(Vector(p) + Vector(q)) - Vector(before) - Vector(after)) / 16
        rounded_neck.extend([(p,w,d),(mid,(w+qw)/2,(d+qd)/2)])
    form(body, [*rounded_neck, neck[-1]], 12)
    form(toes, bill, 9)
    for side in (-1, 1):
        eye = pose(side*.098, eye_y, eye_z)
        eyes.box(eye, (.045*scale,.060*scale,.031*scale), yaw)

        # Carved shafts and quills follow a lifted scapular wing on one bird,
        # and a tighter body-hugging wing on the other.
        fan = .295 if lifted and side == -1 else .055
        form(wing, [((side*.17,-.35,2.29),.066,.123),
                    ((side*(.29+fan*.40),-.10,2.18),.134,.235),
                    ((side*(.33+fan),.28,1.93),.112,.209),
                    ((side*(.28+fan),.61,1.66),.070,.133),
                    ((side*(.17+fan*.80),.87,1.43),.032,.059)], 10)
        for i in range(6):
            offset = i*.057
            form(wing, [((side*(.25+fan*.54+offset*.28),.12+offset,2.16-offset*.76),.033,.069),
                        ((side*(.28+fan+offset*.31),.51+offset*.6,1.79-offset*.4),.037,.067),
                        ((side*(.19+fan*.91+offset*.27),.90+offset*.48,1.44-offset*.31),.015,.022)], 6)

        leg_x = side * .133
        bent = lifted and side == -1
        knee_y = .235 if bent else .075
        angle_y = -.095 if bent else -.11
        form(toes, [((leg_x,.18,1.92),.083,.103), ((leg_x,.18,1.58),.058,.061),
                    ((leg_x,knee_y,.98),.044,.051), ((leg_x,angle_y,.20),.039,.041),
                    ((leg_x,angle_y-.037,.043),.033,.043)], 9)
        for toe in (-1,0,1):
            form(toes, [((leg_x,angle_y-.034,.049),.034,.032),
                        ((leg_x+toe*.061,angle_y-.170,.032),.024,.023),
                        ((leg_x+toe*.098,angle_y-.301+abs(toe)*.025,.015),.012,.014)], 7)


def cranes():
    site = Assembly('黄鹤归来')
    rock = site.part('裸岩石跗', 'stone')
    lobes = [1.0,.97,.89,1.055,1.034,.90,1.0,.94,.87,1.03,.94,.91]
    rock_layers = [(0,2.25,1.65),(.18,2.39,1.78),(.40,2.24,1.63),(.59,1.96,1.46),(.72,1.52,1.23)]
    loft(rock, [[(rx*r*cos(a),ry*r*sin(a),z+.059*sin(a*3) if z else 0)
                 for i,r in enumerate(lobes) for a in [i*tau/len(lobes)]]
                for z,rx,ry in rock_layers])
    turtle = site.part('玄龟 · 甲壳、头与四足', 'glaze')
    mesh = site.part('玄龟 · 甲纹与眼', 'shadow')
    belly = site.part('玄龟 · 腹甲逸缘', 'bronze')
    circular(turtle, 0, .12, [(.77,.53),(1.02,.63),(1.10,.77),(1.02,.92),
                             (.86,1.065),(.61,1.145),(.26,1.185)], sides=26, sy=1.09)
    circular(belly, 0, .12, [(1.015,.63),(1.07,.68),(1.086,.755),(1.06,.78)], sides=26, sy=1.09)
    _sweep(turtle, [(0,-.66,.69),(-.06,-.98,.72),(-.13,-1.23,.77),
                    (-.17,-1.42,.75),(-.17,-1.53,.71)],
           [(.30,.177),(.19,.132),(.199,.155),(.14,.113),(.077,.066)], 12)
    for side in (-1,1):
        mesh.box((-.20+side*.149,-1.391,.812), (.036,.051,.039))
        for y in (-.50,.60):
            _sweep(turtle, [(side*.67,y,.774),(side*.93,y-.15,.694),
                            (side*1.18,y-.18,.587),(side*1.20,y-.288,.538)],
                   [(.238,.157),(.192,.124),(.158,.097),(.087,.060)], 8, lateral=(0,1,0))
    _sweep(turtle, [(0,.94,.69),(-.03,1.15,.67),(-.14,1.28,.65),(-.30,1.39,.59)],
           [(.16,.109),(.12,.077),(.080,.056),(.026,.026)], 7)
    for i in range(8):
        a = i*tau/8
        points = [(r*cos(a),.12+1.09*r*sin(a),z) for r,z in
                  [(1.077,.779),(.972,.974),(.79,1.090),(.612,1.154),(.33,1.176)]]
        _sweep(mesh, points, [(.016,.016)] * len(points), 5, lateral=(-sin(a),cos(a),0))

    snake = site.part('伏蛇 · 缠绕龟足、扬首', 'glaze')
    coil, section = [], []
    for i in range(45):
        t = i/44
        a = -1.54 + tau*1.40*t
        r = 1.24 - .36*t
        coil.append((r*cos(a),.05 + r*1.04*sin(a),.432 + .490*t))
        section.append((.025+.111*sin(t*pi/2),.025+.071*sin(t*pi/2)))
    coil.extend([(.67,1.10,1.005),(.60,1.22,1.12),(.60,1.28,1.27),(.55,1.26,1.37),
                 (.46,1.17,1.39),(.38,1.10,1.37)])
    section.extend([(.121,.097),(.106,.094),(.111,.094),(.136,.083),(.107,.066),(.043,.028)])
    _sweep(snake, coil, section, 10, lateral=(0,0,1))
    _crane(site, '高鹤', -.40, .30, -.59, 1.04, True)
    _crane(site, '低鹤', .42, -.20, -.55, .94, False)
    for obj in site.finish():
        if obj.name.startswith(('黄鹤归来 / 高鹤','黄鹤归来 / 低鹤','黄鹤归来 / 伏蛇')):
            for polygon in obj.data.polygons:
                polygon.use_smooth = len(polygon.vertices) == 4


def pavilion():
    site = Assembly('西区配亭')
    base = site.part('条石台明、踏步与柱础', 'stone')
    slab(base, 0, 0, 7.14, 5.10, 0, .23)
    slab(base, 0, 0, 7.21, 5.18, .207, .316)
    for side in (-1,1):
        slab(base, 0, side*2.81, 2.39, .53, 0, .148)
        slab(base, 0, side*2.61, 2.26, .35, .11, .249)
    columns = site.part('游廊柱、额枋与承椽', 'timber')
    joinery = site.part('透雕挂落、斗栱与雀替', 'glaze')
    seats = site.part('可坐槛凳与板靠', 'vermilion')
    for x in (-3.04,0,3.04):
        for y in (-1.95,1.95):
            circular(base, x, y, [(.29,.30),(.29,.39),(.24,.50),(.21,.53)], sides=12)
            circular(columns, x, y, [(.191,.50),(.167,3.54)], sides=12)
            _brackets(joinery, x, y, 3.40, .63)
    for y in (-1.95,1.95):
        columns.box((0,y,3.47), (6.46,.260,.293))
        columns.box((0,y,3.62), (6.72,.31,.152))
        for direction in (-1,1):
            x=direction*1.52
            joinery.box((x,y,3.12), (2.78,.14,.106))
            for i in range(11):
                u=x+(i-5)*.23
                joinery.box((u,y,3.244), (.067,.103,.285))
                joinery.beam((u-.085,y,3.215),(u+.087,y,3.315),.045)
    for x in (-3.04,3.04):
        columns.box((x,0,3.48), (.24,4.02,.26))
        seats.box((x,0,.716), (.453,3.34,.131))
        seats.box((x,0,1.087), (.173,3.26,.128))
        for y in (-1.13,0,1.13):
            seats.box((x,y,.72), (.167,.156,.79))
        for y in (-1.33,-.86,-.45,.45,.86,1.33):
            seats.box((x,y,.934), (.094,.074,.278))
    for y in (-1.62,-1.27,-.90,-.54,-.18,.18,.54,.90,1.27,1.62):
        columns.box((0,y,3.63), (6.38,.083,.136))
    _roof(site, '低檐歇山', 0, 8.50, 6.40, 3.91, 1.17, 4.82, .47)
    site.finish()


BUILDERS = {
    'park_paifang': paifang,
    'park_stupa': stupa,
    'park_cranes': cranes,
    'park_pavilion': pavilion,
}
