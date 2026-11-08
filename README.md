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
