"""
B_photoproject (bzt-photo) - kkebook 악세서리 GLB 제작 스크립트
머리 3종 (beanie, cap, headset) + 얼굴 3종 (glasses, sunglasses, bubble_gum)
+ 목 3종 (scarf, crossbody_bag, bow_tie) + 손 3종 (balloon, americano, book)
Blender 3.6 / 4.x 대응

실행: Scripting 탭 > Text Editor > 이 파일 열기(또는 붙여넣기) > Run Script (Alt+P)
- 'Kkebook_Accessories' 컬렉션만 지우고 새로 만듭니다. (Kkebook 캐릭터는 건드리지 않음)
- 같은 파일에 kkebook 캐릭터가 있으면 악세서리가 머리 위 제자리에 얹혀 보입니다.
- EXPORT_DIR에 폴더를 적으면 악세서리마다 따로 GLB로 내보냅니다.
  예: EXPORT_DIR = "/Users/hyone/Desktop/bzt-photo/public/models/accessories"
  파일 이름은 프로젝트 악세서리 ID와 같습니다 (beanie.glb, cap.glb, ... bubble_gum.glb).

GLB 규칙
- 원점 = 그 악세서리가 붙는 kkebook 앵커. 코드에서 앵커에 붙이기만 하면 제자리에 놓입니다.
    머리 악세서리 -> kkebook-head-anchor (머리 윗면 정중앙)
    얼굴 악세서리 -> kkebook-face-anchor (눈과 입 사이, 얼굴 표면)
    목도리, 나비넥타이 -> kkebook-neck-anchor (머리와 몸 사이 중앙)
    크로스백, 책 -> kkebook-body-anchor (몸통 중앙. 책은 옆구리에 끼우고 웹에서 오른팔 자세를 바꿈)
    풍선, 아메리카노 -> kkebook-hand-anchor (오른팔 끝)
- 크기 = kkebook과 같은 단위. 정면 = Three.js +Z (내보내기 시 자동 변환)
"""
import math
import os

# ============================================================
# 1. 파라미터 - 형태 수치는 kkebook 시안 단위(높이 3.0 기준)
# ============================================================
S = 2.29 / 3.0                       # 시안 단위 -> 프로젝트 단위 (kkebook과 동일)
HEAD_ANCHOR = (0.0, 0.0, 2.592)      # kkebook-head-anchor 위치 (시안 단위)
FACE_ANCHOR = (0.0, -0.8857, 2.195)  # kkebook-face-anchor 위치 (시안 단위)

EXPORT_DIR = ""                      # 비워두면 내보내기 안 함
BUILD = ["balloon", "americano", "book"]   # 다른 악세서리도 다시 만들려면 ID를 추가 (예: "beanie", "glasses")

COLORS = {
    "Acc_Knit_Red":   "#C94F4A",
    "Acc_Knit_White": "#FFFDF4",
    "Acc_Cap_Color":   "#0B57FF",
    "Acc_Cap_Letter_Color": "#FF7900",
    "Acc_Cream":      "#FFF0CB",
    "Acc_Band":       "#E8E5DE",
    "Acc_Gray":       "#C9C6C1",
    "Acc_Glasses_Frame": "#5A4034",
    "Acc_Glass_Lens":    "#EAF4F8",
    "Acc_Sun_Frame":     "#1C1C1F",
    "Acc_Sun_Lens":      "#24262B",
    "Acc_Gum":           "#F4C4D6",
    "Acc_Gum_Ring":      "#EDB9CC",
    "Acc_Strap":         "#8A5A3B",
    "Acc_Bag":           "#D9B98C",
    "Acc_Gold":          "#D6964B",
    "Acc_Bowtie":        "#1E1E22",
    "Acc_Bowtie_Knot":   "#2B2B30",
    "Acc_Balloon":       "#E0525A",
    "Acc_String":        "#F2EEE6",
    "Acc_Cup":           "#F4F7F8",
    "Acc_Coffee":        "#3B2418",
    "Acc_Ice":           "#EEF6FA",
    "Acc_Straw":         "#2F8F5B",
    "Acc_Book_Cover":    "#3E5C8A",
    "Acc_Book_Page":     "#FFF6DF",
    "Acc_Book_Label":    "#F8CF1F",
    "Acc_Book_Line":     "#D8CDB4",
    "Acc_Book_Mark":     "#C94F4A",
}
# 반투명 재질의 불투명도 (1 = 불투명). 여기에 있는 재질은 glTF에서 반투명(BLEND)으로 내보냄
ALPHA = {"Acc_Glass_Lens": 0.22, "Acc_Gum": 0.82, "Acc_Cup": 0.18, "Acc_Ice": 0.6}
ROUGHNESS = {
    "Acc_Knit_Red": 0.9, "Acc_Knit_White": 0.95, "Acc_Cap_Color": 0.75, "Acc_Cap_Letter_Color": 0.6,
    "Acc_Cream": 0.8, "Acc_Band": 0.6, "Acc_Gray": 0.55,
    "Acc_Glasses_Frame": 0.45, "Acc_Glass_Lens": 0.05, "Acc_Sun_Frame": 0.4, "Acc_Sun_Lens": 0.12,
    "Acc_Gum": 0.18, "Acc_Gum_Ring": 0.35,
    "Acc_Strap": 0.6, "Acc_Bag": 0.75, "Acc_Gold": 0.35, "Acc_Bowtie": 0.45, "Acc_Bowtie_Knot": 0.4,
    "Acc_Balloon": 0.2, "Acc_String": 0.8, "Acc_Cup": 0.08, "Acc_Coffee": 0.15, "Acc_Ice": 0.1, "Acc_Straw": 0.4,
    "Acc_Book_Cover": 0.6, "Acc_Book_Page": 0.9, "Acc_Book_Label": 0.5, "Acc_Book_Line": 0.9, "Acc_Book_Mark": 0.6,
}

TOP = 2.60                           # 돌기 사이 윗면 높이

BEANIE = dict(
    base_z=TOP + 0.07,               # 니트 몸통이 시작되는 높이
    radii=(0.37, 0.35, 0.44),        # 니트 몸통 (가로, 앞뒤, 높이)
    cable_count=6,                   # 꽈배기 기둥 수 (둘레)
    cable_twist_h=0.15,              # 꽈배기가 한 번 꼬이는 높이
    cable_depth=0.16,                # 꽈배기 입체 깊이 (반지름 대비)
    stitch_row_h=0.03,               # 꽈배기 가닥 위 니트 코 간격
    cuff_radii=(0.42, 0.40),         # 흰 접단 바깥 크기
    cuff_center_z=TOP + 0.09, cuff_half_h=0.045, cuff_thick=0.055,   # 얇은 털 접단
    fur_depth=0.05,                  # 흰 털 요철 깊이
    pom_z=TOP + 0.62, pom_r=0.14,    # 털공
)
CAP = dict(
    # 위치와 기울기 (오른쪽 돌기를 통째로 덮고 비스듬히, 챙 아래로 눈이 살짝 보이게)
    # 정면 가운데로 되돌리려면: crown_center=(0.0, 0.04, 2.52), yaw/roll/back 모두 0
    crown_center=(0.72, 0.0, 2.30),
    yaw_deg=10.0,                    # 챙 방향을 바깥(+X)으로 돌리는 각도
    roll_deg=30.0,                   # 모자 꼭대기를 바깥으로 기울이는 각도
    back_deg=15.0,                   # 모자 꼭대기를 뒤로 젖히는 각도
    crown_radii=(0.48, 0.46, 0.52),  # 돌기를 통째로 덮는 크라운 (옆, 앞뒤, 높이)
    crown_fullness=2.6,              # 2 = 반구, 클수록 꼭대기가 넓고 빵빵한 돔
    crown_buried_depth=0.36,         # (crown_shell=0일 때만) 머리 속에 묻히는 아랫부분 깊이
    crown_shell=0.03,                # 속이 빈 모자 두께. 0이면 아랫부분이 머리에 묻히는 통짜 모양
    seams=6,
    # 챙은 크라운 앞쪽 테두리에서 시작
    brim_offset=0.41, brim_lift=0.03, brim_pitch_deg=-6.0,   # 챙 위치와 기울기 (-면 앞이 살짝 들림)
    brim_size=(0.31, 0.40), brim_half_t=0.028,
    button_r=0.047,
    letter_center_h=0.37,            # 앞면 B 글자 가운데 높이 (크라운 중심에서)
    letter_height=0.20, letter_stroke=0.025, letter_lift=0.006,
)
HEADSET = dict(
    ear_center=(1.125, 0.05, 2.10), ear_normal=(0.998, 0.067, 0.02),   # 돌기 아래 잘록한 곳
    band_a=1.22, band_b=0.92, band_half_w=0.07, band_half_d=0.117,       # 머리 위로 뜬 아치
    cup_offset=0.10, cup_radii=(0.30, 0.30, 0.16),
    cushion_radii=(0.25, 0.25, 0.10),
    star_outer=0.13, star_inner=0.062, star_base=0.245, star_height=0.045,
)

