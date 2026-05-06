# 게임 패턴 카탈로그

짬짬이 교실의 25개 게임은 3가지 플레이 패턴 중 하나를 따른다. 새 게임은 반드시 이 중 하나의 패턴을 골라 골든 템플릿을 기반으로 제작한다.

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

### 기존 게임 (12개)
flag-quiz, capital-quiz, ox-quiz, color-touch, shape-match, size-compare, more-or-less, color-count, shadow-match, missing-piece, mirror-match, initial-quiz, proverb-quiz, clock-reading

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

### 기존 게임 (6개)
nim-game, dots-and-boxes, secret-code, mirror-draw

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
- `createTimer(seconds, onTick, onEnd)` — 카운트다운
- `createScoreboard(element)` — 점수
- `createSoundManager(soundMap)` — Web Audio 효과음
- `playCountdown(callback)` — 3, 2, 1 카운트다운

### 등록 절차
1. `games/registry.json` 배열에 폴더명 추가
2. `index.html` 런처의 `CATEGORY_MAP`, `GAME_ICONS`, `FALLBACK_GAMES`에 추가

---

## 패턴 선택 가이드

| 게임 아이디어 특징 | 권장 패턴 |
|---|---|
| 정답이 정해져 있고 모두 같은 문제를 푸는가? | A |
| 각자 자기 영역에서 점수를 모으는가? | B |
| 한 명씩 번갈아 행동하거나 역할이 다른가? | C |
| 시간 제한이 핵심이고 누적 점수가 승부? | B |
| 라운드제이고 정답/오답이 명확한가? | A |
| 협력이나 정보 비대칭이 핵심인가? | C |
