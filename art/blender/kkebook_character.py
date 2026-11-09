"""
B_photoproject - kkebook 캐릭터 (웹/Three.js용 GLB 제작 스크립트)
시안 B-1: 평평한 윗면 + 양옆 눈 돌기 + 세모 입, 얼굴 폭 12% 축소
Blender 3.6 / 4.x 대응

실행: Scripting 탭 > Text Editor > 이 파일 열기(또는 붙여넣기) > Run Script (Alt+P)
다시 실행하면 'Kkebook', 'Kkebook_Preview' 컬렉션만 지우고 새로 만듭니다.
(frog 샘플이 있는 'Frog' 컬렉션은 건드리지 않음)

구조 (frog 샘플과 동일한 방식, 이름만 kkebook)
- 피벗 Empty 계층: 코드가 피벗을 회전시켜 걷기
    kkebook-left-arm-pivot / kkebook-right-arm-pivot
    kkebook-left-leg-pivot / kkebook-right-leg-pivot   (left = -X, 정면에서 화면 왼쪽)
- 악세서리 앵커:
    kkebook-head-anchor  머리 위 평평한 면 중앙 (모자)
    kkebook-face-anchor  얼굴 앞 (안경, 선글라스, 풍선껌)
    kkebook-neck-anchor  머리와 몸 사이 중앙 (목도리, 리본)
    kkebook-body-anchor  몸통 중앙 (크로스백)
    kkebook-hand-anchor  오른팔 피벗의 자식, 손 끝 (풍선, 붕어빵, 책)
- 입 3종 (kkebook-head의 자식, 웹에서 하나만 보이게 바꿔 끼움):
    kkebook-mouth-triangle  기본 세모 입
    kkebook-mouth-round     원형 입 'o' (풍선껌)
    kkebook-mouth-cat       'ω' 입 (선글라스)
  Blender 화면에서는 round/cat을 숨겨 두지만, 내보내기에는 셋 다 들어갑니다.
- 재질 4개: Kkebook_Body(색 변경용) / Kkebook_Belly / Kkebook_Blush / Kkebook_Face
- glTF 내보내기 시 Blender(Z위, -Y정면) -> Three.js(Y위, +Z정면) 자동 변환
"""
import math

# ============================================================
# 1. 파라미터 (수정은 여기서) - 형태 수치는 '시안 단위'
# ============================================================
S = 2.29 / 3.0     # 시안 단위 -> 프로젝트 로컬 단위 (frog 샘플과 같은 몸 크기)
W = 0.88           # 얼굴 가로폭 배율 (B-1 = 0.88, 기존 B = 1.0)

COLORS = {
    "Kkebook_Body":  "#B9E59A",
    "Kkebook_Belly": "#FFF7D8",
    "Kkebook_Blush": "#FFAAA7",
    "Kkebook_Face":  "#4A3932",
}
ROUGHNESS = {"Kkebook_Body": 0.78, "Kkebook_Belly": 0.82, "Kkebook_Blush": 0.9, "Kkebook_Face": 0.72}

HEAD = dict(
    lower_c=(0.0, 0.0, 1.65), lower_r=(1.42*W, 0.98, 0.52),   # 아래쪽 넓은 볼 부분
    upper_c=(0.0, 0.0, 1.97), upper_r=(1.08*W, 0.90, 0.62),   # 위쪽 (평평한 윗면)
    blend=0.48,                                               # 위/아래 이음새 (중간 형태: 잘록함 유지 + 주름 완화)
    bump_x=0.86*W, bump_y=0.02, bump_z=2.40, bump_r=0.39,     # 양옆 눈 돌기
    bump_blend=0.29,                                          # 돌기-머리 이음새 (0.22=처음, 0.29=중간, 0.40=옆면 채움)
)
BODY = dict(
    upper_c=(0.0, 0.0, 1.02), upper_r=(0.72, 0.64, 0.55),
    lower_c=(0.0, 0.0, 0.66), lower_r=(0.86, 0.74, 0.44),
    blend=0.30,
)
BELLY = dict(center=(0.0, -0.44, 0.78), radii=(0.58, 0.36, 0.43))
ARM = dict(shoulder=(0.72, -0.05, 1.12), hand=(1.04, -0.12, 0.80), r0=0.18, r1=0.24)
LEG = dict(hip=(0.40, 0.0, 0.60), foot=(0.42, -0.06, 0.22), r0=0.21, r1=0.25)