# ---- 얼굴 악세서리 (렌즈 위치는 얼굴 정면 좌표: x = 좌우, z = 높이) ----
GLASSES = dict(                      # 원형 안경, 다리 없음, 투명 유리알
    lens_x=0.58, lens_z=2.43,        # 렌즈 중심 (눈 위에)
    lens_r=(0.28, 0.28),             # 렌즈 크기 (가로, 세로 반지름)
    frame_r=0.024,                   # 테 두께
    clearance=0.035,                 # 얼굴 표면과 테 사이 최소 간격
)
SUNGLASSES = dict(                   # 좁은 사각 선글라스, 다리 없음
    lens_x=0.56, lens_z=2.405,
    lens_r=(0.32, 0.165),
    frame_r=0.02,
    clearance=0.035,
    squareness=0.45,                 # 1 = 타원, 작을수록 각진 사각형
)
BUBBLE_GUM = dict(                   # 입에서 부푼 풍선껌
    mouth_z=1.95,                    # kkebook 입 높이
    r=0.30,                          # 풍선 반지름
    drop=0.25,                       # 풍선이 아래로 처지는 정도
    ring=(0.08, 0.065, 0.03),        # 입가에 뭉친 껌 고리 (가로, 세로, 굵기)
)

# ---- 목 악세서리 ----
SCARF = dict(                        # 니트 목도리, 흰/빨 줄무늬
    z=1.08,                          # 목에 감기는 기본 높이
    wrap_half=(0.09, 0.12),          # 감긴 부분 단면 (두께, 높이)
    head_overlap=0.03,               # 목도리 윗단이 머리 아랫면에 살짝 닿게 (어깨가 드러나지 않게)
    arm_overlap=0.45,                # 팔이 목도리 안쪽으로 들어가도 되는 깊이 (두께 대비). 클수록 몸에 붙음
    tail_half=(0.045, 0.16),         # 늘어진 꼬리 단면 (두께, 폭)
    tail_theta=-1.02,                # 꼬리 위치 (라디안, 0 = 화면 오른쪽 옆, -1.57 = 정면)
    tail_length=0.50,
    stripe_len=0.30,                 # 줄무늬 한 칸 길이 (감긴 부분은 둘레에 맞게 자동 조정)
    cables=4,                        # 단면 둘레의 꽈배기 기둥 수
    cable_twist_h=0.16, cable_depth=0.0, stitch_row_h=0.03,   # cable_depth를 올리면 꽈배기 무늬 (예: 0.32)
    fringe=7, fringe_len=0.10,       # 꼬리 끝 술
)
CROSSBODY = dict(                    # 오른쪽 어깨 -> 왼쪽(화면 왼쪽) 엉덩이로 비스듬한 끈 + 가방
    strap_center_z=0.86, strap_tilt=0.28,   # 끈이 가장 높은 곳 = center+tilt (화면 오른쪽 어깨)
    strap_half=(0.02, 0.055),        # 끈 단면 (두께, 폭)
    clearance=0.035,                 # 몸, 배, 팔, 다리와 끈 사이 최소 간격
    bag_theta=math.pi + 1.0,         # 가방 위치 (화면 왼쪽 앞)
    bag_z=0.60,
    bag_half=(0.28, 0.21, 0.10),     # 가방 크기 (가로, 세로, 두께)의 절반
    flap_h=0.12,                     # 덮개 높이의 절반
)
BOWTIE = dict(                       # 검정 나비넥타이 (목 끈 없음)
    z=1.07,
    wing=(0.27, 0.18, 0.07),         # 날개 하나 (길이, 바깥쪽 높이, 두께)의 절반
    pinch=0.36,                      # 가운데 쪽 날개 높이 비율 (작을수록 잘록)
    knot=(0.075, 0.085, 0.065),
)

# ---- 손 악세서리 (오른팔 = 화면 오른쪽 팔 끝에 쥠) ----
BALLOON = dict(
    center=(1.65, -0.15, 3.05),      # 풍선 중심 (머리 옆 위)
    r=(0.44, 0.52),                  # 풍선 크기 (가로, 세로 반지름)
    knot=0.045,                      # 아래 매듭 크기
    string_r=0.009,                  # 줄 굵기
    string_bow=0.18,                 # 줄이 바깥으로 휘는 정도
)
AMERICANO = dict(                    # 아이스 아메리카노 (투명 컵 + 얼음 + 빨대, 로고 없음)
    offset=(-0.04, -0.33, -0.34),    # 손 끝에서 컵 바닥 중심까지 (손이 컵 뒤쪽 옆면을 감싸 쥠)
    height=0.72,
    radius=(0.18, 0.25),             # 컵 바닥, 윗면 반지름
    wall=0.01,
    fill=0.82,                       # 커피 높이 (컵 높이 대비)
    ice=7, ice_size=0.08,
    straw_r=0.022, straw_out=0.24,   # 빨대 굵기, 컵 위로 나온 길이
)
BOOK = dict(                         # 오른쪽 옆구리에 끼운 책 (웹에서 오른팔을 이 자세로 바꿈)
    side_theta=-0.55, side_z=0.80,   # 책이 붙는 몸통 위치 (theta 0 = 화면 오른쪽 옆, -1.57 = 정면)
    facing=(1.0, -0.85),             # 바깥 표지가 보는 방향 (x, y): 바깥 + 앞쪽
    forward=0.14,                    # 책을 앞으로 내미는 정도 (정면에서 속지가 보이게)
    half=(0.30, 0.23, 0.055),        # 책 (가로, 세로, 두께)의 절반
    board=0.014,                     # 표지 두께
    hand_press=0.75,                 # 손이 바깥 표지를 누르는 정도 (손 반지름 대비)
)

# kkebook 머리 형태 (kkebook_character.py와 같은 값). 비니가 머리 곡면에 붙도록 맞출 때 사용
KK_W = 0.88
KK_HEAD = dict(lower_c=(0.0, 0.0, 1.65), lower_r=(1.42*KK_W, 0.98, 0.52),
               upper_c=(0.0, 0.0, 1.97), upper_r=(1.08*KK_W, 0.90, 0.62), blend=0.48,
               bump_x=0.86*KK_W, bump_y=0.02, bump_z=2.40, bump_r=0.39, bump_blend=0.29)

# kkebook 몸 형태 (kkebook_character.py와 같은 값). 목/몸 악세서리가 몸에 파묻히지 않게 할 때 사용
KK_BODY = dict(upper_c=(0.0, 0.0, 1.02), upper_r=(0.72, 0.64, 0.55),
               lower_c=(0.0, 0.0, 0.66), lower_r=(0.86, 0.74, 0.44), blend=0.30)
KK_BELLY = dict(center=(0.0, -0.44, 0.78), radii=(0.58, 0.36, 0.43))
KK_ARM = dict(shoulder=(0.72, -0.05, 1.12), hand=(1.04, -0.12, 0.80), r0=0.18, r1=0.24)
KK_LEG = dict(hip=(0.40, 0.0, 0.60), foot=(0.42, -0.06, 0.22), r0=0.21, r1=0.25)
NECK_ANCHOR = (0.0, 0.0, 1.30)       # kkebook-neck-anchor
HAND_ANCHOR = (1.04, -0.12, 0.80)    # kkebook-hand-anchor (오른팔 끝, 팔과 함께 흔들림)
BODY_ANCHOR = (0.0, 0.0, 0.95)       # kkebook-body-anchor (크로스백)

# ============================================================
# 2. 메쉬 생성 (bpy 없이 동작)
# ============================================================
def add(a, b): return (a[0]+b[0], a[1]+b[1], a[2]+b[2])
def sub(a, b): return (a[0]-b[0], a[1]-b[1], a[2]-b[2])
def mul(a, s): return (a[0]*s, a[1]*s, a[2]*s)
def dot(a, b): return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]
def cross(a, b): return (a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0])
def norm(a):
    l = math.sqrt(dot(a, a)) or 1e-9
    return (a[0]/l, a[1]/l, a[2]/l)

def _ell(p, c, r):
    q = sub(p, c)
    k0 = math.sqrt((q[0]/r[0])**2 + (q[1]/r[1])**2 + (q[2]/r[2])**2)
    k1 = math.sqrt((q[0]/r[0]**2)**2 + (q[1]/r[1]**2)**2 + (q[2]/r[2]**2)**2)
    return -min(r) if k1 < 1e-9 else k0*(k0-1.0)/k1

def _smin(a, b, k):
    h = max(k-abs(a-b), 0.0)/k
    return min(a, b) - h*h*k*0.25

def head_sdf(p):
    h = KK_HEAD
    d = _smin(_ell(p, h["lower_c"], h["lower_r"]), _ell(p, h["upper_c"], h["upper_r"]), h["blend"])
    for s_ in (-1, 1):
        c = (s_*h["bump_x"], h["bump_y"], h["bump_z"])
        d = _smin(d, math.sqrt(dot(sub(p, c), sub(p, c))) - h["bump_r"], h["bump_blend"])
    return d

