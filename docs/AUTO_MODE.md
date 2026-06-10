# 자동 모드 실행 절차

매일 한국시간 오전 10시에 cron이 트리거할 때 Claude가 따라야 할 단계별 절차. **하루 목표는 게임 2개**. 한 실행에서 두 게임을 연속 제작·검증·푸시하되, 이전 실행에서 일부만 푸시되고 끊긴 경우에는 **부족분만 보강**한다 (오늘 이미 푸시된 게임은 다시 만들지 않음).

---

## Step 0. 사전 점검 (필수, 한 번만 실행)

```bash
# 0-1. 통합 사전 점검: 실패 차단 + 오늘 푸시 수 + 남은 게임 수
node scripts/auto-add-game-helpers.js preflight
```

응답 예시:
```json
{
  "blockedForToday": false,
  "todayPushedCount": 1,
  "todayPushed": [{ "hash":"...", "subject":"Auto-add: ... (coop, 패턴 C)" }],
  "pendingGames": 1,
  "alreadyComplete": false,
  "shouldRun": true,
  "action": "proceed: 1개 게임 제작 필요 (오늘 이미 1개 푸시)"
}
```

분기:
- `blockedForToday: true` → **즉시 종료** (오늘 누적 실패 3회 도달)
- `alreadyComplete: true` (= `pendingGames: 0`) → **즉시 종료** (오늘 이미 2개 푸시됨)
- 그 외 → `pendingGames` 만큼 제작 (1이면 1개, 2면 2개)

⚠️ **`pendingGames`는 작업 전체 루프의 종료 조건이다.** 게임 1개 끝났다고 자동으로 멈추면 안 된다. `pendingGames === 2`면 반드시 2개를 모두 푸시해야 종료한다.

```bash
# 0-2. 최신 코드 풀
git pull origin master
```

풀 실패 시 → 푸시 충돌 위험, 그날 작업 중단.

---

## Step 1. 분석

```bash
node scripts/auto-add-game-helpers.js stats
```

부족 카테고리 식별 — 출력은 `stats` 명령으로 매번 실시간 확인 (문서에 수치 박지 말 것, 금방 stale됨).

---

## Step 2. 자동 선택

`AI_ROUTINE.md`의 후보 풀에서 다음 우선순위로 선택:

1. **부족 카테고리 우선** (가장 적은 카테고리)
2. **메커니즘 다양성** (기존 게임과 가장 다른 데이터 형식/패턴)
3. **빠른 구현 가능성** (골든 템플릿 기반)
4. **교육 가치**

```bash
# 폴더명 중복 회피
node scripts/auto-add-game-helpers.js list-existing-folders
```

선택한 게임의 폴더명이 위 리스트에 있으면 → 다음 후보 선택.
모든 후보 소진 시 → **Step 2-A (후보 풀 재생성)** 으로 이동.

### N번째 게임의 선택 규칙
직전 게임(커밋·푸시 완료) 후 다음 게임을 시작할 때:
- `stats`를 **다시** 실행해 직전 게임이 추가된 후의 분포를 본다.
- **직전 게임 + 오늘 이미 푸시된 게임들과 다른 카테고리** 후보를 우선한다.
  - 0번째 단계(`preflight`)에서 받은 `todayPushed[].subject`에 적힌 카테고리 표기(`(coop, ...)` 등)를 회피 목록에 포함시켜라.
- 같은 카테고리에만 후보가 남아 있으면 같은 카테고리도 허용 (다양성보다 "그래도 한 개 더 추가"가 우선).

---

## Step 2-A. 풀 고갈 시 후보 풀 재생성 (40개)

`AI_ROUTINE.md` 후보 풀의 40개가 모두 구현되어 소진됐으면, **블랙박스로 게임 1개를 짜내지 않는다.** 대신 `AI_ROUTINE.md`의 "풀 재생성 규칙"에 따라 **새 40개를 발상해 후보 풀 섹션을 통째로 교체**한 뒤, 평소처럼 그 풀에서 골라 제작한다.

> ⚠️ **구 방식(1회용 블랙박스 자율 생성)은 폐지됨.** 이전에는 풀 고갈 시 그날 1개를 즉흥 발상하고 풀에 남기지 않았는데, 그 결과 ⓐ 사용자가 사전 검토 불가, ⓑ 삭제한 게임의 변형(이름만 바꾼 재생성)이 만들어지는 문제가 있었다. 이제는 **항상 검토 가능한 40개 풀을 거치고, 삭제 목록과 대조**해 재발을 막는다.

### 풀 재생성 가드레일 (반드시 모두 준수)