EYE = dict(x=0.86*W, z=2.44, r=0.118, depth=0.035)         # 돌기 위 작은 점
MOUTH = dict(x=0.0, z=1.95, w=0.20, h=0.15, round=0.035)    # 기본 입: 아래로 뾰족한 세모 (평면 무늬)
# 바꿔 끼우는 입 (웹에서 악세서리에 따라 하나만 보임)
MOUTH_ROUND = dict(x=0.0, z=1.95, rx=0.078, rz=0.088)       # 원형 입 'o' (풍선껌)
MOUTH_CAT = dict(x=0.0, z=1.95, a=0.066, ry=0.068,          # 'ω' 입 (선글라스)
                 stroke=0.036, curl=0.45)                   # a=반쪽 폭, ry=깊이, stroke=선 굵기, curl=양끝 말림(라디안)
BLUSH = dict(x=1.02*W, z=1.66, r=0.30)

RES_HEAD = (64, 128)   # 웹용 해상도 (전체 약 3만 삼각형)
RES_PART = (24, 48)

# 비워두면 내보내기 안 함. 예: "/Users/hyone/Desktop/kkebook.glb"
EXPORT_PATH = ""

PREFIX = "kkebook"
HIDDEN_IN_VIEWPORT = ("kkebook-mouth-round", "kkebook-mouth-cat")   # Blender 화면에서만 숨김
COL_NAME, PREVIEW_COL_NAME = "Kkebook", "Kkebook_Preview"

# ============================================================
# 2. 형태 함수 (SDF) - bpy 없이 동작
# ============================================================
def sub(a, b): return (a[0]-b[0], a[1]-b[1], a[2]-b[2])
def add(a, b): return (a[0]+b[0], a[1]+b[1], a[2]+b[2])
def mul(a, s): return (a[0]*s, a[1]*s, a[2]*s)
def dot(a, b): return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]
def length(a): return math.sqrt(dot(a, a))
def norm(a):
    l = length(a) or 1e-9
    return (a[0]/l, a[1]/l, a[2]/l)
def cross(a, b): return (a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0])

def sd_ellipsoid(p, c, r):
    q = sub(p, c)
    k0 = length((q[0]/r[0], q[1]/r[1], q[2]/r[2]))
    k1 = length((q[0]/(r[0]*r[0]), q[1]/(r[1]*r[1]), q[2]/(r[2]*r[2])))
    if k1 < 1e-9:
        return -min(r)
    return k0*(k0-1.0)/k1

def sd_sphere(p, c, r): return length(sub(p, c)) - r

def sd_taper_capsule(p, a, b, ra, rb):
    pa, ba = sub(p, a), sub(b, a)
    t = max(0.0, min(1.0, dot(pa, ba)/dot(ba, ba)))
    return length(sub(pa, mul(ba, t))) - (ra + (rb-ra)*t)

def smin(a, b, k):
    h = max(k-abs(a-b), 0.0)/k
    return min(a, b) - h*h*k*0.25

def sd_head(p):
    h = HEAD
    d = smin(sd_ellipsoid(p, h["lower_c"], h["lower_r"]),
             sd_ellipsoid(p, h["upper_c"], h["upper_r"]), h["blend"])
    for s in (-1, 1):
        d = smin(d, sd_sphere(p, (s*h["bump_x"], h["bump_y"], h["bump_z"]), h["bump_r"]), h["bump_blend"])
    return d

def sd_body(p):
    b = BODY
    return smin(sd_ellipsoid(p, b["upper_c"], b["upper_r"]),
                sd_ellipsoid(p, b["lower_c"], b["lower_r"]), b["blend"])

def sd_belly(p): return sd_ellipsoid(p, BELLY["center"], BELLY["radii"])

def mirror(v, side): return (v[0]*side, v[1], v[2])

def make_sd_arm(side):
    a, h = mirror(ARM["shoulder"], side), mirror(ARM["hand"], side)
    return lambda p: sd_taper_capsule(p, a, h, ARM["r0"], ARM["r1"])