def head_surface_z(x, y, z_top=3.5, z_bottom=1.9):
    """(x, y) 위치에서 위로부터 내려와 처음 만나는 머리 표면 높이 (z_bottom은 머리 안쪽이어야 함)"""
    if head_sdf((x, y, z_bottom)) > 0:
        return z_bottom
    lo, hi = z_bottom, z_top
    for _ in range(40):
        m = 0.5*(lo+hi)
        if head_sdf((x, y, m)) < 0: lo = m
        else: hi = m
    return lo

def head_front(x, z):
    """얼굴 정면 (x, z) 위치의 머리 표면 점과 바깥 법선 (머리 중심에서 -Y로 나가며 찾음)"""
    lo, hi = 0.0, -2.5               # lo는 머리 안, hi는 머리 밖
    for _ in range(50):
        m = 0.5*(lo+hi)
        if head_sdf((x, m, z)) < 0: lo = m
        else: hi = m
    p = (x, lo, z); e = 1e-4
    g = (head_sdf((x+e, lo, z)) - head_sdf((x-e, lo, z)),
         head_sdf((x, lo+e, z)) - head_sdf((x, lo-e, z)),
         head_sdf((x, lo, z+e)) - head_sdf((x, lo, z-e)))
    return p, norm(g)

class MeshBuilder:
    def __init__(self):
        self.materials, self.verts, self.faces, self.mat_idx, self.smooth = [], [], [], [], []
    def _mat(self, name):
        if name not in self.materials:
            self.materials.append(name)
        return self.materials.index(name)
    def add(self, verts, faces, material, smooth=True):
        o = len(self.verts); mi = self._mat(material)
        self.verts += verts
        for f in faces:
            self.faces.append(tuple(i+o for i in f)); self.mat_idx.append(mi); self.smooth.append(smooth)

def lathe(profile, segs, frame=None, center=(0, 0, 0), sx=1.0, sy=1.0, radial=None, hshift=None):
    """profile: (r, h) 목록. (r,h) 평면에서 반시계 방향으로 주면 면이 바깥을 향함.
    r=0 인 점은 극점 하나로 처리. frame=(u, v, w) 축 (기본 x, y, z). radial(theta, h) -> r 배율
    hshift(theta, h) -> 높이 보정 (머리 곡면에 맞춰 아랫단을 내릴 때)"""
    u, v, w = frame or ((1, 0, 0), (0, 1, 0), (0, 0, 1))
    verts, faces, rows = [], [], []
    for r, h in profile:
        if r < 1e-9:
            rows.append([len(verts)])
            verts.append(add(center, mul(w, h)))
            continue
        row = []
        for j in range(segs):
            t = 2*math.pi*j/segs
            k = radial(t, h) if radial else 1.0
            dh = hshift(t, h) if hshift else 0.0
            p = add(add(mul(u, r*sx*k*math.cos(t)), mul(v, r*sy*k*math.sin(t))), mul(w, h + dh))
            row.append(len(verts)); verts.append(add(center, p))
        rows.append(row)
    for a, b in zip(rows[:-1], rows[1:]):
        if len(a) == 1 and len(b) == 1:
            continue
        if len(a) == 1:
            faces += [(a[0], b[(j+1) % segs], b[j])[::-1] for j in range(segs)]
        elif len(b) == 1:
            faces += [(a[j], a[(j+1) % segs], b[0]) for j in range(segs)]
        else:
            faces += [(a[j], a[(j+1) % segs], b[(j+1) % segs], b[j]) for j in range(segs)]
    return verts, faces

def ellipse_profile(rz, n=24):
    """아래 극점 -> 위 극점, 단위 반지름 (r)과 높이 (h = rz)"""
    return [(math.sin(math.pi*i/n), -rz*math.cos(math.pi*i/n)) for i in range(n+1)]

def squircle_profile(rc, hc, ar, ah, n=48, e=0.55):
    """(r,h) 평면의 둥근 사각형 단면, 반시계 방향 (뒤집힌 도넛, 접단, 챙에 사용)"""
    pts = []
    for i in range(n):
        t = 2*math.pi*i/n - math.pi/2
        c, s = math.cos(t), math.sin(t)
        pts.append((rc + ar*math.copysign(abs(c)**e, c), hc + ah*math.copysign(abs(s)**e, s)))
    return pts + [pts[0]]

def ring_lathe(profile, segs, **kw):
    """닫힌 단면을 돌린 고리 (시작점과 끝점이 같은 profile). 마지막 행은 첫 행과 같은 점이므로 다시 연결"""
    verts, faces = lathe(profile[:-1], segs, **kw)
    n = len(profile) - 1
    a = [(n-1)*segs + j for j in range(segs)]   # 마지막 행
    b = list(range(segs))                       # 첫 행
    faces += [(a[j], a[(j+1) % segs], b[(j+1) % segs], b[j]) for j in range(segs)]
    return verts, faces

def frame_from_normal(n, up=(0, 0, 1)):
    """n을 세 번째 축으로, up 방향이 두 번째 축이 되는 오른손 좌표계 (x, y, n)"""
    n = norm(n)
    y = norm(sub(up, mul(n, dot(up, n))))
    x = cross(y, n)
    return x, y, n

def tube(points, half_w, half_d, normals_fn, segs=14):
    """points를 따라가는 타원 단면 관. normals_fn(i) -> 단면의 '바깥(w)' 방향"""
    verts, faces = [], []
    for i, p in enumerate(points):
        tg = norm(sub(points[min(i+1, len(points)-1)], points[max(i-1, 0)]))
        w = norm(normals_fn(i)); d = cross(tg, w)
        for k in range(segs):
            a = 2*math.pi*k/segs
            verts.append(add(p, add(mul(w, half_w*math.cos(a)), mul(d, half_d*math.sin(a)))))
    for i in range(len(points)-1):
        for k in range(segs):
            a = i*segs+k; b = i*segs+(k+1) % segs
            faces.append((a, b, b+segs, a+segs))
    for end, flip in ((0, False), (len(points)-1, True)):   # 끝 막기
        c = len(verts); verts.append(points[end])
        ring = [end*segs+k for k in range(segs)]
        for k in range(segs):
            f = (ring[k], ring[(k+1) % segs], c)
            faces.append(f[::-1] if flip else f)
    return verts, faces

def star_prism(center, n, outer, inner, height, up=(0, 0, 1)):
    x, y, n = frame_from_normal(n, up)
    pts = []
    for k in range(10):
        a = math.pi/2 + k*math.pi/5
        r = outer if k % 2 == 0 else inner
        pts.append(add(center, add(mul(x, r*math.cos(a)), mul(y, r*math.sin(a)))))
    top = [add(p, mul(n, height)) for p in pts]
    verts = pts + top + [center, add(center, mul(n, height))]
    cb, ct = 20, 21
    faces = []
    for k in range(10):
        k2 = (k+1) % 10
        faces.append((k, k2, 10+k2, 10+k))          # 옆면
        faces.append((10+k, 10+k2, ct))             # 윗면
        faces.append((k2, k, cb))                   # 아랫면
    return verts, faces

