# 짬짬이 교실

자투리 시간에 즐기는 초등 교실 미니게임 모음 (48개)

## 개요

- **라이브 URL**: https://shway81-droid.github.io/jjamjjami-gyosil/
- 학교 크롬북/태블릿에서 바로 플레이 가능
- 오프라인 동작 (PWA + Service Worker)
- 무료 (GitHub Pages 호스팅)

## 특징

- 48개 게임, 6개 카테고리 (반응속도, 두뇌, 수학, 지식, 협력, 퍼즐)
- 2~4인 동시 대결 (일부 게임은 2인 전용)
- 30초~3분 짧은 플레이 시간
- 한국어 UI, Level 3 Comic 디자인 시스템
- 효과음 + 배경음악 토글 (기본 음소거)
- 카운트다운 시작
- SVG 아이콘
- 터치스크린 풀스크린 최적화 (태블릿/크롬북/터치모니터)
- 학생 손이 닿는 zone 하단에 인터랙션 영역 배치

## 게임 목록

| 카테고리 | 게임들 |
|---------|--------|
| ⚡ 반응속도 (4) | 두더지 잡기, 신호 반응, 풍선 터트리기, 폭탄 피하기 |
| 🧠 두뇌 (8) | 색깔 터치, 모양 맞히기, 그림자 맞히기, 빠진 조각, 거울 대칭, 도트 앤 박스, 카드 뒤집기, 돌 가져가기 |
| 📐 수학 (6) | 빠른 계산, 크기 비교, 색 세기, 많다 적다, 숫자 순서대로, 시계 읽기 |
| 📚 지식 (6) | OX 퀴즈, 초성 퀴즈, 수도 맞히기, 국기 맞히기, 속담 완성, 영어 단어 |
| 🤝 협력 (3) | 비밀 암호, 거울 그리기, 색깔 신호 |
| 🧩 퍼즐 (6) | 슬라이딩 퍼즐, 미로 찾기, 파이프 잇기, 빛 반사 퍼즐, 한붓그리기, 점 잇기 |

## 패턴

각 게임은 4가지 플레이 패턴 중 하나를 따름:

- **패턴 A**: 동시 반응형 (모두 같은 문제, 먼저 정답 터치) — flag-quiz 등
- **패턴 B**: 개별 영역형 (각자 자기 zone에서 점수 누적) — whack-a-mole 등
- **패턴 C**: 턴제/협력형 (한 명씩 번갈아 또는 역할 분담) — nim-game, secret-code 등
- **패턴 D**: 퍼즐 병렬 경쟁 (같은 퍼즐 동시 풀이, 먼저 완성하는 사람 승리) — slide-puzzle 등

자세한 내용은 [docs/PATTERNS.md](docs/PATTERNS.md) 참고.

## 기술 스택

- Vanilla HTML/CSS/JavaScript (프레임워크 없음)
- 빌드 도구 없음 (정적 사이트)
- Web Audio API (효과음 + BGM 생성)
- Service Worker (오프라인 + 캐시 전략 A — 디렉토리 파일 network-first)
- 인라인 SVG 그래픽
- GitHub Pages 무료 배포

## 자동화

- **AI 자동 게임 생성**: 매일 오전 10시 KST 자동 추가 ([docs/AUTO_MODE.md](docs/AUTO_MODE.md))
- 자가 품질 게이트 6개 (데이터 수, 디자인 일관성, 콘솔 에러 등)
- 정적 검증 스크립트 (`scripts/verify-game.js`) 18개 항목

## 배포

- GitHub repository: `shway81-droid/jjamjjami-gyosil`
- GitHub Pages 자동 배포 (master branch)
- 무료, 월 0원

## 로컬 개발

```bash
git clone https://github.com/shway81-droid/jjamjjami-gyosil.git
cd jjamjjami-gyosil
# 정적 사이트
python -m http.server 8000
# 또는
.claude/serve.ps1   # PowerShell
```

## 프로젝트 구조

```
jjamjjami-gyosil/
├── index.html              # 런처 (게임 카드 그리드, CATEGORY_MAP, FALLBACK_GAMES)
├── manifest.json           # PWA 매니페스트
├── sw.js                   # Service Worker (캐시 전략 A)
├── og-image.svg            # 소셜 공유 이미지
├── shared/
│   ├── engine.js           # 공통 엔진 (타이머, 사운드, BGM, 카테고리 매핑)
│   └── style.css           # 공통 디자인 시스템 (Level 3 Comic)
├── games/
│   ├── registry.json       # 게임 목록 (48개)
│   └── <game-name>/
│       ├── index.html      # 게임 페이지
│       ├── style.css       # 게임 전용 스타일
│       ├── game.js         # 게임 로직
│       └── game.json       # 메타데이터
├── scripts/
│   ├── verify-game.js      # 정적 검증 (18개 항목)
│   └── auto-add-game-helpers.js  # 자동 모드 헬퍼
└── docs/
    ├── PATTERNS.md         # 4가지 게임 패턴 카탈로그
    ├── AI_ROUTINE.md       # Claude AI 게임 생성 절차
    ├── AUTO_MODE.md        # 매일 10시 자동 모드 절차
    └── GAME_SPEC.md        # 신규 게임 명세 양식
```

## 새 게임 추가하기

1. `games/새게임명/` 폴더 생성
2. `game.json` 작성 (`name`, `icon`, `color`, `grades`, `playTime`)
3. 골든 템플릿 복사 (패턴 A=flag-quiz, B=whack-a-mole, C=nim-game, D=slide-puzzle)
4. `index.html`, `style.css`, `game.js` 게임별 수정
5. `games/registry.json`에 폴더명 추가
6. `index.html` 런처의 `CATEGORY_MAP`, `GAME_ICONS`, `FALLBACK_GAMES`, `PLAYER_COUNTS`에 추가
7. `shared/engine.js`의 `_GAME_CATEGORY_MAP`에도 추가 (BGM 분류용)
8. `node scripts/verify-game.js {folder}`로 정적 검증

자세한 절차는 [docs/AI_ROUTINE.md](docs/AI_ROUTINE.md) 참고.

## 디자인 시스템 (Level 3 Comic)

모든 게임은 다음 규칙 강제:
- **배경**: 크림 #FFF8E1 또는 흰색 (다크 배경 금지)
- **zone**: 파스텔 4색 (#B3E5FC, #FFCDD2, #C8E6C9, #FFE0B2)
- **테두리**: 검정 #2C2C2C, 두께 3px
- **그림자**: 오프셋 하드 그림자 (예: `box-shadow: 6px 6px 0 #2C2C2C`)
- **포인트 색**: 노랑 #FFD54F, 보라 #7C4DFF, 초록 #4CAF50
- **폰트**: Pretendard Variable, weight 800-900
- **인터랙션 영역**: zone 하단에 배치 (학생 손 접근성)

## 라이선스

MIT (자유롭게 사용 가능) — [LICENSE](LICENSE) 참고

## 크레딧

초등학교 교사가 수업 자투리 시간을 위해 제작.