def make_sd_leg(side):
    a, f = mirror(LEG["hip"], side), mirror(LEG["foot"], side)
    return lambda p: max(sd_taper_capsule(p, a, f, LEG["r0"], LEG["r1"]), -p[2])  # 발바닥 평평

def grad(f, p, e=1e-4):
    return norm((f((p[0]+e, p[1], p[2]))-f((p[0]-e, p[1], p[2])),
                 f((p[0], p[1]+e, p[2]))-f((p[0], p[1]-e, p[2])),
                 f((p[0], p[1], p[2]+e))-f((p[0], p[1], p[2]-e))))

def ray_hit(f, origin, d, tmax=5.0, steps=80):
    """origin(안쪽)에서 d 방향으로, 바깥(tmax)부터 안쪽으로 훑어 가장 바깥 표면을 찾음"""
    prev_t = tmax
    for i in range(1, steps+1):
        t = tmax*(1.0 - i/steps)
        if f(add(origin, mul(d, t))) < 0.0:
            lo, hi = t, prev_t
            for _ in range(28):
                m = 0.5*(lo+hi)
                if f(add(origin, mul(d, m))) < 0.0: lo = m
                else: hi = m
            return add(origin, mul(d, 0.5*(lo+hi)))
        prev_t = t
    return origin

def radial_mesh(f, center, rings, segs, tmax=3.0):
    """중심에서 사방으로 광선을 쏴서 표면을 감싸는 구형 메쉬 (깔끔한 UV구 토폴로지)"""
    verts, faces = [], []
    verts.append(ray_hit(f, center, (0, 0, 1), tmax))
    for i in range(1, rings):
        th = math.pi*i/rings
        for j in range(segs):
            ph = 2*math.pi*j/segs
            d = (math.sin(th)*math.cos(ph), math.sin(th)*math.sin(ph), math.cos(th))
            verts.append(ray_hit(f, center, d, tmax))
    verts.append(ray_hit(f, center, (0, 0, -1), tmax))
    bottom = len(verts)-1
    idx = lambda i, j: 1 + (i-1)*segs + (j % segs)
    for j in range(segs):
        faces.append((0, idx(1, j), idx(1, j+1)))
    for i in range(1, rings-1):
        for j in range(segs):
            faces.append((idx(i, j), idx(i+1, j), idx(i+1, j+1), idx(i, j+1)))
    for j in range(segs):
        faces.append((idx(rings-1, j+1), idx(rings-1, j), bottom))
    return verts, faces

def front_point(f, x, z):
    """머리 중심 높이에서 정면(-Y)으로 쏴서 표면 위 점과 법선"""
    p = ray_hit(f, (x, 0.0, z), (0, -1, 0), tmax=3.0)
    return p, grad(f, p)

def tangent_frame(n):
    t = norm(cross((0, 0, 1), n)) if abs(n[2]) < 0.99 else (1, 0, 0)
    return t, cross(n, t)

def oriented_ellipsoid(center, n, r, depth, rings=10, segs=20):
    t, b = tangent_frame(n)
    verts, faces = [], []
    for i in range(rings+1):
        th = math.pi*i/rings
        for j in range(segs):
            ph = 2*math.pi*j/segs
            lx, ly, lz = r*math.sin(th)*math.cos(ph), r*math.sin(th)*math.sin(ph), depth*math.cos(th)
            verts.append(add(center, add(add(mul(t, lx), mul(b, ly)), mul(n, lz))))
    for i in range(rings):
        for j in range(segs):
            a = i*segs + j; c = i*segs + (j+1) % segs
            faces.append((a, a+segs, c+segs, c))
    return verts, faces

def polar_patch(f, place, boundary_r, rings=8, segs=48):
    """극좌표 격자로 만든 표면 패치. boundary_r(각도) = 가장자리까지 거리"""
    verts = [place(0.0, 0.0)]
    for i in range(1, rings+1):
        for j in range(segs):
            a = 2*math.pi*j/segs
            rr = boundary_r(a)*i/rings
            verts.append(place(rr*math.cos(a), rr*math.sin(a)))
    faces = [(0, 1+j, 1+(j+1) % segs) for j in range(segs)]
    for i in range(1, rings):
        for j in range(segs):
            a = 1+(i-1)*segs+j; c = 1+(i-1)*segs+(j+1) % segs
            faces.append((a, a+segs, c+segs, c))
    return verts, faces

