# TouchGame 고도화 로드맵 — Design Spec

## Overview

`codersongpro/touchgame` (구 `shway81-droid/jjamjjami-gyosil`, MIT 라이선스 포크)를 3단계로 고도화한다:

1. **점수/랭킹 시스템** (이번 스펙에서 상세 설계)
2. **UI/UX 개선** (개요만, 별도 세션에서 상세 설계)
3. **새 미니게임 추가** (개요만, 기존 자동화 도구를 그대로 활용)

세 영역은 서로 독립적인 하위 프로젝트라 각자 별도의 spec → plan →구현 사이클을 가진다. 이 문서는 로드맵 전체의 뼈대를 잡고, 가장 구조적 영향이 큰 1단계만 지금 구현 가능한 수준까지 설계한다.

## 현재 상태 (검증된 사실)

- **정적 사이트**: Vanilla HTML/CSS/JS, 빌드 도구 없음. 60개 게임, `games/registry.json`에 폴더명 배열로 등록.
- **점수 영속성 없음**: `shared/engine.js`의 `createScoreboard(element)`는 DOM 표시용일 뿐 저장하지 않음. `sessionStorage`는 사운드/BGM on-off 토글에만 쓰임. `localStorage`는 저장소 전체에서 사용된 적이 없음.
- **게임 ↔ 런처 통신 없음**: 런처(`index.html`)는 `<a href="games/{folder}/index.html">`로 페이지 이동만 함 (iframe/postMessage 아님). 게임은 `goHome()`으로 `../../index.html`로 돌아갈 뿐, 결과를 런처에 보고하지 않음.
- **게임 메타데이터가 최근 분산화됨** (리브랜딩 커밋 `ee91fc8`로 변경): 각 `games/{folder}/game.json`에 `category`, `players`, `pattern`, `tags` 필드가 직접 들어가도록 바뀌었고, 런처의 `index.html`은 `game.category || CATEGORY_MAP[game.folder]` 식으로 game.json을 우선하고 옛 하드코딩 맵(`CATEGORY_MAP`, `GAME_ICONS`, `PLAYER_COUNTS`, `FALLBACK_GAMES`, index.html 747~1104행)은 폴백으로만 남아 있음.
- **검증 스크립트 2종 공존**: `scripts/verify-game.js` (게임 폴더 1개당 18개 정적 체크, 일일 자동 추가 파이프라인 `docs/AUTO_MODE.md`/`docs/AI_ROUTINE.md`가 이걸 사용) + `scripts/validate-catalog.js` (`npm run verify`, 카탈로그 전체 무결성 빠른 체크, 리브랜딩 때 신규 추가) + `scripts/register-game.js` (신규 게임 등록 시 메타데이터 정규화 + registry.json 추가).
- **서비스워커**: `sw.js`의 `CACHE_NAME = 'touchgame-v16'`. `/games/*`, `/shared/*`는 cache-first → 이미 배포된 파일을 수정하면 버전을 +1 해야 기존 방문자에게 반영됨. 런처/`registry.json`은 network-first.
- **디자인 토큰** (`shared/style.css` 루트): 흰 배경(`--bg:#FFFFFF`), 부드러운 카드 그림자(`0 2px 8px rgba(0,0,0,0.12)`), 8px 라운드. 리브랜딩으로 폰트 스택에 도트/레트로 폰트(`DungGeunMo`, `Galmuri11`, `NeoDunggeunmo`, `DNFBitBitv2`)가 1순위로 추가되고 PWA 스플래시 색(`manifest.json`)이 네이비(`#101827`)로 바뀜 — 다만 게임 내부 배경/카드 톤 자체는 아직 라이트 테마 유지. 즉 "레트로 아케이드"는 지금은 폰트·런처 헤더·아이콘 수준의 톤 변화이고, 게임 화면 전체를 다크로 바꾸는 작업은 아직 안 됨.
- **배포**: 기존 GitHub Pages 가정에서 Vercel도 같이 지원하도록 `vercel.json`/`package.json`이 추가됨 (별도로 진행 중인 GitHub Pages 활성화 이슈와는 무관).

