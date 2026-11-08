# B. Photo Project

Vite + TypeScript + Three.js 기반의 3D 온라인 사진전 프런트엔드 초기 환경입니다.

## Run

```bash
npm install
npm run dev
```

브라우저에 표시된 로컬 주소를 열면 기본 전시실 장면을 볼 수 있습니다.

## Build

```bash
npm run build
```

## 함께 작업하기

- 저장소: https://github.com/9ooseul2/bzt-photo
- 테스트 사이트: https://9ooseul2.github.io/bzt-photo/

### main 브랜치는 보호되어 있습니다

`main`은 실제 사이트에 자동 배포되는 버전이라, 직접 push하면 GitHub가 거절하도록 설정되어 있습니다.
모든 수정은 **브랜치에서 작업 → PR 올리기 → 자동 빌드 검사(`build`) 통과 → 머지** 순서로 들어가며,
머지되면 1~2분 뒤 사이트에 자동 반영됩니다.

### 작업 순서

1. 최신 main 받기

   ```bash
   git switch main
   git pull
   ```

2. 작업용 브랜치 만들기

   ```bash
   git switch -c feat/작업이름
   ```

3. 작업 후 저장하고 올리기

   ```bash
   git add .
   git commit -m "무엇을 바꿨는지"
   git push -u origin feat/작업이름
   ```

4. GitHub에서 **Compare & pull request** → 설명에 "무엇을, 왜" 한두 줄 → **Create pull request**
5. 검사(`build`)가 초록색이 되면 서로 확인한 뒤 **Merge pull request**
6. 머지한 브랜치는 **Delete branch**로 정리하고, 내 컴퓨터는 1번부터 다시 시작

### 브랜치 이름 규칙

| 앞머리 | 용도 | 예시 |
|---|---|---|
| `feat/` | 새 기능 | `feat/guestbook-supabase` |
| `fix/` | 버그·화면 수정 | `fix/photo-not-loading` |
| `art/` | 3D 모델·사진 에셋 | `art/accessory-beanie` |
| `docs/` | 문서 수정 | `docs/collab-guide` |

영어 소문자와 하이픈(`-`)만 사용합니다.

### 참고

- 3D 파일(`.glb`, `.blend`)은 두 사람이 동시에 수정하면 합칠 수 없으므로, 작업 전에 미리 공유합니다.
- 작품 사진은 긴 변 2048~2560px 정도로 줄여서 올립니다 (로딩 속도).
- `public` 폴더 파일을 코드에서 불러올 때는 아래 [Deploy & asset paths](#deploy--asset-paths)를 참고합니다.

## Structure

- `src/core`: 앱 시작과 공통 조정 코드
- `src/scenes`: Three.js 전시실 장면
- `src/characters`: 이후 캐릭터·이동 모듈
- `src/ui`: DOM 기반 사용자 인터페이스
- `src/services`: 이후 API·실시간 통신 어댑터
- `public/models`, `public/textures`, `public/images`: 정적 에셋
- `templates`: 재사용할 전시실 설정

## Sample gallery configuration

`src/scenes/exhibition/sampleExhibitionConfig.ts`에서 전시실 전체 폭·깊이·기본 벽 높이,
출입구, 외벽과 내부 가벽 목록을 수정할 수 있습니다. 내부 가벽은 `id`, `position`,
`length`, `height`, `rotationY`, `artworkSides`로 정의합니다. 각 내부 가벽은 양면 작품
앵커를 생성하며, 실제 작품은 아직 추가하지 않습니다.

`ExhibitionRoom`은 이 설정값으로 바닥·외벽·가벽·출입구와 별도로 미래 이동 기능용
`navigation` 데이터를 함께 재생성합니다. 여기에는 방 경계(`walkableBounds`)와 내부 벽
충돌 정보(`blockingObstacles`)가 분리되어 있습니다.

## Visitor controls

- 마우스 왼쪽 또는 오른쪽 버튼을 드래그하면 3인칭 카메라가 회전합니다. 짧은 왼쪽 클릭은 드래그로 처리되지 않습니다.
- 마우스 휠로 3m부터 12m 범위에서 부드럽게 확대·축소할 수 있으며, 페이지는 스크롤되지 않습니다.
- 카메라 구도값은 `src/scenes/cameras/visitorCameraConfig.ts`에서 조정합니다.

## Deploy & asset paths

- `main` 브랜치에 합쳐지면 GitHub Actions(`.github/workflows/deploy.yml`)가 빌드 후 GitHub Pages에 자동 배포합니다.
- `vite.config.ts`의 `base: './'` 덕분에 `github.io/bzt-photo/` 주소와 정식 도메인 어디서나 같은 결과물이 동작합니다.
- `public` 폴더의 파일(작품 사진, 3D 모델 등)을 코드에서 불러올 때는 `src/config/publicAsset.ts`의
  `publicAsset('/images/...')`를 거쳐 주세요. 주소를 직접 넣으면 배포 주소에서 파일을 못 찾을 수 있습니다.