def surface_disk(f, center, n, r, offset=0.006):
    """표면에 붙는 원형 패치 (볼터치)"""
    t, b = tangent_frame(n)
    def place(lx, ly):
        q = add(center, add(mul(t, lx), mul(b, ly)))
        p = ray_hit(f, add(q, mul(n, -0.5)), n, tmax=1.0)   # 안쪽에서 바깥으로
        return add(p, mul(grad(f, p), offset))
    return polar_patch(f, place, lambda a: r, rings=8, segs=40)

def sd_round_triangle(x, y, w, h, rad):
    """아래로 뾰족한 둥근 세모 (2D)"""
    A, B, C = (-w/2, h/2), (w/2, h/2), (0.0, -h/2)
    d = 1e9
    for (ax, ay), (bx, by) in ((A, B), (B, C), (C, A)):
        ex, ey = bx-ax, by-ay; wx, wy = x-ax, y-ay
        t = max(0.0, min(1.0, (wx*ex+wy*ey)/(ex*ex+ey*ey)))
        d = min(d, math.hypot(wx-t*ex, wy-t*ey))
    def side(a, b): return (b[0]-a[0])*(y-a[1]) - (b[1]-a[1])*(x-a[0])
    inside = side(A, B) <= 0 and side(B, C) <= 0 and side(C, A) <= 0
    return (-d if inside else d) - rad

def mouth_patch(f):
    """세모 입: 얼굴 표면에 붙는 평면 무늬 (파인 구멍이 아님)"""
    m = MOUTH
    cy = -m["h"]/6   # 세모 무게중심 (위로 넓은 쪽이 무거움)
    def boundary(a):
        lo, hi = 0.0, 0.5
        for _ in range(30):
            mid = 0.5*(lo+hi)
            if sd_round_triangle(mid*math.cos(a), cy+mid*math.sin(a), m["w"], m["h"], m["round"]) < 0: lo = mid
            else: hi = mid
        return lo
    def place(lx, ly):
        p, n = front_point(f, m["x"]+lx, m["z"]+cy+ly)
        return add(p, mul(n, 0.008))
    return polar_patch(f, place, boundary, rings=6, segs=60)

def round_mouth_patch(f):
    """원형 입 'o': 세모 입과 같은 평면 무늬"""
    m = MOUTH_ROUND
    def place(lx, ly):
        p, n = front_point(f, m["x"]+lx, m["z"]+ly)
        return add(p, mul(n, 0.008))
    def boundary(a):
        return 1.0/math.sqrt((math.cos(a)/m["rx"])**2 + (math.sin(a)/m["rz"])**2)
    return polar_patch(f, place, boundary, rings=5, segs=48)

def stroke_patch(place, pts, width, cap_segs=8):
    """2D 선(점 목록)을 일정 굵기의 띠로 만들고 양끝을 둥글게 마감"""
    hw = width*0.5
    verts, faces = [], []
    def nrm(i):
        a, b = pts[max(i-1, 0)], pts[min(i+1, len(pts)-1)]
        tx, ty = b[0]-a[0], b[1]-a[1]; l = math.hypot(tx, ty)
        return (-ty/l, tx/l)
    for i, (x, y) in enumerate(pts):
        nx, ny = nrm(i)
        verts += [place(x+nx*hw, y+ny*hw), place(x-nx*hw, y-ny*hw)]
    for i in range(len(pts)-1):
        a = 2*i
        faces.append((a, a+1, a+3, a+2))
    for end, sgn in ((0, -1), (len(pts)-1, 1)):
        x, y = pts[end]; nx, ny = nrm(end)
        tx, ty = ny*sgn, -nx*sgn      # 선 바깥쪽 방향
        c = len(verts); verts.append(place(x, y))
        ring = []
        for k in range(cap_segs+1):
            t = math.pi*k/cap_segs
            ox = math.cos(t)*nx*hw + math.sin(t)*tx*hw
            oy = math.cos(t)*ny*hw + math.sin(t)*ty*hw
            ring.append(len(verts)); verts.append(place(x+ox, y+oy))
        for k in range(cap_segs):
            faces.append((c, ring[k], ring[k+1]) if sgn < 0 else (c, ring[k+1], ring[k]))
    return verts, faces