# ---------------- 악세서리 ----------------
def build_beanie():
    b = BEANIE; m = MeshBuilder()
    rx, ry, rz = b["radii"]; z0 = b["base_z"]
    cx, cy = b["cuff_radii"]
    cuff_bottom = b["cuff_center_z"] - b["cuff_half_h"]
    # 접단 아랫단을 머리 곡면까지 내린다 (앞뒤로 내려가는 머리에서 뜨지 않게). 0.02만큼 살짝 묻힘
    drops = []
    for i in range(360):
        t = 2*math.pi*i/360
        zs = head_surface_z(cx*math.cos(t), 0.02 + cy*math.sin(t))
        drops.append(min(0.0, zs - 0.02 - cuff_bottom))
    def drop_at(t):
        f = (t % (2*math.pi))/(2*math.pi)*360
        i = int(f); a = f - i
        return drops[i % 360]*(1-a) + drops[(i+1) % 360]*a
    # 니트 몸통: 꽈배기(케이블) 기둥 + 기둥 사이 골. 두 가닥이 번갈아 위로 올라오며 꼬인다
    n_rows = 64
    prof = [(0.0, -0.03), (1.0, -0.03)] + [(math.cos(math.pi/2*i/n_rows), rz*math.sin(math.pi/2*i/n_rows))
                                          for i in range(n_rows + 1)]
    cables, twist_h, depth, stitch_h = b["cable_count"], b["cable_twist_h"], b["cable_depth"], b["stitch_row_h"]
    def rope(x, c, w):
        q = (x - c)/w
        return math.sqrt(1 - q*q) if abs(q) < 1 else 0.0          # 둥근 밧줄 단면
    def cable_knit(t, h):
        if h <= 0:
            return 1.0
        u = (cables*t/(2*math.pi)) % 1.0             # 기둥 하나 안에서의 위치 0~1
        ph = 2*math.pi*h/twist_h
        if 0.18 < u < 0.82:                           # 꽈배기 기둥: 두 가닥이 X자로 교차
            x = (u - 0.5)/0.32                        # -1 ~ 1
            ca, cb = 0.5*math.sin(ph), -0.5*math.sin(ph)
            w = 0.52
            ra, rb = rope(x, ca, w), rope(x, cb, w)
            front = math.cos(ph)                      # +면 a가 위, -면 b가 위
            ha = ra*(0.78 + 0.22*front); hb = rb*(0.78 - 0.22*front)
            strand = max(ha, hb)
            lean = 1 if ha >= hb else -1               # 가닥마다 비스듬한 코
            stitch = 0.9 + 0.1*math.cos(2*math.pi*(h/stitch_h + lean*1.2*x))
            d = 0.25 + 0.75*strand*stitch
            d *= min(1.0, (0.82 - u)/0.03, (u - 0.18)/0.03)
        else:                                         # 기둥 사이: 깊은 골 + 가는 겉뜨기 줄 하나
            v = (u + 0.5) % 1.0 - 0.5
            d = 0.05 + 0.3*math.exp(-(v/0.05)**2) * (0.85 + 0.15*math.cos(2*math.pi*h/stitch_h))
        fade = max(0.0, 1 - (h/rz)**2.5)              # 꼭대기는 기둥이 모이니 약하게
        return 1.0 + depth*(d - 0.4)*fade
    # 아래쪽(접단 안쪽)은 접단과 함께 머리 곡면을 따라 내려가고, 위로 갈수록 원래 모양으로
    dome_drop = lambda t, h: drop_at(t)*min(1.0, max(0.0, (0.2 - h)/0.16))
    m.add(*lathe(prof, 168, center=(0, 0.02, z0), sx=rx, sy=ry, radial=cable_knit, hshift=dome_drop), "Acc_Knit_Red")

    # 흰 털 접단: 얇은 띠가 같은 두께로 머리 곡면을 따라 내려감 + 보송한 털 요철
    inner = 1 - b["cuff_thick"]/cx
    ah = b["cuff_half_h"]
    prof = squircle_profile((1+inner)/2, 0.0, (1-inner)/2, ah, n=24, e=0.7)
    fd = b["fur_depth"]
    def fur(t, h):
        u = h/ah
        return 1.0 + fd*0.5*(math.sin(23*t + 3.1*u)*math.sin(31*t - 2.3*u) + 0.6*math.sin(57*t + 5*u))
    m.add(*ring_lathe(prof, 128, center=(0, 0.02, b["cuff_center_z"]), sx=cx, sy=cy,
                      radial=fur, hshift=lambda t, h: drop_at(t)), "Acc_Knit_White")

    # 털공: 더 복슬하게
    pr = b["pom_r"]
    def fluff(t, h):
        u = h/pr
        return 1.0 + 0.07*math.sin(9*t)*math.sin(11*u) + 0.05*math.cos(17*t + 7*u) + 0.03*math.sin(29*t - 13*u)
    m.add(*lathe([(r, h*pr) for r, h in ellipse_profile(1.0, 24)], 48,
                 center=(0, 0.02, b["pom_z"]), sx=pr, sy=pr, radial=fluff), "Acc_Knit_White")
    return m

def cap_axes():
    """모자 좌표계: cs(옆, 바깥), cf(앞, 챙 방향), cn(위, 꼭대기 방향)"""
    c = CAP
    y, r, b = (math.radians(c["yaw_deg"]), math.radians(c["roll_deg"]), math.radians(c["back_deg"]))
    z = (0.0, 0.0, 1.0)
    cf = (math.sin(y), -math.cos(y), 0.0)
    side = (math.cos(y), math.sin(y), 0.0)
    cn = norm(add(mul(z, math.cos(r)), mul(side, math.sin(r))))          # 바깥으로 기울임
    cn, cf = norm(add(mul(cn, math.cos(b)), mul(cf, -math.sin(b)))), norm(add(mul(cf, math.cos(b)), mul(cn, math.sin(b))))
    cs = cross(cn, cf)
    return cs, cf, cn

def cap_frame():
    c = CAP
    cs, cf, cn = cap_axes()
    p = math.radians(c["brim_pitch_deg"])
    bn = norm(add(mul(cn, math.cos(p)), mul(cf, math.sin(p))))
    bf = cross(cs, bn)
    bc = add(add(c["crown_center"], mul(cf, c["brim_offset"])), mul(cn, c["brim_lift"]))
    return bc, bf, cs, bn

def crown_radius(h):
    """크라운 높이 h(가운데 기준)에서의 가로 반지름 배율. 위는 빵빵한 돔, 아래는 머리 속 타원"""
    c = CAP; rz = c["crown_radii"][2]
    if h >= 0:
        q = min(1.0, h/rz)
        return (1 - q**c["crown_fullness"])**(1/c["crown_fullness"])
    q = min(1.0, -h/c["crown_buried_depth"])
    return math.sqrt(max(0.0, 1 - q*q))

def crown_profile(n_top=40, n_bottom=12):
    c = CAP; rz, bd = c["crown_radii"][2], c["crown_buried_depth"]
    t = c.get("crown_shell", 0.0)
    if t > 0:
        # 속이 빈 모자: 안쪽 꼭대기 -> 안쪽 면 -> 둥근 테두리 -> 바깥 면 -> 바깥 꼭대기 (반시계)
        tr = t/min(c["crown_radii"][0], c["crown_radii"][1])
        pts = [(0.0, rz - t)]
        for i in range(1, n_top + 1):
            a = math.pi/2*(1 - i/n_top)
            h = (rz - t)*math.sin(a)
            pts.append((max(0.0, crown_radius(h*rz/(rz - t)) - tr), h))
        pts.append((1 - tr*0.5, -t*0.45))           # 테두리 아래 둥근 부분
        for i in range(n_top + 1):
            a = math.pi/2*i/n_top
            h = rz*math.sin(a)
            pts.append((crown_radius(h), h))
        pts[-1] = (0.0, rz)
        return pts
    pts = [(math.sin(math.pi/2*i/n_bottom), -bd*math.cos(math.pi/2*i/n_bottom)) for i in range(n_bottom)]
    for i in range(n_top + 1):
        a = math.pi/2*i/n_top
        h = rz*math.sin(a)
        pts.append((crown_radius(h), h))
    pts[-1] = (0.0, rz)
    return pts

def crown_front_point(s_, h):
    """크라운 앞면에서 모자 좌표 (옆 s_, 높이 h) 위치의 표면 점과 바깥 방향 법선"""
    c = CAP; rx, ry, _ = c["crown_radii"]
    cs, cf, cn = cap_axes()
    def g(a, f, hh):                       # 모자 좌표 (옆 a, 앞 f, 높이 hh)
        return (a/rx)**2 + (f/ry)**2 - crown_radius(hh)**2
    f = ry*math.sqrt(max(0.0, crown_radius(h)**2 - (s_/rx)**2))
    e = 1e-4
    ga = g(s_+e, f, h) - g(s_-e, f, h); gf = g(s_, f+e, h) - g(s_, f-e, h); gh = g(s_, f, h+e) - g(s_, f, h-e)
    n = norm(add(add(mul(cs, ga), mul(cf, gf)), mul(cn, gh)))
    p = add(add(add(c["crown_center"], mul(cs, s_)), mul(cf, f)), mul(cn, h))
    return p, n

def letter_b_strokes(height):
    """둥근 B 글자를 획(점 목록) 3개로: 세로 기둥, 위 반원, 아래 반원 (u=가로, v=세로, 가운데 정렬)"""
    hh = height/2
    stem_x = -0.31*height
    x0 = stem_x + 0.20*height                   # 반원이 시작되는 곳까지 직선
    strokes = [[(stem_x, -hh + 0.25*hh*i) for i in range(9)]]
    def bowl(y_top, y_bot, r):
        cy = (y_top + y_bot)/2
        pts = [(stem_x, y_top), (x0, y_top)]
        for i in range(1, 20):
            a = math.pi/2 - math.pi*i/20
            pts.append((x0 + r*math.cos(a), cy + (y_top - cy)*math.sin(a)))
        pts += [(x0, y_bot), (stem_x, y_bot)]
        return pts
    strokes.append(bowl(hh, 0.0, 0.30*height))     # 위 반원 (조금 작게)
    strokes.append(bowl(0.0, -hh, 0.36*height))    # 아래 반원 (조금 크게)
    return strokes

