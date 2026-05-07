# 짬짬이 교실

자투리 시간에 즐기는 초등 교실 미니게임 모음 (25개)

## 개요

- **라이브 URL**: https://shway81-droid.github.io/jjamjjami-gyosil/
- 학교 크롬북/태블릿에서 바로 플레이 가능
- 오프라인 동작 (`file://` 프로토콜 지원)
- 무료 (GitHub Pages 호스팅)

## 특징

- 25개 게임, 5개 카테고리 (반응속도, 두뇌, 수학, 지식, 협력)
- 2~4인 동시 대결 (협력 게임은 2인 전용)
- 30초~3분 짧은 플레이 시간
- 한국어 UI
- 사운드 토글 (기본 음소거)
- 카운트다운 시작
- SVG 아이콘 (이모지 의존 없음)
- 터치스크린 풀스크린 최적화 (태블릿/크롬북/터치모니터)

## 게임 목록

| 카테고리 | 게임들 |
|---------|--------|
| ⚡ 반응속도 | 두더지 잡기, 신호 반응, 풍선 터트리기, 폭탄 피하기 |
| 🧠 두뇌 | 색깔 터치, 모양 맞히기, 그림자 맞히기, 빠진 조각, 거울 대칭, 도트 앤 박스, 카드 뒤집기, 돌 가져가기 |
| 📐 수학 | 빠른 계산, 크기 비교, 색 세기, 많다 적다, 숫자 순서대로, 시계 읽기 |
| 📚 지식 | OX 퀴즈 (300문제), 초성 퀴즈, 수도 맞히기 (33개국), 국기 맞히기 (30개국), 속담 완성 (30개) |
| 🤝 협력 (2인) | 비밀 암호, 거울 그리기 |

## 기술 스택

- Vanilla HTML/CSS/JavaScript (프레임워크 없음)
- 빌드 도구 없음 (정적 사이트)
- Web Audio API (효과음)
- 인라인 SVG 그래픽
- GitHub Pages 무료 배포

## 배포

- GitHub repository: `shway81-droid/jjamjjami-gyosil`
- GitHub Pages 자동 배포 (master branch)
- 무료, 월 0원

## 로컬 개발

```bash
git clone https://github.com/shway81-droid/jjamjjami-gyosil.git
cd jjamjjami-gyosil
# 정적 사이트라 index.html을 브라우저에서 직접 열어도 됨
# 또는 로컬 서버 실행
python -m http.server 8000
```

## 프로젝트 구조

```
jjamjjami-gyosil/
├── index.html              # 런처 (게임 카드 그리드)
├── shared/
│   ├── engine.js           # 공통 엔진 (타이머, 사운드, 점수)
│   └── style.css           # 공통 디자인 시스템
├── games/
│   ├── registry.json       # 게임 목록
│   └── <game-name>/
│       ├── index.html      # 게임 페이지
│       ├── style.css       # 게임 전용 스타일
│       ├── game.js         # 게임 로직
│       └── game.json       # 메타데이터
└── docs/                   # 설계 문서, 계획서
```

## 새 게임 추가하기

1. `games/새게임명/` 폴더 생성
2. `game.json` 작성 (`name`, `icon`, `color`, `grades`, `playTime`)
3. `index.html`, `style.css`, `game.js` 작성
4. `games/registry.json`에 폴더명 추가
5. `index.html`의 `GAME_ICONS`와 `CATEGORY_MAP`에 추가

## 라이선스

MIT (자유롭게 사용 가능) — [LICENSE](LICENSE) 참고

## 크레딧

초등학교 교사가 수업 자투리 시간을 위해 제작.
