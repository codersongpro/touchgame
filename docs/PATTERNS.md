# 게임 패턴 카탈로그

짬짬이 교실의 33개 게임은 4가지 플레이 패턴 중 하나를 따른다. 새 게임은 반드시 이 중 하나의 패턴을 골라 골든 템플릿을 기반으로 제작한다.

---

## 패턴 A: 동시 반응형 (Simultaneous Reaction)

### 메커니즘
- 모든 플레이어에게 같은 문제가 동시에 표시됨
- 각자 자기 zone에서 보기 중 정답을 먼저 터치
- 라운드 단위로 진행 (보통 10라운드)
- 정답 +1, 오답 -1 (게임마다 다름)

### 골든 템플릿: `flag-quiz`
- 상단: 문제 패널 (문제 + 타이머 + X 버튼)
- 중간: zones-wrap (플레이어 수만큼 분할 — 2P 좌우, 3P 3분할, 4P 4분할 가로)
- 하단: 점수 바
- 결과: 라운드별 점수 테이블

### 적합한 게임 유형
- 퀴즈류 (지식, OX, 객관식)
- 시각 매칭 (그림자, 색깔, 모양)
- 빠른 판단 (크기 비교, 많다 적다)

### 기존 게임 (15개)
flag-quiz, capital-quiz, ox-quiz, color-touch, shape-match, size-compare, more-or-less, color-count, shadow-match, missing-piece, mirror-match, initial-quiz, proverb-quiz, clock-reading, english-word

---

## 패턴 B: 개별 영역형 (Independent Zones)

### 메커니즘
- 각 플레이어가 자기 zone에서 독립적으로 플레이
- 시간 제한 (보통 30초~1분) 안에 점수 누적
- 플레이어 간 직접 상호작용 없음 (점수만 비교)

### 골든 템플릿: `whack-a-mole`
- 상단 HUD: 타이머 바 + 점수 바 + X 버튼
- 중간: game-zones (플레이어 수만큼 분할, 각 zone에 게임 요소 동적 생성)
- 결과: 우승자 + 점수 비교

### 적합한 게임 유형
- 반응속도 (터치, 회피)
- 누적 점수 (시간 내 최대 점수)
- 미니 미로/타이밍 게임

### 기존 게임 (7개)
whack-a-mole, reaction-race, balloon-pop, bomb-dodge, number-tap, quick-math, memory-match
(여기서 memory-match는 짝 맞추기 메커니즘)

---

## 패턴 C: 턴제/협력형 (Turn-Based / Cooperative)

### 메커니즘
- 한 번에 1명이 행동 (턴제)
- 또는 2명이 역할 분담하여 협력
- 정보 비대칭, 타이밍 동기화, 연쇄 반응 등 협력 메커니즘

### 골든 템플릿: `nim-game` (턴제) / `secret-code` (협력)
- 상단 헤더: 턴 인디케이터 또는 역할 표시
- 중간: 게임 보드 (양쪽 플레이어가 같은 화면 공유)
- 하단: 액션 버튼 (현재 턴 플레이어만 활성화)
- 결과: 승자 또는 협력 성공/실패

### 적합한 게임 유형
- 전략 (Nim 변형, 보드 게임)
- 협력 (정보 비대칭, 역할 분담, 타이밍)
- 그리기/설명 게임

### 기존 게임 (5개)
nim-game, dots-and-boxes, secret-code, mirror-draw, color-signal

---

---

## 패턴 D: 퍼즐 병렬 경쟁 (Puzzle Parallel Race)

### 메커니즘
- 모든 플레이어가 **각자 자기 zone에서 동일한 퍼즐**을 풀음
- 각 zone에 같은 퍼즐 상태 복제 (deterministic seed로 동기화)
- **먼저 완성한 사람 승리** → 나머지 플레이어 zone freeze
- 라운드제 (보통 3-5라운드, 라운드마다 다른 퍼즐)
- 시간 제한 (라운드당 30초~1분)
- 모두 시간 초과 시 → 가장 많이 진행한 사람이 그 라운드 승

### 골든 템플릿: `slide-puzzle` (예정)
- 상단 패널: 라운드 카운터 + 타이머 + X 닫기
- 중간: zones-wrap (2-4분할), 각 zone에 동일 퍼즐
- 하단: 점수 바
- 결과: 라운드별 1등 횟수 + 총합