def build_cap():
    c = CAP; m = MeshBuilder()
    rx, ry, rz = c["crown_radii"]
    seam = lambda t, h: 1.0 - 0.018*max(0.0, math.cos(c["seams"]*t))**30 if h > 0 else 1.0
    cs, cf, cn = cap_axes()
    m.add(*lathe(crown_profile(), 96, frame=(cs, mul(cf, -1.0), cn), center=c["crown_center"], sx=rx, sy=ry,
                 radial=seam), "Acc_Cap_Color")
    bc, bf, cs, bn = cap_frame()
    ht = c["brim_half_t"]
    # 아랫면 중심 -> 둥근 테두리 -> 윗면 중심 (반시계)
    prof = [(0.0, -ht), (0.5, -ht)] + [(0.86 + 0.14*math.cos(a), ht*math.sin(a))
                                        for a in [-math.pi/2 + math.pi*i/12 for i in range(13)]] + [(0.5, ht), (0.0, ht)]
    m.add(*lathe(prof, 72, frame=(bf, cs, bn), center=bc, sx=c["brim_size"][0], sy=c["brim_size"][1]), "Acc_Cap_Color")
    top = add(c["crown_center"], mul(cn, rz - 0.012))
    m.add(*lathe([(r, h*c["button_r"]) for r, h in ellipse_profile(1.0, 10)], 20, frame=(cs, mul(cf, -1.0), cn), center=top,
                 sx=c["button_r"], sy=c["button_r"]), "Acc_Cap_Color")
    # 앞면 B: 크라운 곡면을 따라 올린 도톰한 글자
    sr = c["letter_stroke"]
    for stroke in letter_b_strokes(c["letter_height"]):
        dense = []
        for (u0, v0), (u1, v1) in zip(stroke[:-1], stroke[1:]):
            for k in range(4):
                f = k/4
                dense.append((u0 + (u1-u0)*f, v0 + (v1-v0)*f))
        dense.append(stroke[-1])
        pts, nrm = [], []
        for u, v in dense:
            p, n = crown_front_point(u, c["letter_center_h"] + v)
            pts.append(add(p, mul(n, sr*0.45 + c["letter_lift"])))
            nrm.append(n)
        m.add(*tube(pts, sr, sr, lambda i, nrm=nrm: nrm[i], segs=10), "Acc_Cap_Letter_Color")
    return m

def build_headset():
    h = HEADSET; m = MeshBuilder()
    ex, ey, ez = h["ear_center"]
    a, bb = h["band_a"], h["band_b"]
    phi0 = math.asin(0.1/bb)
    pts, nrms = [], []
    for i in range(61):
        f = phi0 + (math.pi - 2*phi0)*i/60
        pts.append((a*math.cos(f), ey, ez + bb*math.sin(f)))
        nrms.append(norm((math.cos(f)/a, 0.0, math.sin(f)/bb)))
    m.add(*tube(pts, h["band_half_w"], h["band_half_d"], lambda i: nrms[i], segs=16), "Acc_Band")
    for s in (-1, 1):
        n = norm((s*h["ear_normal"][0], h["ear_normal"][1], h["ear_normal"][2]))
        c = (s*ex, ey, ez)
        x, y, n = frame_from_normal(n)
        cup_c = add(c, mul(n, h["cup_offset"]))
        rx, ry, rn = h["cup_radii"]
        m.add(*lathe([(r, hh*rn) for r, hh in ellipse_profile(1.0, 20)], 48, frame=(x, y, n), center=cup_c, sx=rx, sy=ry), "Acc_Gray")
        rx, ry, rn = h["cushion_radii"]
        m.add(*lathe([(r, hh*rn) for r, hh in ellipse_profile(1.0, 16)], 40, frame=(x, y, n), center=c, sx=rx, sy=ry), "Acc_Cream")
        m.add(*star_prism(add(c, mul(n, h["star_base"])), n, h["star_outer"], h["star_inner"], h["star_height"]),
              "Acc_Cream", smooth=False)
    return m

# ---------------- 얼굴 악세서리 ----------------
def _superellipse(c, s, e):
    return math.copysign(abs(c)**e, c), math.copysign(abs(s)**e, s)

def lens_outline(center, n, rx, rz, e=1.0, segs=64):
    """렌즈 테두리 점 (닫힌 고리: 첫 점 = 마지막 점). e<1이면 둥근 사각형"""
    x, y, _ = frame_from_normal(n)
    pts = []
    for i in range(segs+1):
        a = 2*math.pi*i/segs
        c, s_ = _superellipse(math.cos(a), math.sin(a), e)
        pts.append(add(center, add(mul(x, rx*c), mul(y, rz*s_))))
    return pts

def place_lens(cx, cz, rx, rz, e, clearance):
    """테가 얼굴에 파묻히지 않을 만큼 얼굴 법선 방향으로 렌즈를 띄운다"""
    p, n = head_front(cx, cz)
    off = 0.02
    while off < 0.6:
        c = add(p, mul(n, off))
        if min(head_sdf(q) for q in lens_outline(c, n, rx, rz, e, 32)) >= clearance:
            break
        off += 0.01
    return add(p, mul(n, off)), n

def lens_disc(center, n, rx, rz, half_t, e=1.0, segs=64):
    """얇은 렌즈 판 (테 안쪽을 채움)"""
    x, y, w = frame_from_normal(n)
    prof = [(0.0, -half_t), (0.98, -half_t), (1.0, 0.0), (0.98, half_t), (0.0, half_t)]
    def radial(t, h):
        if e >= 1.0: return 1.0
        c, s_ = abs(math.cos(t)), abs(math.sin(t))
        return 1.0/((c**(2/e) + s_**(2/e))**(e/2))
    return lathe(prof, segs, frame=(x, y, w), center=center, sx=rx, sy=rz, radial=radial)

def build_eyewear(spec, frame_mat, lens_mat, e):
    m = MeshBuilder()
    rx, rz = spec["lens_r"]; tr = spec["frame_r"]
    lenses = []
    for s_ in (-1, 1):
        c, n = place_lens(s_*spec["lens_x"], spec["lens_z"], rx, rz, e, spec["clearance"])
        lenses.append((c, n))
        m.add(*tube(lens_outline(c, n, rx, rz, e), tr, tr, lambda i, n=n: n, segs=10), frame_mat)
        m.add(*lens_disc(c, n, rx*0.97, rz*0.95, 0.008, e), lens_mat)
    # 브리지: 두 렌즈 안쪽 끝(살짝 위)을 잇는 완만한 곡선, 얼굴에 닿지 않게 앞으로 밀어냄
    def inner_edge(c, n, side):
        x, y, _ = frame_from_normal(n); a = math.radians(25)
        cc, ss = _superellipse(math.cos(a), math.sin(a), e)
        return add(c, add(mul(x, rx*cc*side), mul(y, rz*ss)))
    p0 = inner_edge(*lenses[0], 1); p1 = inner_edge(*lenses[1], -1)
    mid = add(mul(add(p0, p1), 0.5), (0.0, 0.0, 0.03))
    pts = []
    for i in range(17):
        t = i/16
        q = add(add(mul(p0, (1-t)**2), mul(mid, 2*(1-t)*t)), mul(p1, t*t))
        for _ in range(30):
            if head_sdf(q) >= 0.04: break
            q = add(q, (0.0, -0.01, 0.0))
        pts.append(q)
    m.add(*tube(pts, tr, tr, lambda i: (0, 0, 1), segs=10), frame_mat)
    return m

def build_glasses():
    return build_eyewear(GLASSES, "Acc_Glasses_Frame", "Acc_Glass_Lens", 1.0)

def build_sunglasses():
    return build_eyewear(SUNGLASSES, "Acc_Sun_Frame", "Acc_Sun_Lens", SUNGLASSES["squareness"])

def build_bubble_gum():
    g = BUBBLE_GUM; m = MeshBuilder(); r = g["r"]
    q, qn = head_front(0.0, g["mouth_z"])
    d = norm(add(qn, (0.0, 0.0, -g["drop"])))              # 입에서 살짝 아래로 부푼 방향
    c = add(q, mul(d, r*0.93))
    m.add(*lathe([(rr, h*r) for rr, h in ellipse_profile(1.0, 36)], 72, center=c, sx=r, sy=r*0.97), "Acc_Gum")
    # 입가에 뭉친 껌: 부드럽게 물결치는 납작한 고리
    x, y, _ = frame_from_normal(d)
    rc = add(q, mul(d, 0.03)); ax, ay, t = g["ring"]
    pts = []
    for i in range(97):
        a = 2*math.pi*i/96; w = 1.0 + 0.06*math.sin(5*a)
        pts.append(add(rc, add(mul(x, ax*w*math.cos(a)), mul(y, ay*w*math.sin(a)))))
    m.add(*tube(pts, t, t*0.75, lambda i: d, segs=16), "Acc_Gum_Ring")
    return m

# ---------------- 목 악세서리 ----------------
def _taper_capsule(p, a, b, ra, rb):
    pa, ba = sub(p, a), sub(b, a)
    t = max(0.0, min(1.0, dot(pa, ba)/dot(ba, ba)))
    q = sub(pa, mul(ba, t))
    return math.sqrt(dot(q, q)) - (ra + (rb-ra)*t)

def torso_sdf(p):
    b = KK_BODY
    d = _smin(_ell(p, b["upper_c"], b["upper_r"]), _ell(p, b["lower_c"], b["lower_r"]), b["blend"])
    return min(d, _ell(p, KK_BELLY["center"], KK_BELLY["radii"]))

def limbs_sdf(p):
    d = 1e9
    for s_ in (-1, 1):
        a, h = KK_ARM, KK_LEG
        d = min(d, _taper_capsule(p, (s_*a["shoulder"][0], a["shoulder"][1], a["shoulder"][2]),
                                  (s_*a["hand"][0], a["hand"][1], a["hand"][2]), a["r0"], a["r1"]))
        d = min(d, _taper_capsule(p, (s_*h["hip"][0], h["hip"][1], h["hip"][2]),
                                  (s_*h["foot"][0], h["foot"][1], h["foot"][2]), h["r0"], h["r1"]))
    return d

