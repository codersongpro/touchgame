# 자동 모드 실행 절차

매일 한국시간 오전 10시에 cron이 트리거할 때 Claude가 따라야 할 단계별 절차.

---

## Step 0. 사전 점검 (필수)

```bash
# 0-1. 현재 디렉토리: C:/Users/User/Desktop/claude
# 0-2. 오늘 실패 횟수 체크 (3개 이상이면 즉시 중단)
node scripts/auto-add-game-helpers.js recent-failures
```

`blockedForToday: true` 이면 → **즉시 종료**, 로그에 "차단됨" 기록만 남김.

```bash
# 0-3. 최신 코드 풀
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
모든 후보 소진 시 → **Step 2-A (자율 생성)** 으로 이동.

---

## Step 2-A. 풀 고갈 시 자율 생성 (방식 1: 완전 자율)

`AI_ROUTINE.md` 후보 풀의 **모든 항목이 소진**됐으면 (이미 구현됨 + 사용자 삭제 보류 포함), Claude가 직접 후보를 발상해 그날 게임 1개를 추가한다. 사용자 개입 없음.

### 자율 생성 가드레일 (반드시 모두 준수)

1. **부족 카테고리 우선** — `stats` 결과에서 가장 적은 카테고리(또는 동률)에서 발상
2. **골든 템플릿 4개 안에서만** — flag-quiz(A) / whack-a-mole(B) / nim-game·secret-code(C) / slide-puzzle(D)
3. **기존 게임 메커니즘 비교 후 중복 회피** — `registry.json`에 등록된 모든 게임의 데이터 형식·인터랙션을 비교해 겹치는 후보 제거
4. **디자인 일관성 고정** — Level 3 Comic 스타일(크림 배경 + 파스텔 4색 + 검정 3px 테두리 + 오프셋 하드 그림자) 절대 변경 금지
5. **풀에 영구 저장 안 함** — 자율 생성 후보는 그날 1회용. 풀(`AI_ROUTINE.md`)에는 추가하지 않음. 매번 그날 상황 보고 새로 발상해 다양성 유지.

### 절차

```
1. 부족 카테고리 식별 (stats)
2. 후보 5개 자율 발상
   (각: 한국어 이름 · 폴더명(영문 kebab-case) · 카테고리 · 패턴 A/B/C/D · 메커니즘 1줄 · 골든 템플릿 1개)
3. 부족 카테고리 + 메커니즘 다양성 기준으로 1개 선정
4. Step 3 이후 절차 그대로 진행 (자가 게이트 6개 · 정적·브라우저 검증 동일)
5. 커밋 메시지에 다음 한 줄 추가:
   "선택 근거: 자율 생성 (풀 고갈) — {부족 카테고리} 우선, {메커니즘 차별점}"
```

### 자율 생성 시 추가 안전장치

- **자가 게이트 통과 못하면 일반 폐기 절차와 동일** — `discard` → 다음 후보(자율 생성한 5개 중 차순위) → 3회 실패 시 그날 종료
- **사용자가 다음날 삭제하면** → 풀이 영구 저장 안 되니 자동 재시도 위험 없음 (디자인상 자율 생성은 매번 새로 발상)

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

# shared 미수정 확인
git diff --name-only | grep -q "^shared/" && echo "VIOLATION: shared 수정됨" || echo "OK"
```

브라우저 검증은 Preview MCP로 자동 플레이 시뮬레이션.

**1개라도 실패** → Step 7-FAIL로 이동.

---

## Step 7-OK. 통과 시: 커밋 + 푸시

```bash
git add games/{folder}/ games/registry.json index.html
git commit -m "Auto-add: {게임 이름} ({카테고리}, 패턴 {A|B|C})

선택 근거: {부족 카테고리 / 메커니즘 다양성}
데이터: {n}개
검증: 정적 17/17, 브라우저 정상, 자가 게이트 6/6
실행: 자동 (KST {timestamp})

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"

git push origin master
```

푸시 실패 시 → 로컬 커밋 유지하고 종료. 다음날 10시 재시도.

---

## Step 7-FAIL. 실패 시: 폐기

```bash
# 게임 완전 폐기 (폴더 삭제 + registry/launcher 등록 해제 + 실패 카운트 +1)
node scripts/auto-add-game-helpers.js discard {folder}

# 오늘 실패 횟수 재확인
node scripts/auto-add-game-helpers.js recent-failures
```

`blockedForToday: true` (3회 도달) → 그날 작업 중단.
아니면 → Step 2로 돌아가 다음 후보 시도.

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