### 적합한 게임 유형
- 슬라이딩 퍼즐, 미로, 점 잇기, 한붓그리기
- 파이프 잇기, 레이저 반사
- 일반적인 1인 퍼즐 → 병렬 경쟁으로 변환

### 4P에서의 zone 크기 주의
- 4P 모드는 화면 1/4 → 격자가 손가락 크기 이하로 작아질 수 있음
- 게임마다 **최대 인원 제한** 설정 필요 (일부는 2-3P까지)

### 디자인 (반드시 Level 3 Comic 스타일 유지)
- ❌ 검정 배경, 네온 색, 글로우 효과 금지
- ✅ 크림 배경 + 파스텔 zone + 검정 두꺼운 테두리
- ✅ 격자선/퍼즐 요소도 검정 #2C2C2C 라인
- ✅ 오프셋 하드 그림자

---

## 🚨 모든 패턴 공통: 터치스크린 학생 접근성

학생들은 태블릿을 책상에 놓고 둘러서서 게임함. **인터랙션 요소는 반드시 zone 하단**:

- 정보(타이머/카운터/문제) → zone **상단** 또는 가운데
- 조작(버튼/퍼즐/드래그) → zone **하단** (`margin-top: auto`)
- 4P 모드에서도 동일 원칙

자세한 규칙은 `AI_ROUTINE.md`의 "절대 규칙 #0-2" 참조.

---

## 공통 골격 (모든 패턴 공통)

### 4-파일 구조
```
games/{folder}/
  ├── game.json    # 메타데이터
  ├── index.html   # 3-screen 구조 (intro / countdown / game / result)
  ├── style.css    # 게임 고유 스타일만
  └── game.js      # 게임 로직
```

### 3-screen 구조
1. **screen-intro**: 게임 헤더 + 일러스트 + 설명 + (인원 선택) + PLAY 버튼
2. **screen-countdown**: 3, 2, 1
3. **screen-game**: 패턴별로 다름
4. **screen-result**: 우승자/점수 + 다시하기/홈 버튼

### 공통 요소 (`shared/style.css`에서 자동 적용)
- 테두리 3px, 오프셋 그림자, font-weight 900
- 노란 청키 PLAY 버튼
- 크림 배경 + 도트 패턴
- 파스텔 zone 배경 (.p-blue / .p-red / .p-orange / .p-purple)
- X 닫기 버튼 우상단 고정
- 결과 화면 다시하기/홈 버튼

### 공통 모듈 (`shared/engine.js`)
- `createTimer(seconds, onTick, onEnd)` — 카운트다운 타이머
- `createScoreboard(element)` — 점수 관리
- `createSoundManager(soundMap)` — Web Audio 효과음
- `createBgmManager()` — 카테고리별 BGM (자동 주입, 기본 OFF)
- `onTap(element, callback)` — 클릭 + 터치 통합 핸들러 (300ms 딜레이 없음)
- `goHome()` — 런처로 이동
- `_GAME_CATEGORY_MAP` — 폴더명 → 카테고리 (BGM 자동 매핑용)

### 게임별 카운트다운
각 게임이 자체 구현 (예: `startPreGameCountdown(onDone)`). 공통 모듈에는 없음.

### 등록 절차
1. `games/registry.json` 배열에 폴더명 추가
2. `index.html` 런처의 `CATEGORY_MAP`, `GAME_ICONS`, `FALLBACK_GAMES`, `PLAYER_COUNTS`에 추가
3. `shared/engine.js`의 `_GAME_CATEGORY_MAP`에도 추가 (BGM 분류)
4. `node scripts/verify-game.js {folder}` 정적 검증

---

## 패턴 선택 가이드

| 게임 아이디어 특징 | 권장 패턴 |
|---|---|
| 정답이 정해져 있고 모두 같은 문제를 푸는가? | A |
| 각자 자기 영역에서 점수를 모으는가? | B |
| 한 명씩 번갈아 행동하거나 역할이 다른가? | C |
| 협력이나 정보 비대칭이 핵심인가? | C |
| 같은 퍼즐을 동시에 풀어 먼저 끝낸 사람이 승리? | D |
| 시간 제한이 핵심이고 누적 점수가 승부? | B |
| 라운드제이고 정답/오답이 명확한가? | A |