def character_sdf(p):
    return min(torso_sdf(p), limbs_sdf(p), head_sdf(p))

def sdf_grad(f, p, e=1e-4):
    return norm((f((p[0]+e, p[1], p[2])) - f((p[0]-e, p[1], p[2])),
                 f((p[0], p[1]+e, p[2])) - f((p[0], p[1]-e, p[2])),
                 f((p[0], p[1], p[2]+e)) - f((p[0], p[1], p[2]-e))))

def head_bottom_z(x, y):
    """(x, y) 바로 위 머리 아랫면 높이 (머리 밖이면 머리 아랫부분 최고 높이)"""
    hi = 1.65
    if head_sdf((x, y, hi)) > 0:
        return 1.40
    lo = 0.9
    for _ in range(40):
        m = 0.5*(lo+hi)
        if head_sdf((x, y, m)) < 0: hi = m
        else: lo = m
    return hi

def torso_point(theta, z):
    """몸통 축 (0,0,z)에서 theta 방향 수평으로 나가며 만나는 가장 바깥 몸통 표면"""
    d = (math.cos(theta), math.sin(theta), 0.0)
    lo, hi = 0.0, 2.0
    for _ in range(50):
        m = 0.5*(lo+hi)
        if torso_sdf(add((0, 0, z), mul(d, m))) < 0: lo = m
        else: hi = m
    p = add((0, 0, z), mul(d, lo))
    return p, sdf_grad(torso_sdf, p)

def push_out(pts, f, clearance, smooth=3, closed=False, level=False):
    """선 위의 점들을 f 표면에서 clearance 이상 떨어지게 밀어내고 부드럽게 다듬음.
    level=True면 높이는 그대로 두고 수평으로만 밀어냄 (목도리가 같은 높이로 둘러지게)"""
    pts = list(pts)
    for _ in range(smooth + 1):
        for i, q in enumerate(pts):
            for _ in range(40):
                d = f(q)
                if d >= clearance: break
                g = sdf_grad(f, q)
                if level:
                    g = norm((g[0], g[1], 0.0)) if abs(g[0]) + abs(g[1]) > 1e-6 else norm((q[0], q[1], 0.0))
                q = add(q, mul(g, clearance - d + 0.002))
            pts[i] = q
        if _ == smooth: break
        n = len(pts); new = list(pts)
        for i in range(n):
            if not closed and i in (0, n-1): continue
            a, b = pts[(i-1) % n], pts[(i+1) % n]
            new[i] = mul(add(add(a, b), mul(pts[i], 2.0)), 0.25)
        pts = new
    return pts

def cable_strength(u, h, twist_h, stitch_h):
    """꽈배기 니트 무늬 (털모자와 같은 방식). u = 기둥 안 위치 0~1, h = 길이 방향 거리. 0~1 반환"""
    def rope(x, c, w):
        q = (x - c)/w
        return math.sqrt(1 - q*q) if abs(q) < 1 else 0.0
    ph = 2*math.pi*h/twist_h
    if 0.18 < u < 0.82:
        x = (u - 0.5)/0.32
        ra, rb = rope(x, 0.5*math.sin(ph), 0.52), rope(x, -0.5*math.sin(ph), 0.52)
        front = math.cos(ph)
        ha, hb = ra*(0.78 + 0.22*front), rb*(0.78 - 0.22*front)
        lean = 1 if ha >= hb else -1
        stitch = 0.9 + 0.1*math.cos(2*math.pi*(h/stitch_h + lean*1.2*x))
        d = 0.25 + 0.75*max(ha, hb)*stitch
        return d*min(1.0, (0.82 - u)/0.03, (u - 0.18)/0.03)
    v = (u + 0.5) % 1.0 - 0.5
    return 0.05 + 0.3*math.exp(-(v/0.05)**2)*(0.85 + 0.15*math.cos(2*math.pi*h/stitch_h))

