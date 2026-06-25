# 10 New Mini-Games + Front-of-List Placement — Design Spec

## Overview

기존 60개 게임과 같은 방식(골든 템플릿 복제, `game.json` 메타데이터, `scripts/register-game.js`/`scripts/verify-game.js` 검증)으로 신규 미니게임 10개를 추가하고, `games/registry.json` 맨 앞에 배치해 런처 기본 정렬에서 가장 먼저 보이게 한다.

## 결정된 사항

- **카테고리 분배**: 현재 카테고리별 게임 수(speed 7, coop 8, puzzle 8, brain 11, knowledge 13, math 13)가 가장 적은 3개 카테고리를 채운다 — **speed 4개, coop 3개, puzzle 3개**. 작업 후 분포는 speed 11 / coop 11 / puzzle 11로 brain/knowledge/math와 균형을 맞춘다.
- **배치**: `games/registry.json` 배열의 **맨 앞**에 10개 폴더명을 추가한다 (기존 60개는 그대로 뒤에 유지). 런처가 `registry.json` 순서 그대로 카드를 렌더링하므로, 별도 "신규" 정렬 로직 없이 배열 순서만으로 맨 앞에 노출된다. `index.html`의 `FALLBACK_GAMES`(레지스트리 로딩 실패 시 폴백) 배열에도 같은 순서로 앞쪽에 추가한다 — `scripts/verify-game.js` 체크 #6이 `FALLBACK_GAMES` 등록을 요구하므로 누락하면 검증이 실패한다.
- **게임 컨셉 10개** (기존 60개와 메커니즘 중복 없음 확인됨):

| # | 이름 | 폴더명(안) | 카테고리 | 패턴 | 메커니즘 |
|---|---|---|---|---|---|
| 1 | 번개 타이밍 탭 | `timing-tap` | speed | A | 좌우로 움직이는 게이지가 초록 구간에 들어온 순간 가장 먼저 탭한 사람이 점수 |
| 2 | 두 곳 동시 탭 | `double-tap` | speed | A | 화면에 동시에 뜬 두 점을 두 손가락으로 동시에 정확히 탭, 가장 빠른 사람 승 |
| 3 | 피해라! | `dodge-rush` | speed | B | 자기 zone에 점점 빨라지는 속도로 떨어지는 장애물을 좌우 이동 탭으로 피함, 생존 시간 누적 점수 |
| 4 | 색깔 거짓말 탭 | `stroop-tap` | speed | A | 색 이름 글자와 실제 글자색이 다른 스트룹 효과 — "글자색"을 보고 맞는 버튼을 빠르게 탭 |
| 5 | 균형 잡기 협동 | `balance-team` | coop | C | 두 명이 교대로 터치해 막대 위 공의 균형을 맞춰 목표 지점까지 이동 |
| 6 | 미로 길잡이 | `maze-guide` | coop | C | 한 명은 미로 전체를 보고 말로 길을 안내, 다른 한 명은 미로를 못 보고 안내만 듣고 터치로 이동 |
| 7 | 신호 손전등 | `signal-charades` | coop | C | 화면에 뜬 색/단어 신호를 직접 말하지 않고 동작이나 한 단어 힌트로만 설명해 맞히기 |
| 8 | 색깔 채우기 | `flood-fill` | puzzle | D | 격자 전체를 최소 클릭 수로 한 색으로 통일시키는 플러드필 퍼즐, 동시 경쟁 |
| 9 | 블록 회전 맞추기 | `block-rotate` | puzzle | D | 회전되어 표시된 블록 조각을 맞는 방향으로 돌려 빈칸에 끼워맞춤, 먼저 완성한 사람 승 |
| 10 | 거울 미로 탈출 | `mirror-maze` | puzzle | D | 좌우가 반전되어 보이는 미로에서 목표 지점까지 먼저 도달하는 사람 승 |

(폴더명은 가안 — 실제 등록 시 `games/registry.json`과 중복되지 않는지 재확인한다.)

## 아키텍처 — 기존 워크플로우 재사용

이 작업은 새로운 아키텍처가 필요 없다. 이미 존재하는 절차(`docs/ADDING_GAMES.md`, `docs/GAME_SPEC.md`, `docs/PATTERNS.md`)를 10번 반복 실행하는 일이다:

1. 게임별로 `docs/GAME_SPEC.md` 양식에 맞춰 명세 작성 (패턴별 골든 템플릿 지정: A→`flag-quiz`, B→`balloon-pop`(`docs/PATTERNS.md`가 가리키는 `whack-a-mole`은 현재 폴더가 없으므로 실제 존재하는 B 패턴 게임으로 대체), C→`nim-game`/`secret-code`, D→`slide-puzzle`)
2. 골든 템플릿을 `games/{folder}/`로 복사, `game.js`/`index.html`/`style.css` 내용을 게임별로 수정
3. `npm run register:game -- games/{folder}` 실행 → `game.json` 정규화 + `games/registry.json` 자동 등록 (이번엔 맨 끝이 아니라 **맨 앞**에 들어가도록 등록 후 배열 순서를 수동으로 맨 앞 10개로 옮긴다 — `register-game.js`는 항상 끝에 추가하므로 이 한 단계만 수동 보정 필요)
4. `index.html`의 `FALLBACK_GAMES` 배열에도 같은 폴더를 앞쪽에 추가
5. `node scripts/verify-game.js {folder}` + `node scripts/validate-catalog.js`로 검증
6. Phase 1(점수/랭킹) 작업이 먼저 완료되어 골든 템플릿에 `reportGameResult()` 연동이 이미 들어가 있다면, 이 10개도 복제 시점에 자동으로 포함된다 — 순서상 점수/랭킹 작업 이후에 이 작업을 하면 추가 작업이 없다. 점수/랭킹 작업 전에 이 작업을 먼저 한다면, 10개 게임에도 나중에 점수 리포팅을 별도로 추가해야 한다.

## 검증

- 10개 게임 각각 `node scripts/verify-game.js {folder}` 통과
- `node scripts/validate-catalog.js` → `Catalog OK: 70 games`
- 런처를 열어 새 10개 게임이 그리드 맨 앞에, 올바른 카테고리 필터에 노출되는지 확인
- 패턴별 1개씩(`timing-tap`, `balance-team`, `flood-fill` 등) 브라우저에서 실제 플레이해 결과 화면까지 도달하는지 확인 (`?autoplay=1`)

## 범위 밖

- 게임 데이터(문제/정답 세트 등) 구체적인 30개 이상 콘텐츠 목록 — 각 게임의 실제 구현 계획(`writing-plans`) 단계에서 채운다, 이 설계 문서의 책임이 아님