1. **대조 2종 필수** — ⓐ `registry.json`의 현재 전체 게임 + ⓑ `AI_ROUTINE.md`의 "🚫 사용자 삭제" 목록. **폴더명도 메커니즘도** 둘 중 하나라도 겹치면 후보에서 제외. (다른 이름이라도 같은 플레이 방식이면 제외)
2. **카테고리 균형** — 6개 카테고리에 고르게(각 6~7개), `stats`의 부족 카테고리에 가중
3. **골든 템플릿 4개 안에서만** — flag-quiz(A) / whack-a-mole(B) / nim-game·secret-code(C) / slide-puzzle(D)로 구현 가능한 것만
4. **디자인 일관성 고정** — Level 3 Comic 스타일(크림 배경 + 파스텔 4색 + 검정 3px 테두리 + 오프셋 하드 그림자) 절대 변경 금지
5. **풀에 영구 기록** — 재생성한 40개는 `AI_ROUTINE.md`에 커밋해 남긴다 (사용자가 사전 검토 가능해야 함)

### 절차

```
1. 부족 카테고리 식별 (stats)
2. 대조 대상 확보: registry.json 전체 게임 + "🚫 사용자 삭제" 목록
3. 둘 다와 폴더명·메커니즘이 안 겹치는 새 40개 발상
   (각: 한국어 이름 · 폴더명(영문 kebab-case) · 카테고리 · 패턴 A/B/C/D · 메커니즘 1줄)
4. AI_ROUTINE.md "게임 후보 풀" 섹션 통째로 교체 → 커밋
   git commit -m "docs: 후보 풀 재생성 (40개)"
5. Step 2로 돌아가 새 풀에서 그날 게임 선택·제작
   커밋 메시지에 한 줄 추가: "선택 근거: 풀 재생성 후 선택 — {부족 카테고리}"
```

### 재생성 시 추가 안전장치

- **삭제 목록 대조는 생략 불가** — 풀 재생성의 핵심 안전장치. 40개 발상 후 반드시 "🚫 사용자 삭제" 목록과 한 번 더 교차 점검하고 겹치는 항목을 버린다.
- **자가 게이트 통과 못하면 일반 폐기 절차와 동일** — `discard` → 풀의 다음 후보 → 3회 실패 시 그날 종료

---

## Step 3-5. 명세 + 데이터 + 제작

수동 모드와 동일한 프로세스 (`AI_ROUTINE.md` 4-5단계).
단, 사용자 승인 단계는 **건너뜀**.

데이터 자동 생성 시 다음 자가 검증:
- 데이터 30개 이상
- 각 항목에 q, a 필드 존재
- 정답 중복 없음

---

## Step 6. 자가 품질 게이트 (엄격, 6개 기준)

`AI_ROUTINE.md`의 6개 기준 모두 통과해야 함:

1. ☐ 데이터 30개 이상
2. ☐ 보기에 정답 중복 없음
3. ☐ 인트로 일러스트(SVG/이미지) 존재
4. ☐ shared/style.css 미수정 (git diff 확인)
5. ☐ 콘솔 에러 0개 (브라우저 검증)
6. ☐ 결과 화면 도달 성공 (10라운드 자동 플레이)

```bash
# 정적 검증
node scripts/verify-game.js {folder}

# shared 미수정 확인 (shared/engine.js의 _GAME_CATEGORY_MAP 추가는 허용)
git diff --name-only | grep -q "^shared/style.css" && echo "VIOLATION: shared/style.css 수정됨" || echo "OK"
```

브라우저 검증은 Preview MCP로 자동 플레이 시뮬레이션.

### ⚡ 자동 플레이 가속 (필수)

**검증 URL은 반드시 `?autoplay=1` 쿼리를 붙여서 진입**:
```
http://localhost:8765/games/{folder}/?autoplay=1
```

`shared/engine.js`의 `getAutoplayPauseMs(defaultMs)` 헬퍼가 URL에 `?autoplay=1`이 있으면 라운드 사이 대기를 **50ms**로 단축한다 (평소 2000~2200ms). 10라운드 시뮬이 ~25초 → ~6초로 줄어서 `preview_eval`의 30초 타임아웃에 걸리지 않는다.

**신규 게임 작성 시 반드시 사용**:
```js
const RESULT_PAUSE_MS = getAutoplayPauseMs(2000);
// (또는 패턴 D는 2200)
```
상수 대신 헬퍼 호출로 작성. 사용자가 그냥 게임을 켰을 때는 `?autoplay=1`이 없어서 기존 2000ms 대기 그대로 작동한다.

**1개라도 실패** → Step 7-FAIL로 이동.

---

## Step 7-OK. 통과 시: 커밋 + 푸시

