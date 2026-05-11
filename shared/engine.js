/* shared/engine.js */

/**
 * 카운트다운 타이머 생성
 * @param {number} seconds - 총 시간 (초)
 * @param {function} onTick - 매초 호출 (remaining 전달)
 * @param {function} onEnd - 종료 시 호출
 * @returns {{ start(), pause(), stop() }}
 */
function createTimer(seconds, onTick, onEnd) {
  let remaining = seconds;
  let intervalId = null;

  function tick() {
    remaining--;
    onTick(remaining);
    if (remaining <= 0) {
      clearInterval(intervalId);
      intervalId = null;
      onEnd();
    }
  }

  return {
    start() {
      if (intervalId) return;
      onTick(remaining);
      intervalId = setInterval(tick, 1000);
    },
    pause() {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    },
    stop() {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
      remaining = seconds;
    }
  };
}

/**
 * 점수 표시 관리
 * @param {HTMLElement} element - 점수를 표시할 DOM 요소
 * @returns {{ add(n), get(), reset() }}
 */
function createScoreboard(element) {
  let score = 0;

  function render() {
    element.textContent = score;
  }

  render();

  return {
    add(n) {
      score += n;
      render();
    },
    get() {
      return score;
    },
    reset() {
      score = 0;
      render();
    }
  };
}

/**
 * Web Audio API 기반 효과음 관리
 * soundMap: { name: function(audioCtx) => AudioNode } 형태
 * 각 함수는 audioCtx를 받아 oscillator 등을 설정하고 재생
 * @param {Object} soundMap
 * @returns {{ play(name), mute(), unmute(), isMuted(), toggleMute() }}
 */
function createSoundManager(soundMap) {
  let audioCtx = null;
  // 기본 음소거, sessionStorage에서 복원
  let muted = sessionStorage.getItem('sound-muted') !== 'false';

  function getContext() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtx;
  }

  function saveMuteState() {
    sessionStorage.setItem('sound-muted', muted);
  }

  return {
    play(name) {
      if (muted) return;
      const fn = soundMap[name];
      if (!fn) return;
      const ctx = getContext();
      fn(ctx);
    },
    mute() {
      muted = true;
      saveMuteState();
    },
    unmute() {
      muted = false;
      saveMuteState();
    },
    isMuted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      saveMuteState();
      return muted;
    }
  };
}

/**
 * 런처(홈)로 이동
 */
function goHome() {
  window.location.href = '../../index.html';
}

/**
 * BGM Manager - Web Audio API 기반 카테고리별 단순 루프
 *
 * 사용법:
 *   var bgm = createBgmManager();
 *   bgm.play('puzzle');   // 카테고리 시작
 *   bgm.stop();
 *   bgm.toggle();
 *   bgm.isOn();           // boolean
 *
 * 카테고리별 분위기:
 *   speed/brain/math/knowledge/coop/puzzle
 *
 * - 기본 OFF (sessionStorage 'bgm-on' 상태 기억)
 * - 매우 부드러운 볼륨 (효과음 방해 X)
 * - 페이지 떠나면 자동 정지
 *
 * @returns {{ play(category), stop(), toggle(), isOn() }}
 */
