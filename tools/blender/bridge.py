"""Wuhan Yangtze River Bridge, drawn in the map's vertically exaggerated units."""

from math import cos, hypot, pi, sin, tau

import bmesh
import bpy
from mathutils import Vector
from mathutils.geometry import tessellate_polygon

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
    footings = Part("Dressed stone margins under truss bearings", "stone")
    seats = Part("Truss bearing sole plates and raised caps", "steel")
    saddles = Part("Bearing saddles and recessed side shoulders", "shadow")
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
            # A sectional reading of the support: stone pad, lower sole plate,
            # recessed saddle and wider upper cap. The saddle shape is illustrative.
            loft(footings, [[(x+dx*w, y+dy*d, z) for dx,dy in
                             ((-1,-1),(1,-1),(1,1),(-1,1))]
                            for z,w,d in ((4.57,.99,.83),(4.64,.99,.83),(4.70,.83,.69))])
            seats.box((x, y, 4.713), (1.52, 1.25, .075))
            side_plate(saddles, x, [(y-.49,4.742),(y+.49,4.742),(y+.32,4.875),
                                    (y+.21,4.903),(y-.21,4.903),(y-.32,4.875)], 1.03)
            for shoulder in (-1, 1):
                side_plate(seats, x+shoulder*.45,
                           [(y-.44,4.74),(y+.44,4.74),(y+.29,4.85),(y-.29,4.85)], .19)
            seats.box((x, y, 4.904), (1.21, 1.05, .10))
    piers.finish()
    footings.finish()
    seats.finish()
    saddles.finish()
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
    railbed = Part("Lower railway bed and timber cross ties", "deck")
    rails = Part("Twin railway tracks and longitudinal stringers", "ink")
    deck_ribbon(railbed, 0, 7.78, (-107, 107), 0, .33, height=lambda _: 5.32)
    for side in (-1, 1):
        deck_ribbon(rails, side * 3.8, .29, (-107, 107), 0, .39, height=lambda _: 5.32)
    for track in (-2.02, 2.02):
        for offset in (-.72, .72):
            for width, top, thickness in ((.065, 5.59, .17), (.14, 5.635, .058)):
                deck_ribbon(rails, track + offset, width, (-107, 107), 0, thickness,
                            height=lambda _, z=top: z)
        for y in range(-106, 107, 2):
            railbed.box((track, y, 5.38), (2.43, .37, .15))
    # Each continuous unit covers three spans. Tiny joints separate the flanges.
    for start in (-72, -24, 24):
        for side in (-1, 1):
            x = side * 4.18
            for z in (LOWER_CHORD, UPPER_CHORD):
                truss.box((x, start + 24, z), (.55, 47.95, .52))
                plates.box((x, start + 24, z - .23), (.72, 47.93, .13))
                plates.box((x, start + 24, z + .24), (.66, 47.93, .09))
            for y in range(start, start + 48, 8):
                # One diagonal laps behind the other, including its flanges at the chord.
                inner_x = x - side * .023
                low_a = (x, y, LOWER_CHORD)
                high_a = (inner_x, y, UPPER_CHORD)
                low_b = (inner_x, y + 8, LOWER_CHORD)
                high_b = (x, y + 8, UPPER_CHORD)
                for a, b in ((low_a, high_b), (high_a, low_b)):
                    truss.beam(a, b, .42, .30)
                    # A flange follows each edge of the diagonal web.
                    for edge in (-1, 1):
                        dy = edge * (b[2]-a[2]) / 52
                        dz = edge * (a[1]-b[1]) / 52
                        truss.beam((a[0], a[1]+dy, a[2]+dz), (b[0], b[1]+dy, b[2]+dz), .62, .10)
                # Cover the lapped X joint with a raised gusset and four rivet heads.
                middle = (LOWER_CHORD + UPPER_CHORD) / 2
                side_plate(plates, x + side * .31,
                           [(y + 4 + .71*cos(i*tau/8), middle + .66*sin(i*tau/8))
                            for i in range(8)], .11)
                for dy in (-.27, .27):
                    for dz in (-.23, .23):
                        side_plate(truss, x + side * .38,
                                   [(y + 4 + dy + .08*cos(k*tau/6), middle + dz + .08*sin(k*tau/6))
                                    for k in range(6)], .065)
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
            # Opposing lateral braces stiffen the floor grids of the two decks.
            direction = (-1) ** ((y + MAIN_END) // 8)
            for z in (LOWER_CHORD - .23, UPPER_CHORD + .03):
                truss.beam((-direction * 4.1, y, z), (direction * 4.1, y + 8, z), .23)
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


def cast_profile(part, x, path, depth, half_width=.034):
    """Join a rectangular casting through the bends in a railing motif."""
    rings = []
    for i, (y, z) in enumerate(path):
        earlier, later = path[max(0, i-1)], path[min(i+1, len(path)-1)]
        dy, dz = (b-a for a, b in zip(earlier, later))
        section = half_width / hypot(dy, dz)
        rings.append([(x+u*depth/2, y+v*dz*section, z-v*dy*section)
                      for u, v in ((-1, -1), (1, -1), (1, 1), (-1, 1))])
    loft(part, rings)



def cast_flower_panel(part, x, y, motif):
    """Simplify documented cast-iron designs as connected paper-cut silhouettes."""
    z = road_height(y)
    for edge in (-.71, .71):
        part.box((x, y+edge, z+.675), (.092, .072, .80))
    part.box((x, y, z+.325), (.083, 1.42, .069))
    part.box((x, y, z+1.047), (.084, 1.42, .055))

    def stem(path, width=.024, *, depth):
        # Keep the cast branches connected without coplanar faces at junctions.
        cast_profile(part, x, [(y+u, z+h) for u, h in path], depth, width)

    def silhouette(outline):
        area = sum(a[0]*b[1]-a[1]*b[0] for a, b in zip(outline, outline[1:]+outline[:1]))
        points = outline if area > 0 else reversed(outline)
        side_plate(part, x, [(y+u, z+h) for u, h in points], .074)

    if motif == 0:  # Magpie on a flowering branch.
        stem([(-.69,.39),(-.39,.46),(-.16,.61),(.12,.65),(.35,.76),(.69,.89)], .030, depth=.060)
        stem([(-.42,.46),(-.31,.59),(-.28,.81),(-.32,1.025)], depth=.044)
        stem([(.30,.75),(.47,.61),(.69,.57)], depth=.026)
        silhouette([(-.22,.56),(-.03,.70),(.015,.77),(.105,.85),(.19,.84),(.24,.805),
                    (.30,.80),(.225,.766),(.195,.699),(.102,.647),(-.016,.642)])
        silhouette([(-.378,.782),(-.340,.785),(-.365,.834),(-.321,.862),(-.280,.815),
                    (-.254,.842),(-.215,.817),(-.231,.773),(-.293,.749)])
        silhouette([(.388,.620),(.461,.627),(.511,.602),(.505,.556),(.460,.553),(.420,.575)])
    elif motif == 1:  # Carp and lotus.
        stem([(-.60,.325),(-.53,.47),(-.47,.64),(-.39,.81),(-.37,1.023)], depth=.060)
        stem([(-.20,.325),(-.22,.52),(-.18,.69),(-.39,.81)], depth=.044)
        stem([(-.69,.411),(-.60,.385),(-.39,.342),(-.23,.325),(-.04,.333),
              (.16,.368),(.30,.394),(.46,.402),(.58,.428),(.69,.47)], depth=.031)
        stem([(.44,.398),(.48,.53),(.51,.64)], depth=.060)
        def casting(outline, center, depth, hole=None):
            # Narrow shoulders curve into the face of the casting. The eye is a separate
            # inner wall of the same shell, so head and body have one continuous surface.
            outline = list(outline)
            area = sum(a[0]*b[1]-a[1]*b[0] for a,b in zip(outline,outline[1:]+outline[:1]))
            if area < 0:
                outline.reverse()
            count = len(outline)
            rim = [(u*.89+center[0]*.11,h*.89+center[1]*.11) for u,h in outline]
            rows = [(-depth,rim),(-depth*.52,outline),(depth*.52,outline),(depth,rim)]
            vertices = [(x+d,y+u,z+h) for d,row in rows for u,h in row]
            faces = []
            for j in range(3):
                for i in range(count):
                    a,b = j*count+i,j*count+(i+1)%count
                    faces.append((a,b,b+count,a+count))
            if hole is None:
                faces.extend((tuple(reversed(range(count))),tuple(range(3*count,4*count))))
            else:
                # Triangulate both annular caps with opposite windings and join the bore.
                hole_count = len(hole)
                vertices.extend((x+d,y+u,z+h) for d in (-depth,depth) for u,h in hole)
                loops = [[Vector(v) for v in row] for row in (rim,hole)]
                for triangle in tessellate_polygon(loops):
                    cap = list(triangle)
                    a,b,c = [(rim+hole)[i] for i in cap]
                    if (b[0]-a[0])*(c[1]-a[1]) < (b[1]-a[1])*(c[0]-a[0]):
                        cap.reverse()
                    bottom = lambda i: i if i<count else 4*count+i-count
                    top = lambda i: 3*count+i if i<count else 4*count+hole_count+i-count
                    faces.extend((tuple(bottom(i) for i in reversed(cap)),tuple(top(i) for i in cap)))
                for i in range(hole_count):
                    a,b = 4*count+i,4*count+(i+1)%hole_count
                    faces.append((a,b,b+hole_count,a+hole_count))
            part.solid(vertices, faces)

        def relief(path, depth, width):
            # A low rounded rib emerges from each cast face, with thinner ends.
            for side in (-1,1):
                rings = []
                for i,(u,h) in enumerate(path):
                    a,b = path[max(i-1,0)],path[min(i+1,len(path)-1)]
                    du,dh = b[0]-a[0],b[1]-a[1]
                    length = hypot(du,dh)
                    scale = max(.0135,width*(.82 if i in (0,len(path)-1) else 1))
                    rings.append([(x+side*(depth-.008)+.022*cos(k*tau/6),
                                   y+u+dh/length*scale*sin(k*tau/6),
                                   z+h-du/length*scale*sin(k*tau/6)) for k in range(6)])
                vertices = [v for ring in rings for v in ring]
                faces = []
                for j in range(len(rings)-1):
                    for i in range(6):
                        a,b = 6*j+i,6*j+(i+1)%6
                        faces.append((a,b,b+6,a+6))
                for start, (u,h) in [(0,path[0]),(6*(len(rings)-1),path[-1])]:
                    center = len(vertices)
                    vertices.append((x+side*(depth-.008),y+u,z+h))
                    for i in range(6):
                        a,b = start+i,start+(i+1)%6
                        faces.append((center,b,a) if start==0 else (center,a,b))
                part.solid(vertices, faces)

        casting([(-.540,.854),(-.509,.850),(-.479,.824),(-.482,.874),(-.467,.901),
                 (-.435,.880),(-.411,.832),(-.401,.886),(-.377,.934),(-.352,.953),
                 (-.332,.929),(-.328,.871),(-.310,.824),(-.293,.880),(-.264,.908),
                 (-.243,.887),(-.246,.848),(-.267,.807),(-.301,.778),(-.350,.765),
                 (-.407,.772),(-.457,.789),(-.511,.818)], (-.387,.826), .039)
        casting([(-.445,.623),(-.400,.666),(-.352,.707),(-.283,.733),(-.219,.740),
                 (-.151,.727),(-.090,.702),(-.054,.671),(-.111,.649),(-.181,.622),
                 (-.257,.602),(-.330,.599),(-.397,.609)], (-.252,.662), .042)
        relief([(-.407,.624),(-.352,.642),(-.292,.662),(-.221,.688),(-.157,.704)], .042, .010)

        fish = [(.047,.610),(.040,.642),(.065,.675),(.106,.702),(.161,.721),
                (.219,.739),(.292,.759),(.364,.758),(.436,.739),(.489,.712),
                (.528,.688),(.579,.728),(.642,.770),(.662,.765),(.656,.734),
                (.630,.675),(.644,.626),(.674,.578),(.656,.562),(.604,.582),
                (.531,.622),(.479,.593),(.418,.561),(.343,.540),(.278,.535),
                (.233,.526),(.177,.541),(.117,.552),(.076,.573)]
        eye = [(.124+.028*cos(i*tau/8),.649-.030*sin(i*tau/8)) for i in range(8)]
        casting(fish, (.339,.644), .047, eye)
        relief([(.217,.706),(.232,.677),(.235,.642),(.222,.605),(.200,.580)], .047, .014)
        relief([(.263,.614),(.291,.598),(.314,.579),(.328,.558)], .047, .013)
    else:  # A deer framed by plum branches.
        stem([(-.69,.414),(-.52,.550),(-.49,.756),(-.35,.895),(-.12,1.024)], .027, depth=.060)
        stem([(-.49,.758),(-.621,.869),(-.69,.967)], depth=.044)
        silhouette([(-.40,.827),(-.402,.879),(-.347,.887),(-.333,.947),(-.285,.936),
                    (-.274,.886),(-.226,.890),(-.231,.838),(-.305,.792)])
        silhouette([(-.38,.622),(-.318,.719),(-.213,.682),(.094,.676),(.189,.736),
                    (.266,.857),(.236,.903),(.290,.897),(.331,.933),(.347,.886),
                    (.443,.858),(.422,.815),(.334,.794),(.285,.650),(.194,.591),
                    (.174,.326),(.115,.326),(.087,.557),(-.147,.547),(-.224,.408),
                    (-.179,.326),(-.245,.326),(-.297,.433),(-.267,.590)])
        stem([(.344,.886),(.400,.944),(.393,1.028)], depth=.060)
        stem([(.389,.935),(.472,.964),(.493,1.021)], depth=.044)


def build_road():
    paving = Part("Roadway and approach surfaces", "deck")
    walks = Part("Cantilevered walks, kerbs and markings", "plaster")
    railings = Part("Cast-iron parapets and plain pickets", "steel")
    flowers = Part("Openwork cast iron: magpie, carp and lotus, deer and plum", "steel")
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
                yc = y + dy*.5
                if abs(yc) < MAIN_END and i % 2 == 0:
                    cast_flower_panel(flowers, x, yc, (i//2) % 3)
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
    for part in (paving, walks, railings, flowers, standards, lamps):
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
    plinth = Part("Granite tower bases and gallery apron", "stone")
    finials = Part("Red pearl finials", "vermilion")
    for cy in (-82, 82):
        road_z = road_height(cy)
        for cx in (-8.6, 8.6):
            # The pavement enters the pavilion at the top of its masonry lift shaft.
            loft(body, [octagonal_ring(cx, cy, r, cut, h) for h, r, cut in
                        [(-1.2, 2.78, .38), (.52, 2.78, .38), (.82, 2.53, .31),
                         (road_z-.89, 2.53, .31), (road_z-.53, 2.86, .36), (road_z+.07, 2.89, .42)]])
            loft(plinth, [octagonal_ring(cx, cy, r, .45, h) for h, r in
                          [(.13, 2.87), (.49, 2.87), (.71, 2.67), (.84, 2.55)]])
            loft(trim, [octagonal_ring(cx, cy, r, .45, h) for h, r in
                        [(road_z-.13, 2.86), (road_z+.08, 3.20), (road_z+.22, 3.20)]])
            for side in (-1, 1):
                for u in (-1.81, 0, 1.81):
                    trim.beam((cx+side*2.52, cy+u, road_z-.94),
                              (cx+side*3.10, cy+u, road_z+.04), .23, .28)
                y = cy + side * 2.52
                plinth.box((cx, y, road_z+1.75), (1.66, .21, 2.56))
                glass.box((cx, y+side*.12, road_z+1.94), (1.37, .08, 1.92))
                for u in (-.46, 0, .46):
                    tracery.box((cx+u, y+side*.17, road_z+1.94), (.08, .08, 1.92))
                for z in (1.20, 1.68, 2.16, 2.64):
                    tracery.box((cx, y+side*.17, road_z+z), (1.37, .08, .074))
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
                # The long window ends in a half-round lotus balcony cut into the shaft.
                for z, radius, depth, thickness in ((-.63, .39, .24, .13), (-.46, .64, .44, .23),
                                                      (-.22, .95, .71, .25), (-.02, 1.06, .79, .16)):
                    outline = [point(radius*cos(i*pi/10), 2.52+depth*sin(i*pi/10), bottom+z)[:2]
                               for i in range(11)]
                    trim.prism(outline, bottom+z-thickness/2, bottom+z+thickness/2)
                for i in range(11):
                    angle = i*pi/10
                    c, s = cos(angle), sin(angle)
                    u, v = 1.02*c, 2.52+.77*s
                    trim.box(point(u, v, bottom+.20), (.09, .09, .29), a)
                    trim.beam(point(.62*c, 2.52+.43*s, bottom-.49),
                              point(.94*c, 2.52+.71*s, bottom-.21), .095)
                    if i < 10:
                        next_angle = (i+1)*pi/10
                        trim.beam(point(u, v, bottom+.36),
                                  point(1.02*cos(next_angle), 2.52+.77*sin(next_angle), bottom+.36), .101)
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
    for part in (body, trim, glass, tracery, roof, plinth, finials):
        part.finish()


# Simplified-Chinese outlines from LXGW WenKai Medium, © 2024 The LXGW WenKai Project Authors.
# https://github.com/lxgw/LxgwWenKai — SIL Open Font License 1.1, see docs/wenkai-license.txt.
NAME_GLYPHS = {
    '武': (
        '891,-104 853,-93 810,-61 764,-8 695,96 638,214 601,328 587,389 570,470 159,448 123,450 104,455 82,479 '
        '70,506 82,520 98,518 126,515 138,515 166,517 212,519 273,523 351,527 446,532 557,538 542,629 532,704 '
        '525,756 520,780 508,800 501,814 519,829 562,825 586,812 594,795 600,761 631,541 717,546 780,550 820,554 '
        '837,556 860,560 884,550 906,526 915,506 907,492 883,486 644,473 678,328 730,193 763,129 796,78 826,38 '
        '850,11 867,-5 874,-10 877,-3 884,18 894,52 920,162 932,198 947,210 960,200 964,169 940,-47 930,-79 '
        '914,-98',
        '788,577 772,585 748,608 708,646 646,695 630,719 641,742 662,756 683,748 720,724 774,685 813,648 826,625 '
        '812,594',
        '259,596 221,603 204,620 189,655 202,667 219,664 260,661 333,666 387,670 421,673 436,676 457,679 482,668 '
        '501,648 507,633 499,617 475,610',
        '148,-51 120,-38 97,-10 89,11 108,25 204,40 199,277 190,308 182,329 199,339 230,334 260,322 270,301 '
        '274,56 342,74 337,382 328,414 320,434 337,444 368,439 398,427 409,406 410,305 464,310 492,315 513,319 '
        '534,309 556,287 564,267 556,254 532,249 411,240 413,93 494,118 547,136 580,146 599,150 616,135 608,119 '
        '585,104 445,42 320,-6 211,-38 170,-48',
    ),
    '汉': (
        '147,-29 116,-22 87,-2 78,13 94,30 125,59 227,198 306,321 324,344 339,351 350,346 353,330 348,310 332,272 '
        '306,216 193,15 171,-16',
        '207,389 79,492 63,513 72,538 92,555 121,543 220,477 259,443 272,421 258,390 233,375',
        '321,571 295,587 244,643 177,709 163,733 174,756 197,769 230,754 252,734 292,696 348,639 361,617 355,598 '
        '338,578',
        '289,-55 278,-38 284,-23 303,-4 455,139 583,301 503,429 446,542 433,576 429,594 446,614 475,620 497,600 '
        '562,470 625,365 681,466 723,561 752,651 448,632 420,634 404,642 383,669 373,694 387,706 434,702 447,702 '
        '478,704 527,706 595,710 681,714 786,720 800,721 825,714 841,695 847,677 842,662 836,653 766,471 669,303 '
        '806,147 963,16 977,-3 972,-16 956,-32 919,-49 896,-41 753,94 626,242 518,114 404,13 326,-38 301,-51',
    ),
    '长': (
        '58,404 62,414 72,418 86,416 111,413 277,421 277,722 261,770 255,785 271,797 298,794 335,780 353,752 '
        '352,425 481,432 590,437 682,442 754,446 858,453 877,456 898,448 926,426 935,404 927,388 903,381 518,362 '
        '570,291 632,221 728,138 831,72 941,23 961,12 968,0 956,-22 929,-48 904,-57 901,-57 787,0 667,84 539,210 '
        '433,358 352,354 351,50 417,80 468,106 506,127 535,138 538,138 553,124 540,98 496,62 415,7 345,-36 '
        '290,-66 256,-83 220,-94 196,-85 168,-57 153,-28 160,-19 185,-14 219,-6 271,15 276,17 276,351 116,344 '
        '88,351 66,377',
        '383,469 369,483 369,485 376,497 393,508 505,572 604,644 655,690 688,727 703,756 710,772 721,777 746,764 '
        '766,736 773,714 762,692 685,616 602,556 515,510 427,477 399,471',
    ),
    '江': (
        '156,700 140,721 144,736 158,757 174,764 193,757 226,736 272,702 331,653 346,629 332,600 306,580 287,590 '
        '254,618',
        '351,12 320,18 300,46 285,77 302,91 358,85 590,93 595,558 445,549 423,550 412,555 378,610 392,623 434,618 '
        '447,619 477,620 524,623 589,627 671,632 770,638 810,646 830,651 853,641 882,616 891,594 884,580 861,574 '
        '671,562 668,95 747,98 810,100 856,102 885,104 898,105 915,108 936,98 961,74 972,50 965,37 944,31',
        '228,368 209,377 176,404 80,476 62,500 73,526 93,541 106,537 130,524 166,501 213,467 253,435 266,416 '
        '253,386',
        '136,-66 80,-47 62,-23 78,-8 108,20 212,174 305,325 319,344 334,351 347,336 341,311 325,267 296,203 '
        '249,104 208,28 177,-24 162,-52',
    ),
    '大': (
        '45,-79 27,-65 33,-51 52,-36 159,38 249,121 321,213 374,315 410,425 331,421 267,417 217,415 183,413 '
        '163,412 127,424 103,458 97,480 111,491 159,486 174,487 208,488 261,491 333,496 425,501 437,604 441,721 '
        '427,768 422,784 441,796 477,788 514,769 527,737 520,611 509,505 793,522 824,528 843,533 865,523 895,498 '
        '905,475 897,457 872,450 539,432 608,313 690,206 784,113 864,52 951,2 967,-8 972,-18 958,-40 928,-65 '
        '906,-73 894,-68 870,-55 784,4 694,86 578,224 485,382 452,285 403,195 338,112 248,29 148,-35 101,-59 '
        '67,-74',
    ),
    '桥': (
        '772,-106 750,-98 726,-78 716,-56 720,-25 721,-11 721,18 722,63 723,124 723,201 723,294 713,328 703,348 '
        '708,358 724,362 760,354 788,337 794,314 795,-74 789,-98',
        '378,-88 366,-75 386,-46 451,26 498,103 526,185 535,271 533,311 528,324 526,314 489,270 441,225 404,196 '
        '381,187 365,191 360,203 374,226 482,367 518,431 538,476 460,472 428,483 404,515 403,518 382,510 300,503 '
        '299,447 300,447 319,440 344,420 376,386 416,337 429,308 412,284 384,271 358,290 326,337 298,373 293,-71 '
        '287,-94 269,-101 227,-82 214,-60 218,-26 223,22 223,124 223,206 224,267 224,308 225,329 207,292 172,237 '
        '118,163 85,121 60,95 44,87 32,103 43,131 138,304 222,495 166,490 130,487 112,486 93,491 75,507 58,540 '
        '72,556 104,553 124,554 229,563 231,740 222,770 214,788 219,798 235,802 270,794 297,780 303,758 301,570 '
        '326,573 340,576 355,579 375,571 398,553 408,535 415,536 454,532 559,540 581,609 590,657 537,648 498,642 '
        '473,640 449,644 441,655 453,670 488,682 586,707 596,713 604,712 678,737 732,762 766,786 780,792 800,780 '
        '821,754 830,733 825,720 800,706 770,695 720,684 688,677 668,672 660,671 667,650 664,629 655,594 639,546 '
        '718,552 780,557 826,561 856,564 869,566 891,569 914,559 933,538 940,520 933,509 912,503 771,494 858,380 '
        '973,284 986,269 978,249 956,223 936,214 901,232 830,294 763,380 700,489 617,482 558,358 595,343 607,320 '
        '606,264 604,232 599,202 588,150 571,90 542,40 482,-27 412,-74 390,-84',
    ),
}


def build_nameplates():
    """Mount model wayfinding plaques on the outward face of the tower gallery apron."""
    frame = Part("Bridgehead nameplate frames", "bronze")
    board = Part("Bridgehead enamel nameplates", "plaqueBlue")
    gold = Part("武汉长江大桥 · raised lettering", "plaqueGold")
    relief = bpy.data.curves.new("Wuhan Yangtze River Bridge inscription", 'CURVE')
    relief.dimensions = '2D'
    relief.fill_mode = 'BOTH'
    relief.extrude = .019
    for i, char in enumerate('武汉长江大桥'):
        for contour in NAME_GLYPHS[char]:
            points = [tuple(map(int, coord.split(','))) for coord in contour.split()]
            loop = relief.splines.new('POLY')
            loop.points.add(len(points) - 1)
            for point, (u, z) in zip(loop.points, points):
                point.co = ((i-2.5)*.682+(u-500)*.00066, (z-365)*.00065, 0, 1)
            loop.use_cyclic_u = True
    cutter = bpy.data.objects.new(relief.name, relief)
    bpy.context.collection.objects.link(cutter)
    evaluated = cutter.evaluated_get(bpy.context.evaluated_depsgraph_get())
    lettering = evaluated.to_mesh()
    welded = bmesh.new()
    try:
        welded.from_mesh(lettering)
        bmesh.ops.remove_doubles(welded, verts=list(welded.verts), dist=1e-6)
        welded.to_mesh(lettering)
        for y in (-82, 82):
            z = road_height(y) - .44
            frame.box((11.46, y, z), (.55, 4.70, .89))
            frame.box((11.84, y, z), (.22, 4.62, .89))
            board.box((11.952, y, z), (.046, 4.46, .74))
            gold.solid([(11.981+v.co.z, y+v.co.x, z+v.co.y) for v in lettering.vertices],
                       [poly.vertices for poly in lettering.polygons])
    finally:
        welded.free()
        evaluated.to_mesh_clear()
        bpy.data.objects.remove(cutter, do_unlink=True)
        bpy.data.curves.remove(relief)
    for part in (frame, board, gold):
        part.finish()


def build():
    original = set(bpy.context.scene.objects)
    build_piers()
    build_trusses_and_rail()
    build_road()
    build_approaches()
    bend_hanyang(set(bpy.context.scene.objects) - original)
    build_towers()
    build_nameplates()