```bash
git add games/{folder}/ games/registry.json index.html shared/engine.js
git commit -m "Auto-add: {게임 이름} ({카테고리}, 패턴 {A|B|C})

선택 근거: {부족 카테고리 / 메커니즘 다양성}
데이터: {n}개
검증: 정적 20/20, 브라우저 정상, 자가 게이트 6/6
실행: 자동 (KST {timestamp})

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"

git push origin master
```

푸시 실패 시 → 로컬 커밋 유지하고 **다음 게임 시도 계속**. 첫 게임 푸시 실패해도 두 번째 게임은 그대로 시도 (둘 다 별도 커밋이라 게임 1 커밋이 살아 있고 다음날 push 재시도 됨).

**게임 1이 통과·푸시되면 → Step 1로 돌아가 게임 2 제작 시작** (`stats` 재실행, 카테고리 다양성 우선).

---

## 캐시 버전 범프 규칙 (sw.js CACHE_NAME)

게임 파일(`games/*`)과 공용 파일(`shared/*`)은 Service Worker가 **캐시 우선**으로 서빙한다. 따라서 **이미 배포된 파일을 수정하는 커밋은 `sw.js`의 `CACHE_NAME` 버전을 +1 하지 않으면 기존 방문자에게 영원히 반영되지 않는다.** (런처 index.html과 games/registry.json은 network-first라 해당 없음)

| 커밋 내용 | CACHE_NAME 범프 |
|---|---|
| **신규 게임 추가만** (Auto-add) | ❌ 불필요 — 런처·registry는 network-first고, 새 게임 파일은 아직 어떤 캐시에도 없어 네트워크로 받음 |
| **기존 게임 수정** (데이터 확장, 버그 수정, 스타일 변경 등 `games/*` 기존 파일) | ✅ 필수 |
| **`shared/engine.js`·`shared/style.css` 수정** | ✅ 필수 |

범프 방법: `sw.js` 상단의 `CACHE_NAME` 숫자를 +1 (`'jjamjjami-gyosil-v15'` → `-v16`) 하고 **같은 커밋에 포함**.

허용되는 한계 1가지: Auto-add가 `shared/engine.js`의 `_GAME_CATEGORY_MAP`에 추가하는 한 줄은 범프 없이 둬도 된다 — 새 게임의 **BGM 분위기만** 다음 범프 전까지 기본값(brain풍)으로 재생되며 게임 동작에는 영향 없다.

---

## Step 7-OK-FINAL. 종료 전 자가 점검 (필수)

게임을 푸시할 때마다, 그리고 "더 이상 할 일이 없다"고 판단하기 직전에 반드시 다음을 실행:

```bash
node scripts/auto-add-game-helpers.js today-pushed-count
```

응답:
```json
{ "dailyTarget": 2, "todayPushedCount": N, "pendingGames": (2 - N), "alreadyComplete": (N >= 2) }
```

- `pendingGames > 0` 이고 `recent-failures.blockedForToday`가 아니라면 → **종료 금지, Step 1로 돌아가 다음 게임 제작 계속**
- `pendingGames === 0` 이거나 `blockedForToday` 이면 → 그날 작업 종료

⚠️ **이 단계 생략은 가장 흔한 버그였다.** 게임 1 푸시 직후 "Auto-add: ... 완료!" 메시지로 끝내면 안 된다. 반드시 `today-pushed-count`로 재확인.

---

## Step 7-FAIL. 실패 시: 폐기

```bash
# 게임 완전 폐기 (폴더 삭제 + registry/launcher 등록 해제 + 실패 카운트 +1)
node scripts/auto-add-game-helpers.js discard {folder}

# 오늘 실패 횟수 재확인
node scripts/auto-add-game-helpers.js recent-failures
```

`blockedForToday: true` (게임 1·2 합산 누적 3회 도달) → 그날 작업 중단.
아니면 → Step 2로 돌아가 같은 자리(게임 1 또는 게임 2) 다음 후보 시도.

게임 2가 누적 실패 3회로 막혀도 게임 1은 그대로 유지된다.

---

## Step 8. 종료

자동 모드는 **별도 보고 메시지를 남기지 않음**. 결과는 git commit 메시지로만 확인.

성공: `git log -1 --oneline` 에 `Auto-add: ...` 표시.
실패+폐기: 커밋 없음. 로그는 `.claude/auto-failures.json`에 누적.

---

## 수동 정지

자동 모드를 끄고 싶으면:
```bash
# CronList로 작업 ID 확인 후 CronDelete
```

또는 사용자가 "자동 게임 추가 중지" 라고 말하면 Claude가 cron 작업 삭제.

---

## 디버그용 명령

```bash
# 실패 로그 초기화
node scripts/auto-add-game-helpers.js reset-failures

# 현재 통계
node scripts/auto-add-game-helpers.js stats

# 등록된 폴더 목록
node scripts/auto-add-game-helpers.js list-existing-folders
```
