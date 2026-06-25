# Retro Theme Strengthening + Mascot Animation — Design Spec

## Overview

TouchGame 런처의 시각적 레트로 아케이드 느낌을 강화한다: 픽셀 폰트를 실제로 번들링하고, 카드/헤더 스타일을 더 두껍고 아케이드답게 다듬고, 런처 히어로 영역 아래에 점을 먹으며 지나가는 캐릭터 애니메이션을 추가한다. 비주얼 컴패니언으로 3가지 색감 방향과 3가지 캐릭터 디자인을 실제 동작하는 CSS 데모로 보여주고 사용자가 직접 선택했다 (테마: 8비트 콘솔 강화안 / 캐릭터: 보라색 눈 달린 몬스터).

## 결정된 사항

- **테마 방향**: "8비트 콘솔" — 기존 흰/크림 배경 디자인 시스템은 유지하고, 두꺼운 외곽선·하드 오프셋 그림자·원색 포인트를 더 강하게 적용. 네온 CRT/신스웨이브(둘 다 다크 배경)는 기각 — 게임 내부 색 토큰을 전부 재작업해야 해서 범위가 너무 커짐.
- **폰트**: 자유 라이선스(OFL 등) 한국어 픽셀 폰트 woff2 파일을 `shared/fonts/`에 실제로 추가하고 `@font-face`로 연결한다. 지금처럼 `font-family: 'DungGeunMo', ...`로 이름만 적어두는 방식은 기각 — 해당 폰트가 설치된 기기가 거의 없어서 실제로는 대부분 일반 산스리프로 보임. 폰트 파일이 없으면 "레트로화"가 시각적으로 거의 드러나지 않는다.
- **마스코트 캐릭터**: 보라색 원형 몸통 + 흰 눈 1개 + 입 벌렸다 닫았다 하는 애니메이션(아래쪽 쐐기 모양이 점멸). 노란색 + 정확한 입모양으로 가는 안(option A)은 기각 — 상표가 있는 특정 캐릭터(팩맨)를 그대로 베끼는 모양이 되어서, 같은 "점 먹기" 동작은 살리되 색과 디테일(눈)을 다르게 줘 사이트 고유 캐릭터로 차별화했다.
- **애니메이션 위치/범위**: 런처(`index.html`)의 히어로 섹션(`arcade-hero`) 바로 아래에 가로 폭 전체를 가로지르는 한 줄짜리 트랙. 4초 주기로 좌→우 이동을 반복(루프), 트랙을 따라 점이 점점이 깔려 있고 캐릭터가 지나가며 사라지는 것처럼 보이게 한다. **개별 게임 화면(60개 game.js/index.html)에는 적용하지 않는다** — 사용자 확인: 게임 파일까지 건드리면 범위가 점수/랭킹 작업(Phase 1)처럼 60개 파일을 건드려야 해서 너무 커짐. 순수 런처 전용 기능.

## 아키텍처

### 새 파일
- `shared/fonts/<font-name>.woff2` — 자유 라이선스 한국어 픽셀 폰트 1개 (예: 둥근모 계열의 무료 배포 woff2). 라이선스 파일도 같이 추가 (`shared/fonts/LICENSE.txt` 등 폰트 배포 조건에 명시된 대로).

### 수정 파일
- `shared/style.css`:
  - 최상단에 `@font-face { font-family: 'TouchGamePixel'; src: url('fonts/<font-name>.woff2') format('woff2'); font-display: swap; }` 추가
  - `--font-family` 토큰의 1순위를 `'TouchGamePixel'`로 변경 (기존 `DungGeunMo` 등 이름만 있던 폴백 리스트는 2순위 이후로 유지 — 폰트 파일 로딩 실패 시의 보험)
  - 카드/헤더 보더·그림자를 8비트 콘솔 방향에 맞춰 더 두껍게 조정 (기존 `--shadow-card: 0 2px 8px rgba(...)` → 오프셋 하드 섀도 계열로, `--card-radius`는 유지)
  - 마스코트 애니메이션용 CSS 클래스 추가: `.mascot-track`, `.mascot`, `.mascot .body`, `.mascot .eye`, `@keyframes mascotMove`, `@keyframes mascotChomp`, `.mascot-track .dot`
- `index.html` (런처):
  - `<link rel="preload" as="font" ...>` 또는 단순 `@font-face` swap으로 충분 (사전 로드는 선택)
  - `arcade-hero` 섹션 바로 아래에 `<div class="mascot-track"><span class="dot">...여러 개...</span><div class="mascot"><div class="body"><div class="eye"></div></div></div></div>` 마크업 추가

## 검증

- 브라우저에서 런처를 열어 폰트가 실제로 픽셀체로 렌더링되는지 확인 (개발자 도구 Network 탭에서 woff2 로딩 200 확인)
- 마스코트가 4초 주기로 좌→우 반복 이동하는지, 입이 점멸하는지 스크린샷/짧은 관찰로 확인
- `node scripts/validate-catalog.js` — 이 작업은 게임 파일을 건드리지 않으므로 영향 없어야 함 (확인용)
- 기존 게임 화면(`games/*/index.html`)이 `shared/style.css`의 `--font-family` 변경으로 깨지지 않는지 1~2개 샘플 확인 (게임 내부 텍스트도 같은 폰트 토큰을 쓰므로 픽셀 폰트가 게임 내부에도 자동 적용됨 — 의도된 동작)

## 범위 밖 (다음에 필요하면)

- 게임 화면 내부에도 마스코트/애니메이션을 넣는 것 — 60개 파일을 건드려야 해서 별도 작업
- 다크 모드/네온 테마로 전면 전환 — 기각된 방향, 필요해지면 재논의