function createBgmManager() {
  let ctx = null;
  let masterGain = null;
  let on = false;
  let currentCategory = null;
  let scheduledNodes = []; // for cleanup
  let nextNoteTime = 0;
  let timerId = null;
  let currentNoteIdx = 0; // 멜로디 위치 추적 (scheduledNodes splice와 무관하게 유지)

  // sessionStorage에서 상태 복원
  try {
    on = sessionStorage.getItem('bgm-on') === 'true';
  } catch {}

  function getContext() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0.06; // 매우 작은 볼륨
      masterGain.connect(ctx.destination);
    }
    return ctx;
  }

  function saveState() {
    try { sessionStorage.setItem('bgm-on', on ? 'true' : 'false'); } catch {}
  }

  // 카테고리별 멜로디 패턴 (음표 주파수 배열, 박자 sec)
  const PATTERNS = {
    speed:     { notes: [523, 659, 784, 659, 523, 659, 784, 880], beat: 0.18, type: 'triangle' },
    brain:     { notes: [392, 466, 523, 466, 392, 466, 523, 587], beat: 0.32, type: 'sine' },
    math:      { notes: [440, 523, 659, 523, 440, 523, 659, 784], beat: 0.24, type: 'triangle' },
    knowledge: { notes: [523, 587, 659, 698, 659, 587, 523, 466], beat: 0.28, type: 'sine' },
    coop:      { notes: [392, 440, 523, 587, 523, 440, 392, 349], beat: 0.36, type: 'sine' },
    puzzle:    { notes: [349, 392, 466, 523, 466, 392, 349, 311], beat: 0.42, type: 'sine' },
  };

  function scheduleNote(freq, time, duration, type) {
    const c = getContext();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.7, time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(time);
    osc.stop(time + duration + 0.05);
    scheduledNodes.push(osc, gain);
  }

  function scheduler() {
    if (!on || !currentCategory) return;
    const pattern = PATTERNS[currentCategory] || PATTERNS.brain;
    const c = getContext();

    // 0.2초마다 호출 → 0.5초 미리 스케줄
    while (nextNoteTime < c.currentTime + 0.5) {
      scheduleNote(pattern.notes[currentNoteIdx], nextNoteTime, pattern.beat * 0.9, pattern.type);
      nextNoteTime += pattern.beat;
      currentNoteIdx = (currentNoteIdx + 1) % pattern.notes.length;
    }

    // 오래된 노드 정리 (메모리 누수 방지) - currentNoteIdx와 무관하게 안전
    if (scheduledNodes.length > 200) scheduledNodes.splice(0, 100);
  }

  function startScheduler() {
    if (timerId) return;
    nextNoteTime = getContext().currentTime + 0.1;
    currentNoteIdx = 0; // 새 시작
    scheduler();
    timerId = setInterval(scheduler, 200);
  }

  function stopScheduler() {
    if (timerId) { clearInterval(timerId); timerId = null; }
  }

  // 페이지 종료 시 정리
  window.addEventListener('beforeunload', () => {
    stopScheduler();
    if (ctx) try { ctx.close(); } catch {}
  });

  return {
    play(category) {
      currentCategory = category;
      if (!on) return;
      getContext(); // ensure ctx
      if (ctx.state === 'suspended') ctx.resume();
      startScheduler();
    },
    stop() {
      stopScheduler();
      // 즉시 음소거
      if (masterGain) {
        masterGain.gain.cancelScheduledValues(ctx.currentTime);
        masterGain.gain.setValueAtTime(0, ctx.currentTime);
        masterGain.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 0.5);
      }
    },
    toggle() {
      on = !on;
      saveState();
      if (on) {
        if (currentCategory) this.play(currentCategory);
      } else {
        this.stop();
      }
      return on;
    },
    isOn() { return on; },
  };
}

/**
 * 게임 폴더명 → 카테고리 매핑 (BGM 분위기 결정용)
 * 런처 index.html의 CATEGORY_MAP과 동기화 유지
 */
const _GAME_CATEGORY_MAP = {
  'whack-a-mole': 'speed', 'reaction-race': 'speed', 'balloon-pop': 'speed', 'bomb-dodge': 'speed',
  'quick-sort': 'speed',
  'color-touch': 'brain', 'shape-match': 'brain', 'shadow-match': 'brain', 'missing-piece': 'brain',
  'mirror-match': 'brain', 'dots-and-boxes': 'brain', 'memory-match': 'brain', 'nim-game': 'brain',
  'quick-math': 'math', 'size-compare': 'math', 'color-count': 'math', 'more-or-less': 'math',
  'number-tap': 'math', 'clock-reading': 'math', 'math-sign': 'math',
  'ox-quiz': 'knowledge', 'initial-quiz': 'knowledge', 'capital-quiz': 'knowledge',
  'flag-quiz': 'knowledge', 'proverb-quiz': 'knowledge', 'english-word': 'knowledge',
  'animal-sort': 'knowledge',
  'secret-code': 'coop', 'mirror-draw': 'coop', 'color-signal': 'coop', 'rhythm-echo': 'coop',
  'slide-puzzle': 'puzzle', 'maze-run': 'puzzle', 'pipe-connect': 'puzzle',
  'laser-reflect': 'puzzle', 'one-stroke': 'puzzle', 'dot-connect': 'puzzle',
  'spot-the-difference': 'brain',
};