def cat_mouth_patch(f, segs=20):
    """'ω' 입: 아래로 둥근 반원 두 개가 가운데에서 만나는 선 무늬"""
    m = MOUTH_CAT
    a, ry, cu = m["a"], m["ry"], m["curl"]
    lift = ry*0.45      # 위아래 가운데를 z에 맞춤
    def place(lx, ly):
        p, n = front_point(f, m["x"]+lx, m["z"]+ly+lift)
        return add(p, mul(n, 0.009))
    verts, faces = [], []
    for cx, t0, t1 in ((-a, math.pi-cu, 2*math.pi), (a, math.pi, 2*math.pi+cu)):
        pts = [(cx + a*math.cos(t0+(t1-t0)*i/segs), ry*math.sin(t0+(t1-t0)*i/segs)) for i in range(segs+1)]
        v, fc = stroke_patch(place, pts, m["stroke"])
        o = len(verts); verts += v; faces += [tuple(x+o for x in q) for q in fc]
    return verts, faces

class MeshBuilder:
    """여러 조각을 한 메쉬로 합치며 면마다 재질 번호를 기록"""
    def __init__(self, materials):
        self.materials = materials
        self.verts, self.faces, self.mat_idx = [], [], []
    def add(self, verts, faces, material):
        o = len(self.verts)
        self.verts += verts
        self.faces += [tuple(x+o for x in f) for f in faces]
        self.mat_idx += [self.materials.index(material)]*len(faces)

def build_scene_graph():
    """노드 계층: (이름, 부모, 위치[시안 단위], 메쉬 or None)"""
    P = PREFIX
    nodes = []

    head = MeshBuilder(["Kkebook_Body", "Kkebook_Blush", "Kkebook_Face"])
    head.add(*radial_mesh(sd_head, (0, 0, 2.0), *RES_HEAD), "Kkebook_Body")
    for s in (-1, 1):
        p, n = front_point(sd_head, s*BLUSH["x"], BLUSH["z"])
        head.add(*surface_disk(sd_head, p, n, BLUSH["r"]), "Kkebook_Blush")
        p, n = front_point(sd_head, s*EYE["x"], EYE["z"])
        head.add(*oriented_ellipsoid(add(p, mul(n, -EYE["depth"]*0.4)), n, EYE["r"], EYE["depth"]), "Kkebook_Face")

    body = MeshBuilder(["Kkebook_Body", "Kkebook_Belly"])
    body.add(*radial_mesh(sd_body, (0, 0, 0.85), *RES_PART), "Kkebook_Body")
    body.add(*radial_mesh(sd_belly, BELLY["center"], 20, 40, tmax=1.0), "Kkebook_Belly")

    nodes.append((f"{P}-visitor-model", None, (0, 0, 0), None))
    nodes.append((f"{P}-body", f"{P}-visitor-model", (0, 0, 0.85), body))
    nodes.append((f"{P}-head", f"{P}-visitor-model", (0, 0, 1.30), head))

    # 입 3종: 머리의 자식 노드. 웹 코드가 하나만 보이게 바꿔 끼움 (기본 = 세모)
    for name, patch in (("triangle", mouth_patch), ("round", round_mouth_patch), ("cat", cat_mouth_patch)):
        mouth = MeshBuilder(["Kkebook_Face"])
        mouth.add(*patch(sd_head), "Kkebook_Face")
        nodes.append((f"{P}-mouth-{name}", f"{P}-head", (0, 0, 1.30), mouth))

    for side, tag in ((-1, "left"), (1, "right")):
        sh, hd = mirror(ARM["shoulder"], side), mirror(ARM["hand"], side)
        arm = MeshBuilder(["Kkebook_Body"])
        arm.add(*radial_mesh(make_sd_arm(side), mul(add(sh, hd), 0.5), *RES_PART, tmax=1.0), "Kkebook_Body")
        nodes.append((f"{P}-{tag}-arm-pivot", f"{P}-visitor-model", sh, None))
        nodes.append((f"{P}-{tag}-arm", f"{P}-{tag}-arm-pivot", sh, arm))

        hp, ft = mirror(LEG["hip"], side), mirror(LEG["foot"], side)
        c = mul(add(hp, ft), 0.5); c = (c[0], c[1], max(c[2], 0.3))
        leg = MeshBuilder(["Kkebook_Body"])
        leg.add(*radial_mesh(make_sd_leg(side), c, *RES_PART, tmax=1.0), "Kkebook_Body")
        nodes.append((f"{P}-{tag}-leg-pivot", f"{P}-visitor-model", hp, None))
        nodes.append((f"{P}-{tag}-leg", f"{P}-{tag}-leg-pivot", hp, leg))

    top = ray_hit(sd_head, (0, 0, 2.0), (0, 0, 1), 3.0)          # 평평한 윗면 중앙
    face, _ = front_point(sd_head, 0, (EYE["z"] + MOUTH["z"]) * 0.5)
    nodes += [
        (f"{P}-head-anchor", f"{P}-visitor-model", top, None),
        (f"{P}-face-anchor", f"{P}-visitor-model", face, None),
        (f"{P}-neck-anchor", f"{P}-visitor-model", (0, 0, 1.30), None),
        (f"{P}-body-anchor", f"{P}-visitor-model", (0, 0, 0.95), None),
        (f"{P}-hand-anchor", f"{P}-right-arm-pivot", ARM["hand"], None),
    ]
    return nodes