## 로드맵 개요

| 단계 | 내용 | 영향 범위 | 상태 |
|------|------|-----------|------|
| 1 | 점수/랭킹 시스템 | 전체 60개 게임 + 런처 + sw.js (구조적, 가장 먼저) | 이번 spec에서 상세 설계 |
| 2 | UI/UX 개선 | `shared/style.css`, 런처 레이아웃, 게임 공통 컴포넌트 | 개요만 (다음 세션에서 브레인스토밍) |
| 3 | 새 미니게임 추가 | `games/{folder}` 신규 폴더 (기존 도구 재사용) | 개요만 (필요할 때 바로 착수 가능) |

---

## Phase 1: 점수/랭킹 시스템 (상세 설계)

### 핵심 결정

새 공유 모듈 `shared/score-store.js` 하나를 만들고, 각 게임이 결과 화면을 그리는 기존 코드(`showResult()` 류) 안에서 **딱 한 줄**, `reportGameResult(payload)`를 호출하게 한다. 영속화는 `localStorage`, 기기(브라우저) 단위 + 게임별 상위 10개 기록. 신기록일 때만 3글자 이니셜을 입력받는 아케이드 하이스코어 방식. 1차 노출 화면은 각 게임의 결과 화면("이 기기 최고 기록" 배지), 2차로 런처 헤더에 "전체 랭킹" 패널을 같은 커밋에서 추가한다.

**기각한 대안**: DOM을 관찰해서 점수를 자동으로 긁어오는 방식(MutationObserver로 `.score-chip` 텍스트 스크래핑) — 패턴 C 게임(`nim-game`, `secret-code`)은 숫자 점수가 아니라 승/패 이진값이라 일반화가 깨지고, 실패해도 조용히 틀린 값을 기록해버려 디버깅이 어려움. 명시적 호출 1줄이 게임당 작업량은 같지만 실패가 보이고 패턴별 의미를 그대로 표현할 수 있어 더 안전함.

### `shared/score-store.js` 함수 시그니처

```js
/**
 * 게임 결과 1회를 기기 로컬에 기록. 각 게임의 결과 화면 렌더링 시점에 1번 호출.
 * @param {Object} payload
 * @param {string} payload.gameId      - games/ 폴더명 (예: 'flag-quiz')
 * @param {number} payload.playerCount - 2~4
 * @param {number[]} payload.scores    - 플레이어별 최종 점수/결과
 * @param {'score'|'time'|'win'} [payload.metric='score']
 *   - 'score': 높을수록 좋음 (패턴 A/B)
 *   - 'time' : 낮을수록 좋음, ms/초 (패턴 D)
 *   - 'win'  : 이진 승패 (패턴 C, scores: [1,0] 형태)
 * @returns {{ isNewBest: boolean, bestEntry: object|null, rank: number|null }}
 */
function reportGameResult(payload) {}

/** 게임 1개의 기기 로컬 베스트 기록 (점수 좋은 순). */
function getLeaderboard(gameId, limit = 5) {}

/** 런처 "전체 랭킹" 패널용 — 게임별 최고기록/플레이수/마지막 플레이 시각. */
function getAllGameSummaries() {}

/** 신기록(isNewBest===true)일 때만 띄우는 3글자 이니셜 입력 — 기기에 마지막 입력값 기억. */
function createInitialsPrompt(onSubmit) {}
```

`reportGameResult`만 필수. 나머지는 결과 화면을 더 풍부하게 만들고 싶을 때 선택적으로 쓴다.

### 게임 쪽 연동 지점 (예: `games/flag-quiz/game.js`)

`showResult()` 안, `scores`/`winners`를 다 계산한 직후에 한 줄 추가:

```js
reportGameResult({ gameId: 'flag-quiz', playerCount, scores, metric: 'score' });
```

패턴 A/B는 이 형태 그대로, 패턴 D는 `metric: 'time'`, 패턴 C는 `metric: 'win'` + `scores: [1,0]`형.