function _detectGameCategory() {
  const m = location.pathname.match(/\/games\/([^/]+)\//);
  return m ? (_GAME_CATEGORY_MAP[m[1]] || 'brain') : 'brain';
}

/**
 * BGM 토글 버튼 자동 주입 (모든 게임 페이지에 표시)
 * 우상단 떠다니는 작은 버튼. 카테고리 자동 감지.
 * 사용자가 수동으로 토글 해야만 BGM 재생됨 (기본 OFF).
 */
let _bgm = null;
function _injectBgmToggle() {
  // 게임 페이지인지 확인
  if (!/\/games\//.test(location.pathname)) return;
  if (document.getElementById('bgmToggleBtn')) return;

  if (!_bgm) _bgm = createBgmManager();
  const category = _detectGameCategory();
  // 카테고리 자동 설정 (사용자가 토글 켜면 이 카테고리로 재생)
  _bgm.play(category);

  const btn = document.createElement('button');
  btn.id = 'bgmToggleBtn';
  btn.className = 'bgm-toggle-fab';
  btn.setAttribute('aria-label', '배경음악 토글');
  function updateIcon() {
    btn.textContent = _bgm.isOn() ? '🎵' : '🎵̸';
    btn.classList.toggle('bgm-on', _bgm.isOn());
  }
  updateIcon();
  btn.addEventListener('click', function (e) {
    e.preventDefault();
    e.stopPropagation();
    _bgm.toggle();
    updateIcon();
  }, false);

  // CSS 자동 주입 (한 번만)
  if (!document.getElementById('bgmToggleStyle')) {
    const style = document.createElement('style');
    style.id = 'bgmToggleStyle';
    style.textContent = `
      .bgm-toggle-fab {
        position: fixed;
        bottom: 14px;
        left: 14px;
        z-index: 9000;
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: #fff;
        border: 3px solid #2C2C2C;
        box-shadow: 3px 3px 0 #2C2C2C;
        cursor: pointer;
        font-size: 1.2rem;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        line-height: 1;
        opacity: 0.6;
        transition: opacity 0.15s, background 0.15s, transform 0.1s;
        -webkit-tap-highlight-color: transparent;
      }
      .bgm-toggle-fab:hover { opacity: 1; }
      .bgm-toggle-fab:active { transform: translate(2px, 2px); box-shadow: 1px 1px 0 #2C2C2C; }
      .bgm-toggle-fab.bgm-on {
        background: #FFD54F;
        opacity: 1;
        animation: bgmPulse 1.4s ease-in-out infinite alternate;
      }
      @keyframes bgmPulse {
        from { box-shadow: 3px 3px 0 #2C2C2C; }
        to   { box-shadow: 3px 3px 0 #2C2C2C, 0 0 0 4px rgba(255,213,79,0.4); }
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(btn);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _injectBgmToggle);
} else {
  _injectBgmToggle();
}

/**
 * 클릭 + 터치 통합 핸들러
 * 300ms 딜레이 없이 즉시 반응
 * @param {HTMLElement} element
 * @param {function} callback
 */
function onTap(element, callback) {
  let touched = false;

  element.addEventListener('touchstart', function(e) {
    touched = true;
    e.preventDefault();
    callback(e);
  }, { passive: false });

  element.addEventListener('click', function(e) {
    if (!touched) {
      callback(e);
    }
    touched = false;
  });
}