def hex_to_linear(h):
    h = h.lstrip("#")
    def c(x):
        x = int(x, 16)/255.0
        return x/12.92 if x <= 0.04045 else ((x+0.055)/1.055)**2.4
    return (c(h[0:2]), c(h[2:4]), c(h[4:6]), 1.0)

# ============================================================
# 3. Blender에 생성 (bpy가 있을 때만)
# ============================================================
def run_blender():
    import bpy
    from mathutils import Vector

    # ---- 이전 kkebook 결과만 정리 ----
    for cname in (COL_NAME, PREVIEW_COL_NAME):
        col = bpy.data.collections.get(cname)
        if col:
            for ob in list(col.objects):
                data = ob.data
                bpy.data.objects.remove(ob, do_unlink=True)
                if data is not None and data.users == 0:
                    for store in (bpy.data.meshes, bpy.data.lights, bpy.data.cameras):
                        if data.name in store and store[data.name] == data:
                            store.remove(data); break
            bpy.data.collections.remove(col)
    col = bpy.data.collections.new(COL_NAME)
    pcol = bpy.data.collections.new(PREVIEW_COL_NAME)
    bpy.context.scene.collection.children.link(col)
    bpy.context.scene.collection.children.link(pcol)

    # 같은 파일에 Frog가 있으면 겹치지 않게 숨김 (삭제하지 않음)
    frog_col = bpy.data.collections.get("Frog")
    frog_prev = bpy.data.collections.get("Frog_Preview")
    for c in (frog_col, frog_prev):
        if c:
            c.hide_viewport = True
            c.hide_render = True

    # ---- 재질 4개 (glTF -> MeshStandardMaterial) ----
    mats = {}
    for name, hexcol in COLORS.items():
        m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
        m.use_nodes = True
        bsdf = next((n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
        if bsdf is None:
            bsdf = m.node_tree.nodes.new("ShaderNodeBsdfPrincipled")
        lin = hex_to_linear(hexcol)
        bsdf.inputs["Base Color"].default_value = lin
        bsdf.inputs["Roughness"].default_value = ROUGHNESS[name]
        bsdf.inputs["Metallic"].default_value = 0.0
        m.diffuse_color = lin
        m.roughness = ROUGHNESS[name]
        mats[name] = m

    # ---- 노드 계층 ----
    objs = {}
    for name, parent, pos, mesh in build_scene_graph():
        wpos = mul(pos, S)
        if mesh is None:
            ob = bpy.data.objects.new(name, None)
            ob.empty_display_type = "ARROWS" if "anchor" in name else "PLAIN_AXES"
            ob.empty_display_size = 0.15
        else:
            me = bpy.data.meshes.new(name)
            me.from_pydata([mul(sub(v, pos), S) for v in mesh.verts], [], mesh.faces)
            for mname in mesh.materials:
                me.materials.append(mats[mname])
            for poly, mi in zip(me.polygons, mesh.mat_idx):
                poly.material_index = mi
                poly.use_smooth = True
            me.update()
            ob = bpy.data.objects.new(name, me)
        col.objects.link(ob)
        if parent:
            par = objs[parent]
            ob.parent = par
            ob.location = sub(wpos, par.matrix_world.translation)
        else:
            ob.location = wpos
        bpy.context.view_layer.update()
        objs[name] = ob
    for name in HIDDEN_IN_VIEWPORT:      # 겹쳐 보이지 않게 숨김 (내보낼 때는 포함)
        objs[name].hide_set(True)

    # ---- 미리보기용 조명/카메라/바닥 (내보내기에서 제외) ----
    fm = bpy.data.materials.get("Preview_Floor") or bpy.data.materials.new("Preview_Floor")
    fm.diffuse_color = (0.93, 0.92, 0.9, 1)
    me = bpy.data.meshes.new("Kkebook_Preview_Floor")
    me.from_pydata([(-15, -15, 0), (15, -15, 0), (15, 15, 0), (-15, 15, 0)], [], [(0, 1, 2, 3)])
    me.materials.append(fm)
    floor = bpy.data.objects.new("Kkebook_Preview_Floor", me); pcol.objects.link(floor)

    target = Vector((0, 0, 1.05))
    def light(name, loc, energy, size, color=(1, 1, 1)):
        ld = bpy.data.lights.new(name, "AREA"); ld.energy = energy; ld.color = color; ld.size = size
        lo = bpy.data.objects.new(name, ld); lo.location = loc
        lo.rotation_euler = (target - lo.location).to_track_quat("-Z", "Y").to_euler()
        pcol.objects.link(lo)
    # 전시장(ExhibitionScene)과 같은 방향의 조명: 위쪽 앞-오른쪽에서 내리쬐는 태양광 + 하늘색 환경광
    #  three.js DirectionalLight (7,15,9) -> Blender 방향 (7,-9,15)
    sun_d = bpy.data.lights.new("Kkebook_Sun", "SUN")
    sun_d.energy = 3.1; sun_d.color = (1.0, 0.955, 0.86); sun_d.angle = math.radians(8)
    sun = bpy.data.objects.new("Kkebook_Sun", sun_d)
    sun.rotation_euler = Vector((7, -9, 15)).to_track_quat("Z", "Y").to_euler()
    pcol.objects.link(sun)
    world = bpy.context.scene.world or bpy.data.worlds.new("World")
    bpy.context.scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs[0].default_value = (1.0, 0.98, 0.94, 1); bg.inputs[1].default_value = 0.6
    cam_d = bpy.data.cameras.new("Kkebook_Cam"); cam_d.lens = 70
    cam = bpy.data.objects.new("Kkebook_Cam", cam_d)
    cam.location = (4.0, -8.8, 2.5)
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    pcol.objects.link(cam)
    bpy.context.scene.camera = cam

    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == "VIEW_3D":
                for sp in area.spaces:
                    if sp.type == "VIEW_3D":
                        sp.shading.color_type = "MATERIAL"

    if EXPORT_PATH:
        export_glb(EXPORT_PATH)
    print("kkebook character built.")

def export_glb(path):
    """Kkebook 컬렉션만 GLB로 내보내기 (조명/카메라/바닥 제외)"""
    import bpy
    for ob in bpy.context.view_layer.objects:
        ob.select_set(False)
    hidden = [ob for ob in bpy.data.collections[COL_NAME].objects if ob.hide_get()]
    for ob in hidden:
        ob.hide_set(False)               # 숨긴 입도 함께 내보내기
    for ob in bpy.data.collections[COL_NAME].objects:
        ob.select_set(True)
    opts = dict(filepath=path, export_format="GLB", use_selection=True,
                export_yup=True, export_apply=True)
    try:
        bpy.ops.export_scene.gltf(**opts, export_cameras=False, export_lights=False)
    except TypeError:
        bpy.ops.export_scene.gltf(**opts)
    for ob in hidden:
        ob.select_set(False)
        ob.hide_set(True)
    print("Exported:", path)

try:
    import bpy  # noqa
    run_blender()
except ImportError:
    pass  # Blender 밖에서는 형태 계산만 사용 (미리보기 검증용)
