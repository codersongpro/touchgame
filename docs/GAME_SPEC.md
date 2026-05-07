# 게임 명세서 표준 양식

새 게임을 정의할 때 채워야 할 필수 필드. 추천/제작 단계에서 이 양식을 따라 게임을 정의한다.

---

## 명세서 양식 (YAML)

```yaml
# 기본 정보
folder: english-word           # 영문 폴더명 (kebab-case)
name: 영어 단어                  # 한글 표시명
description: 영어 단어를 보고 뜻을 맞혀보세요!  # 1줄 설명
icon: 🔤                       # 이모지 (런처 카드용)
color: "#4CAF50"               # 카드 배경 헥스 코드

# 분류
pattern: A                     # A | B | C
category: knowledge            # speed | brain | math | knowledge | coop

# 학년/시간
grades: [1,2,3,4,5,6]          # 지원 학년
playTime: "1분"                 # 예상 플레이 시간

# 메커니즘 (패턴별로 다름)
mechanism:
  rounds: 10                   # 패턴 A: 라운드 수
  time_per_question: 8         # 패턴 A: 문제당 제한 시간(초)
  duration: 30                 # 패턴 B: 총 게임 시간(초)
  correct_score: 1             # 정답 점수
  wrong_score: -1              # 오답 점수 (없으면 0)

# 콘텐츠 데이터
data_type: text-to-text        # 데이터 형식
data_count: 50                 # 총 문제/요소 개수
data_sample:                   # 샘플 5개 (검토용)
  - { q: "apple", a: "사과", choices: ["사과","바나나","포도","수박"] }
  - { q: "book", a: "책", choices: ["책","의자","연필","가방"] }
  ...

# 인원 지원
players: [2, 3, 4]             # 지원 인원 (대부분 2/3/4)

# 사운드
sounds:
  - correct  # 정답 효과음
  - wrong    # 오답 효과음
  - tick     # 타이머
  - win      # 승리

# 일러스트
illustration: SVG              # 인트로 화면 일러스트 형식 (SVG 권장)

# 골든 템플릿
template: flag-quiz            # 베이스로 복사할 기존 게임 폴더
```

---

## 필드 상세

### `folder`
- kebab-case 영문
- 의미 명확 (예: `english-word`, `animal-sort`)
- 기존 폴더명과 중복 금지

### `pattern`
- A: 동시 반응형 → flag-quiz 템플릿
- B: 개별 영역형 → whack-a-mole 템플릿
- C: 턴제/협력형 → nim-game 또는 secret-code 템플릿

### `category`
런처 필터 카테고리 5개 중 하나:
- `speed`: 반응속도
- `brain`: 두뇌
- `math`: 수학
- `knowledge`: 지식
- `coop`: 협력

### `data_type`
콘텐츠 형식 (게임 로직이 어떻게 구성될지 결정):
- `text-to-text`: 텍스트 보고 텍스트 정답 (예: 영어 단어 → 한글)
- `image-to-text`: 이미지 보고 텍스트 정답 (예: 국기 → 나라명)
- `text-to-image`: 텍스트 보고 이미지 정답 (예: 동물 이름 → 그림)
- `audio-to-text`: 소리 듣고 텍스트 정답 (드물게)
- `pattern-recognition`: 패턴 인식 (다음 그림 찾기)
- `count-classify`: 분류/계수 (몇 개인지 세기)
- `compare-judge`: 비교/판단 (큰 것 고르기)
- `position-pick`: 위치/터치 (특정 위치 누르기)
- `turn-action`: 턴 액션 (보드 게임)
- `cooperative`: 협력 (역할 분담)

### `data_count`
- 패턴 A: 30개 이상 권장 (10라운드 × 무작위 출제)
- 패턴 B: 무한 생성 가능하면 0
- 패턴 C: 게임마다 다름

### `data_sample`
- 최소 5개 샘플 제시 (사용자 데이터 검토용)
- 자동 생성 시 사용자 승인 받아야 함

---

## 명세서 작성 예시

### 예시 1: 영어 단어 (패턴 A)
```yaml
folder: english-word
name: 영어 단어
description: 영어 단어를 보고 뜻을 맞혀보세요!
icon: 🔤
color: "#4CAF50"
pattern: A
category: knowledge
grades: [3,4,5,6]
playTime: "1분"
mechanism:
  rounds: 10
  time_per_question: 8
  correct_score: 1
  wrong_score: -1
data_type: text-to-text
data_count: 50
data_sample:
  - { q: "apple", a: "사과", choices: ["사과","바나나","포도","수박"] }
players: [2, 3, 4]
sounds: [correct, wrong, tick, win]
illustration: SVG
template: flag-quiz
```

### 예시 2: 동물 분류 (패턴 B)
```yaml
folder: animal-sort
name: 동물 분류
description: 떨어지는 동물을 종류별로 분류하세요!
icon: 🐾
color: "#FF7043"
pattern: B
category: brain
grades: [1,2,3,4,5,6]
playTime: "30초"
mechanism:
  duration: 30
  correct_score: 1
  wrong_score: -2
data_type: position-pick
data_count: 0  # 무한 생성
data_sample:
  - { item: "🐶", category: "포유류" }
players: [2, 3, 4]
sounds: [correct, wrong, tick, win]
illustration: SVG
template: whack-a-mole
```

### 예시 3: 박자 따라하기 (패턴 C)
```yaml
folder: rhythm-clap
name: 박자 따라하기
description: 같이 박자를 맞춰 박수를 쳐요!
icon: 👏
color: "#FFB74D"
pattern: C
category: coop
grades: [1,2,3,4,5,6]
playTime: "1~2분"
mechanism:
  rounds: 8
  correct_score: 1
data_type: cooperative
data_count: 8
data_sample:
  - { pattern: [1,0,1,1,0], bpm: 100 }
players: [2]
sounds: [tick, correct, wrong, win]
illustration: SVG
template: secret-code
```

---

## 명세서 검증 체크리스트

게임 제작 전 명세서가 다음 조건을 만족하는지 확인:

- [ ] folder가 기존과 중복되지 않음
- [ ] pattern이 A/B/C 중 하나
- [ ] category가 5개 중 하나
- [ ] mechanism 필드가 패턴별 필수 항목 모두 포함
- [ ] data_sample이 5개 이상
- [ ] template이 실제 존재하는 폴더
- [ ] 학년 범위가 합리적 (예: 영어는 3학년 이상)