### 저장 스키마 (localStorage)

5~10MB 한도에 비해 60게임 × 상위 10개 기록은 100KB 미만이라 IndexedDB는 불필요. 단일 루트 키로 원자적 read-modify-write.

```json
{
  "version": 1,
  "deviceLastInitials": "지민",
  "games": {
    "flag-quiz": {
      "metric": "score",
      "totalPlays": 14,
      "entries": [
        { "initials": "지민", "score": 9, "playerCount": 3, "ts": 1750800000000 }
      ]
    }
  }
}
```

- `entries`는 게임당 상위 10개만 유지 (무한 누적 방지).
- `initials`만 저장 (실명 아님 — 공용 기기, PII 우려 없음, 아케이드 하이스코어 정서에도 맞음).
- `version` 최상위 1개만 (게임별 버전 분산 방지, 추후 마이그레이션 단순화).
- 기기 간 동기화 불가능함은 의도된 트레이드오프 (교실 공유 기기, 로그인 없음이 전제 조건이라 애초에 기기 단위가 맞음). 브라우저 데이터 초기화 시 소실되는 것도 현재(매판 소실)보다는 개선.

### 노출 화면

- **1차(필수)**: 각 게임 결과 화면에 "이 기기 최고 기록" 배지 — 기존 승자 배너 옆에 추가. 모든 게임이 이미 가진 화면이라 새 라우팅 없이 일관되게 적용 가능, 방금 끝낸 직후라 동기부여 효과 최대.
- **2차(같은 커밋에 포함)**: 런처 헤더에 "전체 랭킹" 버튼 → 모달/드로어로 `getAllGameSummaries()` 렌더. 새 HTML 파일이나 라우트 불필요, `shared/style.css`의 기존 카드/필 스타일 재사용.
- **나중**: 전체화면 통계 페이지(교실 프로젝터용), 라운드 중 실시간 리더보드 — 지금은 범위 밖.

### 신기록 입력 흐름

신기록(`isNewBest === true`)일 때만 3글자 이니셜 입력을 띄움. 매 게임 시작/종료마다 입력받지 않음 — 대부분의 플레이는 신기록이 아니므로 마찰 없음. 기기에 마지막 입력값을 기억해 같은 아이가 연속 신기록을 내도 재입력 부담이 적음.

### 서비스워커 캐시 버전

- 신규 파일 `shared/score-store.js`를 `sw.js`의 pre-cache 목록에 추가.
- 이 작업은 **60개 게임의 기존 `index.html`/`game.js`를 전부 수정**하므로(`<script src="../../shared/score-store.js">` 추가 + `reportGameResult()` 호출), 기존 배포 파일 수정 규칙에 따라 `CACHE_NAME`을 `touchgame-v16` → `v17`로 범프해야 함.

### `scripts/verify-game.js`에 체크 추가

일일 자동화(`docs/AUTO_MODE.md`)가 이 스크립트로 게이트를 거니, 여기에 19번째 체크를 추가:

```js
check('19. 점수 리포팅: score-store 연동', () => {
  const html = fs.readFileSync(path.join(gameDir, 'index.html'), 'utf-8');
  const js = fs.readFileSync(path.join(gameDir, 'game.js'), 'utf-8');
  if (!html.includes('shared/score-store.js')) return 'index.html에 shared/score-store.js 링크 없음';
  if (!/reportGameResult\s*\(/.test(js)) return 'game.js에 reportGameResult() 호출 없음';
  return true;
});
```

### 게임당 수정량 (정량화)

게임당 2개 파일, 각 1줄:
1. `index.html`: `<script src="../../shared/score-store.js"></script>` 1줄 (engine.js 스크립트 태그 옆).
2. `game.js`: 결과 렌더 함수 안에 `reportGameResult({...})` 1줄.