def knit_band(m, pts, normals, half_t, half_w, stripe_len, mats, closed=False, segs=40, k=None):
    """pts를 따라가는 꽈배기 니트 띠. 길이 방향으로 mats 색이 stripe_len마다 번갈아 바뀜"""
    k = k or SCARF
    n = len(pts)
    acc = [0.0]
    for i in range(1, n):
        acc.append(acc[-1] + math.sqrt(dot(sub(pts[i], pts[i-1]), sub(pts[i], pts[i-1]))))
    verts = []
    for i, p in enumerate(pts):
        if closed:
            tg = norm(sub(pts[(i+1) % n], pts[(i-1) % n]))
        else:
            tg = norm(sub(pts[min(i+1, n-1)], pts[max(i-1, 0)]))
        w = norm(sub(normals[i], mul(tg, dot(normals[i], tg)))); d = cross(tg, w)
        for j in range(segs):
            a = 2*math.pi*j/segs
            u = (k["cables"]*j/segs) % 1.0
            r = 1.0 + k["cable_depth"]*(cable_strength(u, acc[i], k["cable_twist_h"], k["stitch_row_h"]) - 0.4)
            # 둥근 사각 단면 (납작한 니트 띠)
            c, s_ = math.cos(a), math.sin(a)
            c, s_ = math.copysign(abs(c)**0.7, c), math.copysign(abs(s_)**0.7, s_)
            verts.append(add(p, add(mul(w, half_t*r*c), mul(d, half_w*r*s_))))
    faces_by = [[] for _ in mats]
    rows = n if closed else n - 1
    for i in range(rows):
        i2 = (i+1) % n
        mid = 0.5*(acc[i] + (acc[i2] if i2 else acc[-1] + math.sqrt(dot(sub(pts[0], pts[-1]), sub(pts[0], pts[-1])))))
        band = int(mid // stripe_len) % len(mats)
        for j in range(segs):
            a = i*segs + j; b = i*segs + (j+1) % segs
            faces_by[band].append((a, b, i2*segs + (j+1) % segs, i2*segs + j))
    if not closed:                      # 양 끝 막기
        for end, flip in ((0, False), (n-1, True)):
            c = len(verts); verts.append(pts[end])
            band = (0 if end == 0 else int(acc[-1] // stripe_len) % len(mats))
            for j in range(segs):
                f = (end*segs + j, end*segs + (j+1) % segs, c)
                faces_by[band].append(f[::-1] if flip else f)
    for mat, faces in zip(mats, faces_by):
        if faces:
            m.add(verts, faces, mat)
    return acc[-1]

def build_scarf():
    k = SCARF; m = MeshBuilder(); mats = ["Acc_Knit_White", "Acc_Knit_Red"]
    t_w, h_w = k["wrap_half"]
    # 감긴 부분: 목 둘레를 한 바퀴 (머리, 몸에 파묻히지 않게)
    # 팔은 목도리 안쪽 일부까지 들어와도 됨 -> 목도리가 팔 위에 얹힌 모양
    fit = lambda q: min(torso_sdf(q), head_sdf(q), limbs_sdf(q) + t_w*(0.85 + k["arm_overlap"]))
    ring, rn = [], []
    for i in range(200):
        th = 2*math.pi*i/200
        p, n = torso_point(th, k["z"])
        ring.append(add(p, mul(n, t_w*0.8)))
    for _ in range(3):
        # 몸과 배 경계에서 꺾이지 않게 다듬으며 수평으로 밀어냄
        ring = push_out(ring, fit, t_w*0.85, smooth=12, closed=True, level=True)
        # 윗단을 머리 아랫면에 맞춰 올림: 머리 가장자리 쪽(어깨 위)일수록 높아져 어깨를 덮음
        zs = [head_bottom_z(q[0], q[1]) - h_w + k["head_overlap"] for q in ring]
        zs = [sum(zs[(i+j) % len(zs)] for j in range(-6, 7))/13 for i in range(len(zs))]
        ring = [(q[0], q[1], max(k["z"], z)) for q, z in zip(ring, zs)]
    rn = [norm((q[0], q[1], 0.0)) for q in ring]      # 단면 방향: 몸 중심에서 바깥 (꼬임 없이 고르게)
    length = sum(math.sqrt(dot(sub(ring[i], ring[i-1]), sub(ring[i], ring[i-1]))) for i in range(len(ring)))
    bands = max(2, 2*round(length/k["stripe_len"]/2))       # 짝수 칸이라 이음매에서 색이 이어짐
    knit_band(m, ring, rn, t_w, h_w, length/bands, mats, closed=True, segs=24)
    # 늘어진 꼬리
    t_t, w_t = k["tail_half"]
    tail, tn = [], []
    for i in range(31):
        f = i/30
        p, n = torso_point(k["tail_theta"] - 0.12*f, k["z"] - 0.04 - k["tail_length"]*f)
        tail.append(add(p, mul(n, t_w*1.6 + t_t))); tn.append(n)
    tail = push_out(tail, character_sdf, t_t + 0.015, smooth=2)
    tl = knit_band(m, tail, tn, t_t, w_t, k["stripe_len"], mats, segs=20)
    # 꼬리 끝 술 (마지막 칸 색)
    last = mats[int(tl // k["stripe_len"]) % 2]
    end, en = tail[-1], tn[-1]
    tg = norm(sub(tail[-1], tail[-2])); side = norm(cross(tg, en))
    for j in range(k["fringe"]):
        x = (j/(k["fringe"]-1) - 0.5)*2*w_t*0.85
        a = add(end, mul(side, x))
        b = add(add(a, mul(tg, k["fringe_len"])), mul(en, 0.01))
        m.add(*tube([a, mul(add(a, b), 0.5), b], 0.016, 0.016, lambda i: en, segs=8), last)
    return m

def rounded_box(center, axes, half, e=0.35, rings=14, segs=28):
    """둥근 상자 (초타원체). axes = (가로, 세로, 앞) 단위벡터, half = 각 축 반지름"""
    ax, ay, az = axes; hx, hy, hz = half
    f = lambda v: math.copysign(abs(v)**e, v)
    verts, faces = [], []
    for i in range(rings+1):
        ph = -math.pi/2 + math.pi*i/rings
        for j in range(segs):
            th = 2*math.pi*j/segs
            lx = hx*f(math.cos(ph))*f(math.cos(th)); lz = hz*f(math.cos(ph))*f(math.sin(th)); ly = hy*f(math.sin(ph))
            verts.append(add(center, add(add(mul(ax, lx), mul(ay, ly)), mul(az, lz))))
    for i in range(rings):
        for j in range(segs):
            a = i*segs + j; b = i*segs + (j+1) % segs
            faces.append((a, a+segs, b+segs, b))
    return verts, faces

def build_crossbody_bag():
    k = CROSSBODY; m = MeshBuilder()
    st, sw = k["strap_half"]
    # 기울어진 고리 모양 끈: theta=0(화면 오른쪽 어깨)이 가장 높고 반대편(화면 왼쪽 엉덩이)이 가장 낮음
    pts = []
    for i in range(160):
        th = 2*math.pi*i/160
        p, n = torso_point(th, k["strap_center_z"] + k["strap_tilt"]*math.cos(th))
        pts.append(add(p, mul(n, st + k["clearance"])))
    pts = push_out(pts, character_sdf, st + k["clearance"], smooth=4, closed=True)
    nrm = [sdf_grad(character_sdf, q) for q in pts]
    m.add(*tube(pts + [pts[0]], st, sw, lambda i: (nrm + [nrm[0]])[i], segs=10), "Acc_Strap")
    # 가방: 끈 가장 낮은 곳 근처, 몸과 다리에 닿지 않게 바깥으로 띄움
    hx, hy, hz = k["bag_half"]
    p, n = torso_point(k["bag_theta"], k["bag_z"])
    out = norm((n[0], n[1], 0.0)); up = (0.0, 0.0, 1.0); side = cross(up, out)
    axes = (side, up, out)
    c = add(p, mul(out, hz))
    for _ in range(60):
        corners = [add(c, add(add(mul(side, sx*hx*0.9), mul(up, sy*hy*0.9)), mul(out, sz*hz)))
                   for sx in (-1, 1) for sy in (-1, 1) for sz in (-1, 1)]
        if min(character_sdf(q) for q in corners) >= 0.02: break
        c = add(c, mul(out, 0.01))
    m.add(*rounded_box(c, axes, (hx, hy, hz)), "Acc_Bag")
    fh = k["flap_h"]
    fc = add(add(c, mul(up, hy - fh*0.95)), mul(out, hz*0.9))
    m.add(*rounded_box(fc, axes, (hx*1.02, fh, 0.018)), "Acc_Strap")
    m.add(*rounded_box(add(add(fc, mul(up, -fh*0.85)), mul(out, 0.02)), axes, (0.035, 0.035, 0.016), e=0.9), "Acc_Gold")
    # 끈과 가방 양옆을 잇는 짧은 고리
    for sx in (-1, 1):
        top = add(add(c, mul(side, sx*hx*0.92)), mul(up, hy*0.9))
        j = min(range(len(pts)), key=lambda i: dot(sub(pts[i], top), sub(pts[i], top)))
        m.add(*tube([pts[j], mul(add(pts[j], top), 0.5), top], st, sw*0.7, lambda i: out, segs=10), "Acc_Strap")
    return m

def build_bowtie():
    k = BOWTIE; m = MeshBuilder()
    p, n = torso_point(-math.pi/2, k["z"])
    x, y, w = frame_from_normal(n)
    lx, ly, lz = k["wing"]
    center = add(p, mul(w, lz + 0.03))
    for s_ in (-1, 1):
        verts, faces = rounded_box((0, 0, 0), ((1, 0, 0), (0, 1, 0), (0, 0, 1)), (1, 1, 1), e=0.45, rings=16, segs=40)
        out = []
        for vx, vy, vz in verts:
            # 둥근 상자 -> 매듭 쪽이 잘록하고 바깥 끝이 넓은 날개 (t: 0=매듭, 1=끝)
            t = (vx + 1.0)/2.0
            hgt = k["pinch"] + (1 - k["pinch"])*t**0.8
            fold = 1.0 - 0.18*math.exp(-(vy/0.25)**2)*math.sin(math.pi*t)   # 가운데 가로 주름
            px = s_*(vx + 1.0)*lx
            pz = vz*lz*(0.55 + 0.45*t)*fold
            out.append(add(center, add(add(mul(x, px), mul(y, vy*ly*hgt)), mul(w, pz))))
        if s_ < 0:
            faces = [f[::-1] for f in faces]
        m.add(out, faces, "Acc_Bowtie")
    kx, ky, kz = k["knot"]
    m.add(*lathe([(r, h*kz) for r, h in ellipse_profile(1.0, 12)], 28, frame=(x, y, w), center=add(center, mul(w, 0.01)),
                 sx=kx, sy=ky), "Acc_Bowtie_Knot")
    return m

# ---------------- 손 악세서리 ----------------
def hand_tip():
    a = KK_ARM
    d = norm(sub(a["hand"], a["shoulder"]))
    return add(a["hand"], mul(d, a["r1"]*0.6)), d

def build_balloon():
    k = BALLOON; m = MeshBuilder(); rx, rz = k["r"]
    c = k["center"]
    # 아래가 살짝 좁은 달걀 모양
    prof = []
    for i in range(41):
        t = math.pi*i/40; h = -math.cos(t)
        prof.append((rx*math.sin(t)*(0.86 + 0.14*(h+1)/2), h*rz))
    m.add(*lathe(prof, 48, center=c), "Acc_Balloon")
    bottom = (c[0], c[1], c[2] - rz)
    kn = k["knot"]
    m.add(*lathe([(r*kn, h*kn) for r, h in ellipse_profile(1.2, 12)], 16, center=(bottom[0], bottom[1], bottom[2] - kn*0.6)),
          "Acc_Balloon")
    # 줄: 손 끝 -> 매듭, 바깥으로 살짝 휘고 몸/머리에 닿지 않게
    tip, d = hand_tip()
    start = add(tip, mul(d, -0.05))
    end = (bottom[0], bottom[1], bottom[2] - kn*1.6)
    mid = add(mul(add(start, end), 0.5), (k["string_bow"], 0.0, 0.0))
    pts = []
    for i in range(41):
        t = i/40
        pts.append(add(add(mul(start, (1-t)**2), mul(mid, 2*(1-t)*t)), mul(end, t*t)))
    pts = [pts[0]] + push_out(pts[1:], lambda q: min(head_sdf(q), torso_sdf(q)), 0.03, smooth=2)
    m.add(*tube(pts, k["string_r"], k["string_r"], lambda i: (0, -1, 0), segs=6), "Acc_String")
    return m

def build_americano():
    k = AMERICANO; m = MeshBuilder()
    tip, _ = hand_tip()
    b0 = add(tip, k["offset"])                     # 컵 바닥 중심
    H = k["height"]; rb, rt = k["radius"]; w = k["wall"]
    rad = lambda h: rb + (rt - rb)*h/H
    # 투명 컵 (바깥 벽 -> 테두리 -> 안쪽 벽)
    prof = [(0.0, 0.0), (rb, 0.0), (rt, H), (rt + 0.012, H + 0.004), (rt + 0.012, H + 0.012), (rt - w, H + 0.008),
            (rb - w, 0.015), (0.0, 0.015)]
    m.add(*lathe(prof, 48, center=b0), "Acc_Cup")
    # 커피
    f = H*k["fill"]
    m.add(*lathe([(0.0, 0.016), (rad(0.016) - w*1.2, 0.016), (rad(f) - w*1.2, f), (0.0, f)], 40, center=b0), "Acc_Coffee")
    # 얼음 (커피 위로 살짝 떠오른 각얼음)
    s_ = k["ice_size"]
    for i in range(k["ice"]):
        a = 2*math.pi*i/k["ice"] + 0.4
        rr = (rad(f) - s_*1.3)*(0.25 if i == 0 else 0.75)
        c = add(b0, (rr*math.cos(a), rr*math.sin(a), f - s_*0.25 + 0.02*math.sin(3*a)))
        t = 0.5 + 0.6*i
        X = (math.cos(t), math.sin(t), 0.15); Y = norm(cross((0.1, 0.2, 1.0), X)); X = norm(X); Z = cross(X, Y)
        m.add(*rounded_box(c, (X, Y, Z), (s_, s_, s_*0.9), e=0.4, rings=8, segs=16), "Acc_Ice")
    # 빨대: 컵 안에서 바깥쪽으로 살짝 기울어져 위로
    p0 = add(b0, (-rb*0.3, 0.02, 0.03)); p1 = add(b0, (rt*0.35, -0.03, H + k["straw_out"]))
    m.add(*tube([p0, mul(add(p0, p1), 0.5), p1], k["straw_r"], k["straw_r"], lambda i: (0, -1, 0), segs=12), "Acc_Straw")
    return m

def book_frame():
    """책 중심과 축 (X: 가로, 뒤쪽 방향 / Y: 위 / N: 바깥 표지 방향)"""
    k = BOOK; hx, hy, hz = k["half"]
    n = norm((k["facing"][0], k["facing"][1], 0.0))
    Y = (0.0, 0.0, 1.0); X = cross(Y, n)
    p, _ = torso_point(k["side_theta"], k["side_z"])
    c = add(add(p, mul(n, hz + 0.01)), mul(X, -k["forward"]))
    for _ in range(60):                  # 안쪽 표지가 몸에 파묻히지 않을 때까지 바깥으로
        pts = [add(add(add(c, mul(X, sx*hx)), mul(Y, sy*hy)), mul(n, -hz)) for sx in (-1, 0, 1) for sy in (-1, 0, 1)]
        if min(torso_sdf(q) for q in pts) >= 0.005: break
        c = add(c, mul(n, 0.01))
    return c, X, Y, n

def book_arm_pose():
    """책을 낄 때 오른팔 회전 (어깨 기준 축과 각도, Blender 좌표). 웹 코드 BOOK_ARM_POSE와 같은 값"""
    k = BOOK; a = KK_ARM
    c, X, Y, n = book_frame()
    target = add(add(c, mul(n, k["half"][2] + a["r1"]*k["hand_press"])), mul(X, 0.02))
    v0 = norm(sub(a["hand"], a["shoulder"])); v1 = norm(sub(target, a["shoulder"]))
    axis = cross(v0, v1); ang = math.atan2(math.sqrt(dot(axis, axis)), dot(v0, v1))
    return norm(axis), ang

def build_book():
    k = BOOK; m = MeshBuilder()
    c, X, Y, n = book_frame()
    hx, hy, hz = k["half"]; bd = k["board"]; ax = (X, Y, n)
    for zs in (1, -1):                   # 바깥, 안쪽 표지
        m.add(*rounded_box(add(c, mul(n, zs*(hz - bd))), ax, (hx, hy, bd), e=0.2), "Acc_Book_Cover")
    m.add(*rounded_box(add(c, mul(X, hx - 0.012)), ax, (0.03, hy, hz), e=0.6), "Acc_Book_Cover")   # 책등 (뒤쪽)
    m.add(*rounded_box(add(c, mul(X, -0.012)), ax, (hx - 0.02, hy - 0.016, hz - bd*1.6), e=0.12), "Acc_Book_Page")
    for i in range(-3, 4):               # 앞쪽 가장자리의 종이 결
        m.add(*rounded_box(add(add(c, mul(X, -(hx - 0.017))), mul(n, i*0.009)), ax, (0.004, hy - 0.02, 0.0012),
                           e=0.5, rings=4, segs=8), "Acc_Book_Line")
    m.add(*rounded_box(add(add(c, mul(n, hz + 0.002)), mul(Y, hy*0.25)), ax, (hx*0.55, hy*0.16, 0.006), e=0.3),
          "Acc_Book_Label")
    top = add(add(c, mul(Y, hy - 0.01)), mul(X, -hx*0.25))           # 책갈피 끈
    m.add(*tube([top, add(add(top, mul(Y, 0.07)), mul(X, -0.015)), add(add(top, mul(Y, 0.045)), mul(X, -0.08))],
                0.008, 0.022, lambda i: n, segs=6), "Acc_Book_Mark")
    return m

BUILDERS = {"beanie": build_beanie, "cap": build_cap, "headset": build_headset,
            "glasses": build_glasses, "sunglasses": build_sunglasses, "bubble_gum": build_bubble_gum,
            "scarf": build_scarf, "crossbody_bag": build_crossbody_bag, "bow_tie": build_bowtie,
            "balloon": build_balloon, "americano": build_americano, "book": build_book}
# 악세서리마다 붙는 앵커 (GLB 원점)
ANCHOR_OF = {"beanie": HEAD_ANCHOR, "cap": HEAD_ANCHOR, "headset": HEAD_ANCHOR,
             "glasses": FACE_ANCHOR, "sunglasses": FACE_ANCHOR, "bubble_gum": FACE_ANCHOR,
             "scarf": NECK_ANCHOR, "crossbody_bag": BODY_ANCHOR, "bow_tie": NECK_ANCHOR,
             "balloon": HAND_ANCHOR, "americano": HAND_ANCHOR, "book": BODY_ANCHOR}

def hex_to_linear(hx):
    hx = hx.lstrip("#")
    def c(v):
        v = int(v, 16)/255.0
        return v/12.92 if v <= 0.04045 else ((v+0.055)/1.055)**2.4
    return (c(hx[0:2]), c(hx[2:4]), c(hx[4:6]), 1.0)

# ============================================================
# 3. Blender에 생성 / 내보내기 (bpy가 있을 때만)
# ============================================================
def run_blender():
    import bpy
    import bmesh

    col = bpy.data.collections.get("Kkebook_Accessories")
    if col:
        for ob in list(col.objects):
            data = ob.data
            bpy.data.objects.remove(ob, do_unlink=True)
            if data is not None and data.users == 0 and data.name in bpy.data.meshes:
                bpy.data.meshes.remove(data)
        bpy.data.collections.remove(col)
    col = bpy.data.collections.new("Kkebook_Accessories")
    bpy.context.scene.collection.children.link(col)

    mats = {}
    for name, hx in COLORS.items():
        mt = bpy.data.materials.get(name) or bpy.data.materials.new(name)
        mt.use_nodes = True
        bsdf = next((nd for nd in mt.node_tree.nodes if nd.type == "BSDF_PRINCIPLED"), None)
        if bsdf is None:
            bsdf = mt.node_tree.nodes.new("ShaderNodeBsdfPrincipled")
        lin = hex_to_linear(hx)
        bsdf.inputs["Base Color"].default_value = lin
        bsdf.inputs["Roughness"].default_value = ROUGHNESS[name]
        bsdf.inputs["Metallic"].default_value = 0.0
        if name in ALPHA:                    # 반투명 (유리알, 풍선껌)
            bsdf.inputs["Alpha"].default_value = ALPHA[name]
            lin = (lin[0], lin[1], lin[2], ALPHA[name])
            if hasattr(mt, "blend_method"):
                mt.blend_method = "BLEND"
            if hasattr(mt, "surface_render_method"):   # Blender 4.2+
                mt.surface_render_method = "BLENDED"
        mt.diffuse_color = lin
        mats[name] = mt

    objs = {}
    for name in BUILD:
        mb = BUILDERS[name]()
        anchor = ANCHOR_OF[name]
        me = bpy.data.meshes.new(name)
        me.from_pydata([mul(sub(v, anchor), S) for v in mb.verts], [], mb.faces)
        for mname in mb.materials:
            me.materials.append(mats[mname])
        for poly, mi, sm in zip(me.polygons, mb.mat_idx, mb.smooth):
            poly.material_index = mi
            poly.use_smooth = sm
        bm = bmesh.new(); bm.from_mesh(me)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(me); bm.free()
        me.update()
        ob = bpy.data.objects.new(name, me)
        ob.location = mul(anchor, S)        # 캐릭터의 제자리에 얹혀 보이게 (미리보기용)
        col.objects.link(ob)
        objs[name] = ob

    if EXPORT_DIR:
        os.makedirs(EXPORT_DIR, exist_ok=True)
        for name, ob in objs.items():
            for o in bpy.context.view_layer.objects:
                o.select_set(False)
            ob.select_set(True)
            bpy.context.view_layer.objects.active = ob
            keep = ob.location.copy()
            ob.location = (0.0, 0.0, 0.0)   # GLB 원점 = 앵커
            path = os.path.join(EXPORT_DIR, f"{name}.glb")
            opts = dict(filepath=path, export_format="GLB", use_selection=True, export_yup=True, export_apply=True)
            try:
                bpy.ops.export_scene.gltf(**opts, export_cameras=False, export_lights=False)
            except TypeError:
                bpy.ops.export_scene.gltf(**opts)
            ob.location = keep
            print("Exported:", path)
    print("kkebook accessories built:", ", ".join(BUILD))

try:
    import bpy  # noqa
    run_blender()
except ImportError:
    pass