60게임 모두 4개의 골든 템플릿(`flag-quiz`=A, B/C/D 대응 게임)에서 복제된 구조라 변수명(`scores`, `playerCount`)이 패턴별로 일관됨 → 작은 코드모드 스크립트(`scripts/add-score-reporting.js`, 1회성 마이그레이션 도구)로 대부분 자동 처리하고, 패턴별 1~2개 표본을 손으로 검증. 총 풋프린트: 약 120줄 삽입(파일 120개 터치), 기존 로직 수정 없이 순수 추가뿐.

### 일일 자동화(`docs/AUTO_MODE.md`)에 대한 리스크와 대응

**리스크**: 골든 템플릿(자동 추가가 매일 복제하는 원본) 4개에 score-store 연동을 안 넣은 채 `verify-game.js`에 19번째 체크만 추가하면, 다음날부터 자동 추가되는 모든 신규 게임이 그 체크에서 즉시 실패 → 하루 3회 실패 한도를 조용히 소진.

**대응**: 코드모드 적용 대상에 골든 템플릿 4개도 포함시켜(이미 `registry.json`에 등록된 게임이라 자동 포함됨) 같은 커밋에서 함께 고침. `docs/AUTO_MODE.md`의 "정적 18/18" 같은 하드코딩된 체크 개수 문구도 "19/19"로 같은 커밋에서 갱신.

### 구현 순서

1. `shared/score-store.js` 작성 (의존성 없음, 브라우저 콘솔에서 단독 테스트 가능)
2. `sw.js`에 새 파일 pre-cache 추가 + `CACHE_NAME` v16→v17 범프
3. 코드모드 스크립트 작성 + 4개 골든 템플릿에 먼저 적용해 검증
4. `registry.json`의 60개 게임 전체에 코드모드 적용, 패턴별 샘플 수동 확인
5. `verify-game.js`에 19번째 체크 추가, 60개 폴더 전체 재검증
6. 각 게임 결과 화면에 "이 기기 최고 기록" 배지 UI 추가 (4단계와 같은 파일이라 같은 패스에서 처리)
7. 런처에 "전체 랭킹" 패널 추가 (`index.html`)
8. `docs/AUTO_MODE.md`, `docs/AI_ROUTINE.md`, 골든 템플릿 문서를 갱신해 앞으로 추가되는 게임은 처음부터 연동되게 함
9. 전체 `verify-game.js` 스윕 + 패턴별 1개씩 브라우저 수동 스모크 테스트 후 커밋

---

## Phase 2: UI/UX 개선 (개요)

리브랜딩 커밋이 이미 폰트(도트/레트로 계열)와 런처 헤더·파비콘·OG 이미지를 바꾸기 시작했지만, 게임 화면 내부 색 토큰(`shared/style.css` 루트)은 아직 기존 라이트 테마 그대로다. Phase 2는 이 "레트로 아케이드" 방향을 게임 화면까지 일관되게 확장할지(예: 카드 보더/그림자를 더 아케이드답게, 다크 테마 옵션 추가), 아니면 지금처럼 폰트·런처 톤만 바꾸고 게임 내부는 친근한 라이트 테마로 유지할지부터 정해야 한다. 이건 시각적 판단이 많이 들어가므로 별도 브레인스토밍 세션에서 목업을 보며 결정하는 게 맞다.

## Phase 3: 새 미니게임 추가 (개요)

이미 `scripts/register-game.js` + `scripts/validate-catalog.js` + `scripts/verify-game.js` + 4개 골든 템플릿 + 일일 자동 추가 파이프라인까지 다 갖춰져 있어, 신규 게임 추가는 설계가 필요한 일이 아니라 기존 절차(`docs/ADDING_GAMES.md`)를 그대로 실행하는 일이다. Phase 1이 끝나면 신규 게임도 score-store 연동이 처음부터 포함된 채로 추가된다(Phase 1 구현 순서 8단계). 별도 설계 없이 필요할 때 카테고리/패턴 공백을 보고 바로 착수 가능.

## 다음 단계

이 spec을 검토 후 승인하면 Phase 1을 `writing-plans` 스킬로 턴 단위 구현 계획으로 옮긴다.
