/* games/spot-the-difference/game.js — 패턴 D (퍼즐 병렬 경쟁) — 10 테마 × 5 라운드 */
'use strict';

const TOTAL_ROUNDS = 5;
const ROUND_DIFFS  = [3, 5, 7, 9, 11]; // 라운드별 차이 개수
const ROUND_TIMES  = [45, 60, 75, 90, 120]; // 라운드별 시간(초)
const RESULT_PAUSE_MS = 2200;

const PLAYER_CONFIG = [
  { label: 'P1', dot: '#0288D1', cls: 'p1' },
  { label: 'P2', dot: '#E53935', cls: 'p2' },
  { label: 'P3', dot: '#388E3C', cls: 'p3' },
  { label: 'P4', dot: '#F57C00', cls: 'p4' },
];

// ── 테마 데이터 (imageA_svg + diffs) ─────────────────────────────
// diff 형식: { cx, cy, r, type, ...payload }
//   type='attr':    { id, name, value }
//   type='remove':  { id }
//   type='replace': { id, html }   (전체 outerHTML 교체)
//   type='add':     { html }       (svg 끝에 추가)
const THEMES = [];

// 공통 SVG viewBox: 400 x 250
// 모든 테마 동일 viewBox로 좌표 일관성 유지

// === Theme 1: 🏘️ 마을 ===
THEMES.push({
  id: 'village', name: '마을', emoji: '🏘️',
  imageA_svg: `<svg viewBox="0 0 400 250" xmlns="http://www.w3.org/2000/svg">
    <rect width="400" height="160" fill="#B3E5FC"/>
    <rect y="160" width="400" height="90" fill="#A5D6A7"/>
    <polygon points="0,160 80,100 160,140 240,90 320,130 400,110 400,160" fill="#90A4AE" stroke="#2C2C2C" stroke-width="2"/>
    <g id="sun"><circle cx="60" cy="40" r="22" fill="#FFD54F" stroke="#2C2C2C" stroke-width="2.5"/><circle id="sun-eye-l" cx="54" cy="36" r="2" fill="#2C2C2C"/><circle cx="66" cy="36" r="2" fill="#2C2C2C"/><path id="sun-mouth" d="M 54 46 Q 60 52 66 46" stroke="#2C2C2C" stroke-width="2" fill="none"/></g>
    <g id="cloud1"><ellipse cx="180" cy="50" rx="32" ry="16" fill="#fff" stroke="#2C2C2C" stroke-width="2"/><ellipse cx="200" cy="42" rx="22" ry="14" fill="#fff" stroke="#2C2C2C" stroke-width="2"/></g>
    <g id="bird1"><path d="M 280 60 Q 286 54 292 60 Q 298 54 304 60" stroke="#2C2C2C" stroke-width="2" fill="none" stroke-linecap="round"/></g>
    <g id="bird2"><path d="M 320 80 Q 326 74 332 80 Q 338 74 344 80" stroke="#2C2C2C" stroke-width="2" fill="none" stroke-linecap="round"/></g>
    <g id="tree1"><rect x="40" y="150" width="14" height="40" fill="#6D4C41" stroke="#2C2C2C" stroke-width="2"/><circle id="tree1-leaf" cx="47" cy="142" r="22" fill="#43A047" stroke="#2C2C2C" stroke-width="2"/><circle id="tree1-apple" cx="40" cy="148" r="4" fill="#E53935" stroke="#2C2C2C" stroke-width="1.5"/></g>
    <g id="house"><rect id="house-body" x="160" y="120" width="100" height="70" fill="#FFE0B2" stroke="#2C2C2C" stroke-width="2.5"/><polygon id="house-roof" points="155,120 210,80 265,120" fill="#D32F2F" stroke="#2C2C2C" stroke-width="2.5"/><rect id="house-door" x="195" y="155" width="22" height="35" fill="#5D4037" stroke="#2C2C2C" stroke-width="2"/><rect id="house-win-l" x="172" y="135" width="20" height="20" fill="#81D4FA" stroke="#2C2C2C" stroke-width="2"/><line x1="182" y1="135" x2="182" y2="155" stroke="#2C2C2C" stroke-width="1.5"/><line x1="172" y1="145" x2="192" y2="145" stroke="#2C2C2C" stroke-width="1.5"/><rect id="house-win-r" x="228" y="135" width="20" height="20" fill="#81D4FA" stroke="#2C2C2C" stroke-width="2"/><line x1="238" y1="135" x2="238" y2="155" stroke="#2C2C2C" stroke-width="1.5"/><line x1="228" y1="145" x2="248" y2="145" stroke="#2C2C2C" stroke-width="1.5"/><rect id="house-chim" x="240" y="90" width="14" height="22" fill="#8D6E63" stroke="#2C2C2C" stroke-width="2"/><ellipse id="house-smoke" cx="247" cy="80" rx="6" ry="5" fill="#fff" stroke="#2C2C2C" stroke-width="1.5"/></g>
    <g id="tree2"><rect x="320" y="155" width="12" height="35" fill="#6D4C41" stroke="#2C2C2C" stroke-width="2"/><circle id="tree2-leaf" cx="326" cy="148" r="20" fill="#388E3C" stroke="#2C2C2C" stroke-width="2"/></g>
    <g id="dog"><ellipse cx="100" cy="210" rx="18" ry="10" fill="#FFB74D" stroke="#2C2C2C" stroke-width="2"/><circle cx="84" cy="204" r="10" fill="#FFB74D" stroke="#2C2C2C" stroke-width="2"/><circle cx="82" cy="203" r="1.5" fill="#2C2C2C"/><circle cx="78" cy="207" r="1.5" fill="#2C2C2C"/><path id="dog-tail" d="M 117 204 Q 127 198 130 207" stroke="#FB8C00" stroke-width="4" fill="none" stroke-linecap="round"/></g>
    <g id="flowers"><line x1="280" y1="220" x2="280" y2="235" stroke="#388E3C" stroke-width="1.5"/><circle id="flower1" cx="280" cy="216" r="6" fill="#E53935" stroke="#2C2C2C" stroke-width="1.5"/><line x1="300" y1="225" x2="300" y2="238" stroke="#388E3C" stroke-width="1.5"/><circle id="flower2" cx="300" cy="221" r="6" fill="#7C4DFF" stroke="#2C2C2C" stroke-width="1.5"/><line x1="320" y1="220" x2="320" y2="235" stroke="#388E3C" stroke-width="1.5"/><circle id="flower3" cx="320" cy="216" r="6" fill="#FFC107" stroke="#2C2C2C" stroke-width="1.5"/></g>
    <g id="ball"><circle id="ball-c" cx="360" cy="215" r="10" fill="#fff" stroke="#2C2C2C" stroke-width="2"/><line x1="352" y1="212" x2="368" y2="212" stroke="#2C2C2C" stroke-width="1.5"/></g>
  </svg>`,
  diffs: [
    { cx: 60,  cy: 40,  r: 25, type: 'attr',    id: 'sun-mouth', name: 'd', value: 'M 54 50 Q 60 44 66 50' }, // 해 슬픈 입
    { cx: 326, cy: 148, r: 22, type: 'attr',    id: 'tree2-leaf', name: 'fill', value: '#FFD54F' },             // 나무2 잎 노랑
    { cx: 210, cy: 100, r: 30, type: 'attr',    id: 'house-roof', name: 'fill', value: '#1976D2' },             // 지붕 파랑
    { cx: 130, cy: 207, r: 18, type: 'remove',  id: 'dog-tail' },                                                // 강아지 꼬리 사라짐
    { cx: 280, cy: 216, r: 10, type: 'attr',    id: 'flower1', name: 'fill', value: '#FF80AB' },                // 꽃1 분홍
    { cx: 332, cy: 80,  r: 20, type: 'remove',  id: 'bird2' },                                                   // 새 사라짐
    { cx: 40,  cy: 148, r: 8,  type: 'remove',  id: 'tree1-apple' },                                             // 사과 사라짐
    { cx: 247, cy: 80,  r: 10, type: 'attr',    id: 'house-smoke', name: 'rx', value: '12' },                   // 연기 큼
    { cx: 360, cy: 215, r: 12, type: 'attr',    id: 'ball-c', name: 'fill', value: '#FFC107' },                 // 공 노랑
    { cx: 195, cy: 170, r: 18, type: 'attr',    id: 'house-door', name: 'fill', value: '#43A047' },             // 문 초록
    { cx: 200, cy: 50,  r: 30, type: 'attr',    id: 'cloud1', name: 'transform', value: 'translate(0,-15)' },   // 구름 위로
  ]
});

// === Theme 2: 🌊 바닷가 ===
THEMES.push({
  id: 'beach', name: '바닷가', emoji: '🌊',
  imageA_svg: `<svg viewBox="0 0 400 250" xmlns="http://www.w3.org/2000/svg">
    <rect width="400" height="100" fill="#81D4FA"/>
    <rect y="100" width="400" height="80" fill="#0288D1"/>
    <rect y="180" width="400" height="70" fill="#FFE082"/>
    <path d="M 0 105 Q 50 100 100 105 Q 150 110 200 105 Q 250 100 300 105 Q 350 110 400 105 L 400 100 L 0 100 Z" fill="#4FC3F7"/>
    <g id="sun"><circle cx="320" cy="40" r="25" fill="#FFC107" stroke="#2C2C2C" stroke-width="2.5"/></g>
    <g id="seagull1"><path d="M 80 60 Q 88 50 96 60 Q 104 50 112 60" stroke="#2C2C2C" stroke-width="2.5" fill="none" stroke-linecap="round"/></g>
    <g id="seagull2"><path d="M 180 40 Q 188 30 196 40 Q 204 30 212 40" stroke="#2C2C2C" stroke-width="2.5" fill="none" stroke-linecap="round"/></g>
    <g id="cloud"><ellipse cx="60" cy="30" rx="28" ry="14" fill="#fff" stroke="#2C2C2C" stroke-width="2"/></g>
    <g id="boat"><path d="M 240 130 L 290 130 L 280 145 L 250 145 Z" fill="#8D6E63" stroke="#2C2C2C" stroke-width="2.5"/><rect x="263" y="105" width="3" height="25" fill="#5D4037"/><polygon id="boat-sail" points="266,105 285,128 266,128" fill="#FFCDD2" stroke="#2C2C2C" stroke-width="2"/></g>
    <g id="parasol"><line x1="80" y1="200" x2="80" y2="240" stroke="#2C2C2C" stroke-width="3"/><path id="parasol-top" d="M 50 200 Q 80 175 110 200 Z" fill="#E53935" stroke="#2C2C2C" stroke-width="2.5"/><line x1="60" y1="195" x2="80" y2="178" stroke="#2C2C2C" stroke-width="1.5"/><line x1="100" y1="195" x2="80" y2="178" stroke="#2C2C2C" stroke-width="1.5"/></g>
    <g id="bucket"><rect x="155" y="215" width="22" height="22" fill="#FFB74D" stroke="#2C2C2C" stroke-width="2.5"/><path id="bucket-handle" d="M 158 215 Q 166 205 174 215" stroke="#2C2C2C" stroke-width="2" fill="none"/></g>
    <g id="shell"><path id="shell-fan" d="M 220 230 Q 220 215 232 215 Q 244 215 244 230 Z" fill="#F8BBD0" stroke="#2C2C2C" stroke-width="2"/><line x1="232" y1="215" x2="232" y2="230" stroke="#2C2C2C" stroke-width="1"/></g>
    <g id="starfish"><polygon id="starfish-poly" points="310,205 313,213 322,213 315,219 318,228 310,222 302,228 305,219 298,213 307,213" fill="#FF7043" stroke="#2C2C2C" stroke-width="2"/></g>
    <g id="crab"><ellipse cx="350" cy="225" rx="14" ry="9" fill="#E53935" stroke="#2C2C2C" stroke-width="2"/><line x1="338" y1="220" x2="332" y2="215" stroke="#2C2C2C" stroke-width="2"/><line x1="362" y1="220" x2="368" y2="215" stroke="#2C2C2C" stroke-width="2"/><circle id="crab-eye-l" cx="346" cy="220" r="1.5" fill="#fff"/><circle cx="354" cy="220" r="1.5" fill="#fff"/></g>
    <g id="fish1"><path d="M 60 140 Q 75 132 90 140 Q 75 148 60 140 Z" fill="#FF80AB" stroke="#2C2C2C" stroke-width="2"/><polygon points="55,140 45,135 45,145" fill="#FF80AB" stroke="#2C2C2C" stroke-width="2"/></g>
    <g id="fish2"><path d="M 130 160 Q 145 152 160 160 Q 145 168 130 160 Z" fill="#FFD54F" stroke="#2C2C2C" stroke-width="2"/><polygon points="125,160 115,155 115,165" fill="#FFD54F" stroke="#2C2C2C" stroke-width="2"/></g>
  </svg>`,
  diffs: [
    { cx: 80,  cy: 188, r: 30, type: 'attr',    id: 'parasol-top', name: 'fill', value: '#1976D2' },     // 파라솔 색
    { cx: 232, cy: 222, r: 15, type: 'attr',    id: 'shell-fan', name: 'fill', value: '#7C4DFF' },        // 조개 색
    { cx: 196, cy: 40,  r: 18, type: 'remove',  id: 'seagull2' },                                          // 갈매기 사라짐
    { cx: 275, cy: 117, r: 18, type: 'attr',    id: 'boat-sail', name: 'fill', value: '#43A047' },        // 돛 색
    { cx: 145, cy: 160, r: 18, type: 'remove',  id: 'fish2' },                                             // 노랑 물고기 사라짐
    { cx: 350, cy: 225, r: 16, type: 'attr',    id: 'crab-eye-l', name: 'r', value: '3' },                // 게 눈 큼
    { cx: 310, cy: 218, r: 15, type: 'attr',    id: 'starfish-poly', name: 'fill', value: '#FFC107' },    // 불가사리 노랑
    { cx: 60,  cy: 30,  r: 28, type: 'remove',  id: 'cloud' },                                             // 구름 사라짐
    { cx: 320, cy: 40,  r: 25, type: 'attr',    id: 'sun', name: 'transform', value: 'translate(0,15)' }, // 해 아래로
    { cx: 165, cy: 210, r: 12, type: 'remove',  id: 'bucket-handle' },                                    // 양동이 손잡이
    { cx: 75,  cy: 140, r: 18, type: 'attr',    id: 'fish1', name: 'transform', value: 'translate(20,0)' } // 물고기 이동
  ]
});

// === Theme 3: 🏫 학교 운동장 ===
THEMES.push({
  id: 'school', name: '학교', emoji: '🏫',
  imageA_svg: `<svg viewBox="0 0 400 250" xmlns="http://www.w3.org/2000/svg">
    <rect width="400" height="160" fill="#B3E5FC"/>
    <rect y="160" width="400" height="90" fill="#FFE082"/>
    <g id="school-bldg"><rect x="40" y="80" width="120" height="100" fill="#FFCC80" stroke="#2C2C2C" stroke-width="2.5"/><polygon id="school-roof" points="35,80 100,55 165,80" fill="#5D4037" stroke="#2C2C2C" stroke-width="2.5"/><rect id="school-flag-pole" x="98" y="50" width="3" height="22" fill="#2C2C2C"/><polygon id="school-flag" points="101,52 130,52 130,65 101,65" fill="#E53935" stroke="#2C2C2C" stroke-width="1.5"/><rect x="55" y="105" width="22" height="22" fill="#81D4FA" stroke="#2C2C2C" stroke-width="2"/><line x1="66" y1="105" x2="66" y2="127" stroke="#2C2C2C" stroke-width="1.5"/><line x1="55" y1="116" x2="77" y2="116" stroke="#2C2C2C" stroke-width="1.5"/><rect x="89" y="105" width="22" height="22" fill="#81D4FA" stroke="#2C2C2C" stroke-width="2"/><line x1="100" y1="105" x2="100" y2="127" stroke="#2C2C2C" stroke-width="1.5"/><line x1="89" y1="116" x2="111" y2="116" stroke="#2C2C2C" stroke-width="1.5"/><rect x="123" y="105" width="22" height="22" fill="#81D4FA" stroke="#2C2C2C" stroke-width="2"/><line x1="134" y1="105" x2="134" y2="127" stroke="#2C2C2C" stroke-width="1.5"/><line x1="123" y1="116" x2="145" y2="116" stroke="#2C2C2C" stroke-width="1.5"/><rect id="school-door" x="88" y="145" width="24" height="35" fill="#5D4037" stroke="#2C2C2C" stroke-width="2"/></g>
    <g id="slide"><rect x="240" y="100" width="6" height="80" fill="#8D6E63" stroke="#2C2C2C" stroke-width="2"/><path id="slide-curve" d="M 240 100 Q 280 130 320 180" stroke="#FF7043" stroke-width="6" fill="none" stroke-linecap="round"/><line x1="246" y1="180" x2="320" y2="180" stroke="#2C2C2C" stroke-width="2"/></g>
    <g id="swing"><line x1="200" y1="120" x2="200" y2="170" stroke="#2C2C2C" stroke-width="2"/><line x1="220" y1="120" x2="220" y2="170" stroke="#2C2C2C" stroke-width="2"/><rect id="swing-seat" x="195" y="170" width="30" height="6" fill="#FFC107" stroke="#2C2C2C" stroke-width="2"/></g>
    <g id="ball1"><circle id="ball1-c" cx="350" cy="210" r="14" fill="#fff" stroke="#2C2C2C" stroke-width="2.5"/><line x1="338" y1="207" x2="362" y2="207" stroke="#2C2C2C" stroke-width="1.5"/><line x1="338" y1="213" x2="362" y2="213" stroke="#2C2C2C" stroke-width="1.5"/></g>
    <g id="kid1"><circle cx="180" cy="200" r="8" fill="#FFE0B2" stroke="#2C2C2C" stroke-width="2"/><rect id="kid1-shirt" x="173" y="208" width="14" height="20" fill="#7C4DFF" stroke="#2C2C2C" stroke-width="2"/><line x1="177" y1="228" x2="176" y2="240" stroke="#2C2C2C" stroke-width="2"/><line x1="183" y1="228" x2="184" y2="240" stroke="#2C2C2C" stroke-width="2"/></g>
    <g id="kid2"><circle cx="280" cy="205" r="8" fill="#FFE0B2" stroke="#2C2C2C" stroke-width="2"/><rect id="kid2-shirt" x="273" y="213" width="14" height="20" fill="#FF7043" stroke="#2C2C2C" stroke-width="2"/><line x1="277" y1="233" x2="276" y2="243" stroke="#2C2C2C" stroke-width="2"/><line x1="283" y1="233" x2="284" y2="243" stroke="#2C2C2C" stroke-width="2"/></g>
    <g id="basket"><rect id="basket-pole" x="358" y="60" width="4" height="80" fill="#2C2C2C"/><rect id="basket-board" x="350" y="40" width="20" height="22" fill="#fff" stroke="#2C2C2C" stroke-width="2"/><circle cx="360" cy="65" r="6" fill="none" stroke="#FF7043" stroke-width="2.5"/></g>
    <g id="cloud-s"><ellipse cx="120" cy="40" rx="22" ry="11" fill="#fff" stroke="#2C2C2C" stroke-width="2"/></g>
  </svg>`,
  diffs: [
    { cx: 116, cy: 58,  r: 18, type: 'attr',    id: 'school-flag', name: 'fill', value: '#1976D2' },       // 깃발 색
    { cx: 100, cy: 67,  r: 30, type: 'attr',    id: 'school-roof', name: 'fill', value: '#D32F2F' },       // 지붕 빨강
    { cx: 100, cy: 162, r: 16, type: 'attr',    id: 'school-door', name: 'fill', value: '#43A047' },       // 문 초록
    { cx: 350, cy: 210, r: 18, type: 'attr',    id: 'ball1-c', name: 'fill', value: '#FF7043' },           // 농구공 색
    { cx: 280, cy: 220, r: 18, type: 'attr',    id: 'kid2-shirt', name: 'fill', value: '#43A047' },        // 아이2 옷
    { cx: 280, cy: 150, r: 50, type: 'attr',    id: 'slide-curve', name: 'stroke', value: '#1976D2' },     // 미끄럼틀 파랑
    { cx: 210, cy: 173, r: 18, type: 'attr',    id: 'swing-seat', name: 'fill', value: '#E53935' },        // 그네 빨강
    { cx: 120, cy: 40,  r: 25, type: 'remove',  id: 'cloud-s' },                                            // 구름 사라짐
    { cx: 180, cy: 220, r: 15, type: 'attr',    id: 'kid1-shirt', name: 'fill', value: '#FFC107' },        // 아이1 옷
    { cx: 360, cy: 50,  r: 16, type: 'attr',    id: 'basket-board', name: 'fill', value: '#FFD54F' },      // 백보드 노랑
    { cx: 358, cy: 100, r: 12, type: 'attr',    id: 'basket-pole', name: 'fill', value: '#FF7043' }         // 폴 색
  ]
});

// === Theme 4: 🚀 우주 ===
THEMES.push({
  id: 'space', name: '우주', emoji: '🚀',
  imageA_svg: `<svg viewBox="0 0 400 250" xmlns="http://www.w3.org/2000/svg">
    <rect width="400" height="250" fill="#311B92"/>
    <g id="stars"><circle id="star1" cx="50" cy="40" r="2" fill="#fff"/><circle id="star2" cx="120" cy="30" r="3" fill="#FFEB3B"/><circle cx="200" cy="50" r="2" fill="#fff"/><circle id="star4" cx="280" cy="35" r="2.5" fill="#fff"/><circle cx="350" cy="60" r="2" fill="#fff"/><circle cx="80" cy="100" r="1.5" fill="#fff"/><circle id="star7" cx="320" cy="120" r="2" fill="#fff"/><circle cx="180" cy="150" r="1.5" fill="#fff"/></g>
    <g id="moon"><circle id="moon-c" cx="80" cy="60" r="22" fill="#FFD54F" stroke="#2C2C2C" stroke-width="2.5"/><circle cx="72" cy="55" r="3" fill="#FFA000"/><circle cx="86" cy="65" r="2.5" fill="#FFA000"/></g>
    <g id="planet1"><circle id="planet1-c" cx="320" cy="80" r="28" fill="#FF7043" stroke="#2C2C2C" stroke-width="2.5"/><ellipse id="planet1-ring" cx="320" cy="80" rx="40" ry="8" fill="none" stroke="#FFD54F" stroke-width="3"/></g>
    <g id="rocket"><polygon id="rocket-body" points="200,140 210,110 220,140" fill="#fff" stroke="#2C2C2C" stroke-width="2.5"/><circle id="rocket-window" cx="210" cy="125" r="4" fill="#81D4FA" stroke="#2C2C2C" stroke-width="1.5"/><polygon id="rocket-fin-l" points="200,140 195,150 205,140" fill="#E53935" stroke="#2C2C2C" stroke-width="2"/><polygon id="rocket-fin-r" points="220,140 225,150 215,140" fill="#E53935" stroke="#2C2C2C" stroke-width="2"/><path id="rocket-flame" d="M 205 145 Q 210 160 215 145" fill="#FF7043" stroke="#2C2C2C" stroke-width="2"/></g>
    <g id="alien"><ellipse id="alien-body" cx="100" cy="180" rx="22" ry="18" fill="#43A047" stroke="#2C2C2C" stroke-width="2.5"/><circle id="alien-eye-l" cx="92" cy="175" r="4" fill="#fff" stroke="#2C2C2C" stroke-width="1.5"/><circle cx="92" cy="175" r="2" fill="#2C2C2C"/><circle id="alien-eye-r" cx="108" cy="175" r="4" fill="#fff" stroke="#2C2C2C" stroke-width="1.5"/><circle cx="108" cy="175" r="2" fill="#2C2C2C"/><line id="alien-antenna" x1="100" y1="162" x2="100" y2="152" stroke="#2C2C2C" stroke-width="2"/><circle cx="100" cy="150" r="3" fill="#FFD54F" stroke="#2C2C2C" stroke-width="1.5"/></g>
    <g id="ufo"><ellipse id="ufo-body" cx="280" cy="200" rx="28" ry="8" fill="#90A4AE" stroke="#2C2C2C" stroke-width="2.5"/><ellipse cx="280" cy="195" rx="14" ry="8" fill="#81D4FA" stroke="#2C2C2C" stroke-width="2"/><circle cx="270" cy="202" r="2" fill="#FFEB3B"/><circle cx="280" cy="204" r="2" fill="#FFEB3B"/><circle cx="290" cy="202" r="2" fill="#FFEB3B"/></g>
    <g id="comet"><circle id="comet-head" cx="350" cy="180" r="6" fill="#FFEB3B" stroke="#2C2C2C" stroke-width="2"/><path d="M 344 180 Q 330 178 320 176" stroke="#FFD54F" stroke-width="3" fill="none" opacity="0.7"/></g>
  </svg>`,
  diffs: [
    { cx: 80,  cy: 60,  r: 25, type: 'attr',    id: 'moon-c', name: 'fill', value: '#E1BEE7' },        // 달 보라
    { cx: 320, cy: 80,  r: 32, type: 'attr',    id: 'planet1-c', name: 'fill', value: '#43A047' },     // 행성 초록
    { cx: 320, cy: 80,  r: 45, type: 'remove',  id: 'planet1-ring' },                                   // 고리 사라짐
    { cx: 100, cy: 180, r: 22, type: 'attr',    id: 'alien-body', name: 'fill', value: '#7C4DFF' },    // 외계인 보라
    { cx: 210, cy: 125, r: 8,  type: 'attr',    id: 'rocket-window', name: 'fill', value: '#E53935' }, // 로켓 창문 빨강
    { cx: 210, cy: 155, r: 12, type: 'remove',  id: 'rocket-flame' },                                   // 화염 사라짐
    { cx: 280, cy: 200, r: 28, type: 'attr',    id: 'ufo-body', name: 'fill', value: '#FFD54F' },      // UFO 노랑
    { cx: 350, cy: 180, r: 12, type: 'attr',    id: 'comet-head', name: 'fill', value: '#FF7043' },    // 혜성 주황
    { cx: 92,  cy: 175, r: 8,  type: 'attr',    id: 'alien-eye-l', name: 'r', value: '7' },            // 외계인 눈 큼
    { cx: 120, cy: 30,  r: 8,  type: 'remove',  id: 'star2' },                                          // 별 사라짐
    { cx: 100, cy: 152, r: 12, type: 'remove',  id: 'alien-antenna' }                                   // 안테나 사라짐
  ]
});

// === Theme 5: 🌳 공원 ===
THEMES.push({
  id: 'park', name: '공원', emoji: '🌳',
  imageA_svg: `<svg viewBox="0 0 400 250" xmlns="http://www.w3.org/2000/svg">
    <rect width="400" height="160" fill="#B3E5FC"/>
    <rect y="160" width="400" height="90" fill="#A5D6A7"/>
    <g id="sun"><circle id="sun-c" cx="350" cy="40" r="24" fill="#FFD54F" stroke="#2C2C2C" stroke-width="2.5"/></g>
    <g id="cloud"><ellipse cx="60" cy="50" rx="28" ry="14" fill="#fff" stroke="#2C2C2C" stroke-width="2"/></g>
    <g id="tree-big"><rect x="80" y="120" width="20" height="60" fill="#6D4C41" stroke="#2C2C2C" stroke-width="2"/><circle id="tree-leaf-1" cx="90" cy="110" r="32" fill="#43A047" stroke="#2C2C2C" stroke-width="2"/><circle id="tree-leaf-2" cx="70" cy="125" r="22" fill="#388E3C" stroke="#2C2C2C" stroke-width="2"/><circle id="tree-leaf-3" cx="110" cy="125" r="22" fill="#388E3C" stroke="#2C2C2C" stroke-width="2"/></g>
    <g id="bench"><rect id="bench-seat" x="160" y="180" width="80" height="10" fill="#8D6E63" stroke="#2C2C2C" stroke-width="2.5"/><rect x="170" y="190" width="6" height="20" fill="#5D4037" stroke="#2C2C2C" stroke-width="2"/><rect x="224" y="190" width="6" height="20" fill="#5D4037" stroke="#2C2C2C" stroke-width="2"/><rect id="bench-back" x="160" y="160" width="80" height="6" fill="#8D6E63" stroke="#2C2C2C" stroke-width="2.5"/><line x1="170" y1="166" x2="170" y2="180" stroke="#5D4037" stroke-width="2"/><line x1="230" y1="166" x2="230" y2="180" stroke="#5D4037" stroke-width="2"/></g>
    <g id="fountain"><circle id="fountain-base" cx="320" cy="200" r="30" fill="#90A4AE" stroke="#2C2C2C" stroke-width="2.5"/><circle cx="320" cy="200" r="20" fill="#81D4FA"/><line id="fountain-water" x1="320" y1="195" x2="320" y2="170" stroke="#4FC3F7" stroke-width="6" stroke-linecap="round"/></g>
    <g id="bike"><circle id="bike-wheel-l" cx="50" cy="220" r="12" fill="none" stroke="#2C2C2C" stroke-width="2.5"/><circle id="bike-wheel-r" cx="90" cy="220" r="12" fill="none" stroke="#2C2C2C" stroke-width="2.5"/><line x1="50" y1="220" x2="70" y2="200" stroke="#E53935" stroke-width="3"/><line x1="90" y1="220" x2="70" y2="200" stroke="#E53935" stroke-width="3"/><line x1="70" y1="200" x2="65" y2="190" stroke="#E53935" stroke-width="3"/></g>
    <g id="kite"><polygon id="kite-shape" points="270,80 290,100 270,120 250,100" fill="#FFD54F" stroke="#2C2C2C" stroke-width="2.5"/><line x1="270" y1="120" x2="270" y2="200" stroke="#2C2C2C" stroke-width="1.5"/></g>
    <g id="butterfly"><ellipse cx="200" cy="140" rx="2" ry="8" fill="#2C2C2C"/><ellipse id="bfly-wing-l" cx="194" cy="137" rx="8" ry="6" fill="#FF80AB" stroke="#2C2C2C" stroke-width="1.5"/><ellipse id="bfly-wing-r" cx="206" cy="137" rx="8" ry="6" fill="#FF80AB" stroke="#2C2C2C" stroke-width="1.5"/></g>
    <g id="duck"><ellipse cx="160" cy="225" rx="12" ry="7" fill="#fff" stroke="#2C2C2C" stroke-width="2"/><circle cx="150" cy="220" r="6" fill="#fff" stroke="#2C2C2C" stroke-width="2"/><polygon id="duck-beak" points="142,221 138,219 142,224" fill="#FF9800" stroke="#2C2C2C" stroke-width="1.5"/></g>
  </svg>`,
  diffs: [
    { cx: 90,  cy: 110, r: 32, type: 'attr',    id: 'tree-leaf-1', name: 'fill', value: '#FFC107' },     // 나무 잎 노랑
    { cx: 320, cy: 175, r: 20, type: 'remove',  id: 'fountain-water' },                                   // 분수 물 사라짐
    { cx: 270, cy: 100, r: 25, type: 'attr',    id: 'kite-shape', name: 'fill', value: '#7C4DFF' },      // 연 보라
    { cx: 350, cy: 40,  r: 25, type: 'attr',    id: 'sun-c', name: 'fill', value: '#FF7043' },           // 해 주황
    { cx: 200, cy: 140, r: 18, type: 'attr',    id: 'bfly-wing-l', name: 'fill', value: '#43A047' },     // 나비 왼날개
    { cx: 142, cy: 222, r: 12, type: 'remove',  id: 'duck-beak' },                                        // 오리 부리
    { cx: 200, cy: 185, r: 15, type: 'attr',    id: 'bench-seat', name: 'fill', value: '#1976D2' },      // 벤치 색
    { cx: 50,  cy: 220, r: 14, type: 'attr',    id: 'bike-wheel-l', name: 'stroke', value: '#E53935' },  // 자전거 바퀴
    { cx: 60,  cy: 50,  r: 28, type: 'attr',    id: 'cloud', name: 'transform', value: 'translate(80,0)' }, // 구름 이동
    { cx: 320, cy: 200, r: 30, type: 'attr',    id: 'fountain-base', name: 'fill', value: '#7C4DFF' },   // 분수대 색
    { cx: 70,  cy: 130, r: 22, type: 'remove',  id: 'tree-leaf-2' }                                       // 잎 클러스터 사라짐
  ]
});

// === Theme 6: 🦁 동물원 ===
THEMES.push({
  id: 'zoo', name: '동물원', emoji: '🦁',
  imageA_svg: `<svg viewBox="0 0 400 250" xmlns="http://www.w3.org/2000/svg">
    <rect width="400" height="160" fill="#FFE082"/>
    <rect y="160" width="400" height="90" fill="#A5D6A7"/>
    <g id="sun"><circle id="sun-c" cx="60" cy="40" r="22" fill="#FF9800" stroke="#2C2C2C" stroke-width="2.5"/></g>
    <g id="lion"><ellipse cx="100" cy="190" rx="28" ry="20" fill="#FFB74D" stroke="#2C2C2C" stroke-width="2.5"/><circle id="lion-mane" cx="80" cy="180" r="22" fill="#A1887F" stroke="#2C2C2C" stroke-width="2.5"/><circle cx="80" cy="180" r="14" fill="#FFB74D" stroke="#2C2C2C" stroke-width="2"/><circle cx="76" cy="178" r="1.5" fill="#2C2C2C"/><circle cx="84" cy="178" r="1.5" fill="#2C2C2C"/><path id="lion-mouth" d="M 76 184 Q 80 188 84 184" stroke="#2C2C2C" stroke-width="1.5" fill="none"/></g>
    <g id="elephant"><ellipse cx="220" cy="200" rx="35" ry="22" fill="#90A4AE" stroke="#2C2C2C" stroke-width="2.5"/><circle cx="195" cy="190" r="18" fill="#90A4AE" stroke="#2C2C2C" stroke-width="2.5"/><path id="elephant-trunk" d="M 180 195 Q 168 205 172 220" stroke="#90A4AE" stroke-width="6" fill="none" stroke-linecap="round"/><circle id="elephant-eye" cx="190" cy="187" r="2" fill="#2C2C2C"/><ellipse id="elephant-ear" cx="208" cy="180" rx="8" ry="10" fill="#78909C" stroke="#2C2C2C" stroke-width="2"/></g>
    <g id="monkey"><ellipse cx="320" cy="200" rx="22" ry="18" fill="#8D6E63" stroke="#2C2C2C" stroke-width="2.5"/><circle cx="320" cy="180" r="14" fill="#8D6E63" stroke="#2C2C2C" stroke-width="2.5"/><circle cx="320" cy="184" r="9" fill="#FFCC80"/><circle cx="316" cy="180" r="1.5" fill="#2C2C2C"/><circle cx="324" cy="180" r="1.5" fill="#2C2C2C"/><path id="monkey-tail" d="M 340 200 Q 360 195 358 175" stroke="#8D6E63" stroke-width="4" fill="none" stroke-linecap="round"/></g>
    <g id="tree"><rect x="160" y="120" width="14" height="40" fill="#6D4C41" stroke="#2C2C2C" stroke-width="2"/><circle id="tree-leaf" cx="167" cy="115" r="20" fill="#43A047" stroke="#2C2C2C" stroke-width="2"/><circle id="tree-banana" cx="175" cy="120" r="3" fill="#FFEB3B" stroke="#2C2C2C" stroke-width="1"/></g>
    <g id="zoo-sign"><rect id="sign-board" x="280" y="100" width="60" height="30" fill="#FFCC80" stroke="#2C2C2C" stroke-width="2.5"/><text x="310" y="120" text-anchor="middle" font-size="14" font-weight="900" fill="#2C2C2C">동물원</text></g>
    <g id="cage"><line x1="240" y1="160" x2="240" y2="240" stroke="#2C2C2C" stroke-width="2"/><line x1="260" y1="160" x2="260" y2="240" stroke="#2C2C2C" stroke-width="2"/><line id="cage-bar3" x1="280" y1="160" x2="280" y2="240" stroke="#2C2C2C" stroke-width="2"/></g>
    <g id="bird"><path d="M 150 60 Q 158 52 166 60 Q 174 52 182 60" stroke="#2C2C2C" stroke-width="2.5" fill="none" stroke-linecap="round"/></g>
  </svg>`,
  diffs: [
    { cx: 80,  cy: 180, r: 25, type: 'attr',    id: 'lion-mane', name: 'fill', value: '#5D4037' },         // 사자 갈기
    { cx: 195, cy: 187, r: 8,  type: 'attr',    id: 'elephant-eye', name: 'r', value: '4' },               // 코끼리 눈 큼
    { cx: 175, cy: 215, r: 18, type: 'remove',  id: 'elephant-trunk' },                                     // 코 사라짐
    { cx: 358, cy: 185, r: 18, type: 'attr',    id: 'monkey-tail', name: 'stroke', value: '#FFD54F' },     // 원숭이 꼬리 노랑
    { cx: 167, cy: 115, r: 22, type: 'attr',    id: 'tree-leaf', name: 'fill', value: '#7C4DFF' },         // 나무 잎 보라
    { cx: 175, cy: 120, r: 8,  type: 'remove',  id: 'tree-banana' },                                        // 바나나 사라짐
    { cx: 60,  cy: 40,  r: 25, type: 'attr',    id: 'sun-c', name: 'fill', value: '#E53935' },             // 해 빨강
    { cx: 310, cy: 115, r: 30, type: 'attr',    id: 'sign-board', name: 'fill', value: '#43A047' },        // 간판 초록
    { cx: 280, cy: 200, r: 8,  type: 'remove',  id: 'cage-bar3' },                                          // 우리 봉 사라짐
    { cx: 208, cy: 180, r: 12, type: 'attr',    id: 'elephant-ear', name: 'rx', value: '14' },             // 귀 큼
    { cx: 80,  cy: 184, r: 8,  type: 'attr',    id: 'lion-mouth', name: 'd', value: 'M 76 188 Q 80 184 84 188' } // 사자 입
  ]
});

// === Theme 7: 🏯 한옥마을 ===
THEMES.push({
  id: 'hanok', name: '한옥', emoji: '🏯',
  imageA_svg: `<svg viewBox="0 0 400 250" xmlns="http://www.w3.org/2000/svg">
    <rect width="400" height="160" fill="#E1BEE7"/>
    <rect y="160" width="400" height="90" fill="#8D6E63"/>
    <g id="moon"><circle id="moon-c" cx="320" cy="50" r="22" fill="#FFF59D" stroke="#2C2C2C" stroke-width="2.5"/></g>
    <g id="hanok-bldg"><rect id="hanok-wall" x="100" y="130" width="200" height="60" fill="#FFE0B2" stroke="#2C2C2C" stroke-width="2.5"/><polygon id="hanok-roof" points="80,130 200,80 320,130" fill="#5D4037" stroke="#2C2C2C" stroke-width="2.5"/><path d="M 80 130 Q 100 145 120 130" stroke="#3E2723" stroke-width="2" fill="none"/><path d="M 280 130 Q 300 145 320 130" stroke="#3E2723" stroke-width="2" fill="none"/><rect id="hanok-door-l" x="140" y="150" width="30" height="40" fill="#5D4037" stroke="#2C2C2C" stroke-width="2"/><rect id="hanok-door-r" x="230" y="150" width="30" height="40" fill="#5D4037" stroke="#2C2C2C" stroke-width="2"/><rect x="180" y="150" width="40" height="40" fill="#FFCC80" stroke="#2C2C2C" stroke-width="2.5"/></g>
    <g id="lantern1"><line x1="120" y1="100" x2="120" y2="115" stroke="#2C2C2C" stroke-width="2"/><ellipse id="lantern1-body" cx="120" cy="125" rx="10" ry="14" fill="#E53935" stroke="#2C2C2C" stroke-width="2.5"/></g>
    <g id="lantern2"><line x1="280" y1="100" x2="280" y2="115" stroke="#2C2C2C" stroke-width="2"/><ellipse id="lantern2-body" cx="280" cy="125" rx="10" ry="14" fill="#E53935" stroke="#2C2C2C" stroke-width="2.5"/></g>
    <g id="hanbok"><circle cx="60" cy="200" r="9" fill="#FFE0B2" stroke="#2C2C2C" stroke-width="2"/><polygon id="hanbok-skirt" points="42,209 78,209 80,240 40,240" fill="#7C4DFF" stroke="#2C2C2C" stroke-width="2.5"/><rect x="55" y="209" width="10" height="10" fill="#fff" stroke="#2C2C2C" stroke-width="1.5"/></g>
    <g id="jangdok"><ellipse id="jangdok-c" cx="350" cy="220" rx="15" ry="18" fill="#5D4037" stroke="#2C2C2C" stroke-width="2.5"/><ellipse cx="350" cy="206" rx="12" ry="3" fill="#3E2723"/></g>
    <g id="bamboo"><line x1="370" y1="240" x2="370" y2="160" stroke="#43A047" stroke-width="4"/><line x1="385" y1="240" x2="385" y2="170" stroke="#43A047" stroke-width="4"/><ellipse id="bamboo-leaf" cx="370" cy="170" rx="10" ry="3" fill="#43A047" transform="rotate(20 370 170)"/></g>
    <g id="cloud-w"><ellipse cx="100" cy="50" rx="25" ry="13" fill="#fff" stroke="#2C2C2C" stroke-width="2"/></g>
  </svg>`,
  diffs: [
    { cx: 200, cy: 105, r: 35, type: 'attr',    id: 'hanok-roof', name: 'fill', value: '#1976D2' },        // 지붕 파랑
    { cx: 120, cy: 125, r: 14, type: 'attr',    id: 'lantern1-body', name: 'fill', value: '#FFD54F' },     // 등 노랑
    { cx: 280, cy: 130, r: 14, type: 'remove',  id: 'lantern2-body' },                                      // 등 사라짐
    { cx: 60,  cy: 220, r: 22, type: 'attr',    id: 'hanbok-skirt', name: 'fill', value: '#E53935' },      // 한복 빨강
    { cx: 350, cy: 220, r: 18, type: 'attr',    id: 'jangdok-c', name: 'fill', value: '#43A047' },         // 장독 초록
    { cx: 320, cy: 50,  r: 25, type: 'attr',    id: 'moon-c', name: 'fill', value: '#FF7043' },            // 달 주황
    { cx: 200, cy: 160, r: 30, type: 'attr',    id: 'hanok-wall', name: 'fill', value: '#FFCDD2' },        // 벽 분홍
    { cx: 100, cy: 50,  r: 28, type: 'remove',  id: 'cloud-w' },                                            // 구름 사라짐
    { cx: 245, cy: 170, r: 15, type: 'attr',    id: 'hanok-door-r', name: 'fill', value: '#FFD54F' },      // 오른쪽 문 노랑
    { cx: 370, cy: 170, r: 12, type: 'remove',  id: 'bamboo-leaf' },                                        // 대나무 잎
    { cx: 155, cy: 170, r: 15, type: 'attr',    id: 'hanok-door-l', name: 'fill', value: '#1976D2' }        // 왼쪽 문 파랑
  ]
});

// === Theme 8: 🛒 슈퍼마켓 ===
THEMES.push({
  id: 'market', name: '슈퍼', emoji: '🛒',
  imageA_svg: `<svg viewBox="0 0 400 250" xmlns="http://www.w3.org/2000/svg">
    <rect width="400" height="250" fill="#FFE0B2"/>
    <rect x="0" y="220" width="400" height="30" fill="#A5D6A7"/>
    <g id="cart"><rect id="cart-body" x="50" y="160" width="80" height="40" fill="#90A4AE" stroke="#2C2C2C" stroke-width="2.5"/><line x1="50" y1="170" x2="130" y2="170" stroke="#2C2C2C" stroke-width="1.5"/><line x1="50" y1="180" x2="130" y2="180" stroke="#2C2C2C" stroke-width="1.5"/><line x1="50" y1="190" x2="130" y2="190" stroke="#2C2C2C" stroke-width="1.5"/><circle id="cart-wheel-l" cx="65" cy="210" r="8" fill="#2C2C2C"/><circle id="cart-wheel-r" cx="115" cy="210" r="8" fill="#2C2C2C"/><line x1="130" y1="160" x2="145" y2="145" stroke="#2C2C2C" stroke-width="3"/></g>
    <g id="shelf"><rect id="shelf-bg" x="180" y="80" width="200" height="120" fill="#fff" stroke="#2C2C2C" stroke-width="2.5"/><line x1="180" y1="120" x2="380" y2="120" stroke="#2C2C2C" stroke-width="2"/><line x1="180" y1="160" x2="380" y2="160" stroke="#2C2C2C" stroke-width="2"/><circle id="apple1" cx="200" cy="105" r="10" fill="#E53935" stroke="#2C2C2C" stroke-width="2"/><circle id="apple2" cx="225" cy="105" r="10" fill="#E53935" stroke="#2C2C2C" stroke-width="2"/><circle id="apple3" cx="250" cy="105" r="10" fill="#E53935" stroke="#2C2C2C" stroke-width="2"/><rect id="milk" x="280" y="92" width="22" height="26" fill="#fff" stroke="#2C2C2C" stroke-width="2"/><polygon points="280,92 291,82 302,92" fill="#fff" stroke="#2C2C2C" stroke-width="2"/><rect id="bread" x="320" y="95" width="40" height="22" rx="11" fill="#FFCC80" stroke="#2C2C2C" stroke-width="2"/><circle id="orange1" cx="200" cy="145" r="10" fill="#FF9800" stroke="#2C2C2C" stroke-width="2"/><circle id="orange2" cx="225" cy="145" r="10" fill="#FF9800" stroke="#2C2C2C" stroke-width="2"/><rect id="juice" x="270" y="130" width="20" height="28" fill="#FFD54F" stroke="#2C2C2C" stroke-width="2"/><rect id="cookie" x="310" y="135" width="40" height="20" fill="#A1887F" stroke="#2C2C2C" stroke-width="2"/><rect id="cheese" x="200" y="172" width="30" height="24" fill="#FFEB3B" stroke="#2C2C2C" stroke-width="2"/><rect id="meat" x="270" y="172" width="30" height="24" fill="#EF5350" stroke="#2C2C2C" stroke-width="2"/></g>
    <g id="sign"><rect id="sign-r" x="50" y="40" width="120" height="30" fill="#E53935" stroke="#2C2C2C" stroke-width="2.5"/><text x="110" y="62" text-anchor="middle" font-size="20" font-weight="900" fill="#fff">슈퍼</text></g>
    <g id="customer"><circle cx="160" cy="150" r="9" fill="#FFE0B2" stroke="#2C2C2C" stroke-width="2"/><rect id="cust-shirt" x="152" y="159" width="16" height="22" fill="#7C4DFF" stroke="#2C2C2C" stroke-width="2"/></g>
  </svg>`,
  diffs: [
    { cx: 110, cy: 55,  r: 35, type: 'attr',    id: 'sign-r', name: 'fill', value: '#1976D2' },           // 간판 파랑
    { cx: 65,  cy: 210, r: 12, type: 'attr',    id: 'cart-wheel-l', name: 'fill', value: '#E53935' },     // 카트 바퀴
    { cx: 250, cy: 105, r: 12, type: 'remove',  id: 'apple3' },                                            // 사과 사라짐
    { cx: 215, cy: 184, r: 18, type: 'attr',    id: 'cheese', name: 'fill', value: '#FF9800' },           // 치즈 주황
    { cx: 280, cy: 145, r: 12, type: 'attr',    id: 'juice', name: 'fill', value: '#43A047' },            // 주스 초록
    { cx: 160, cy: 170, r: 12, type: 'attr',    id: 'cust-shirt', name: 'fill', value: '#FFC107' },       // 손님 옷
    { cx: 285, cy: 200, r: 18, type: 'attr',    id: 'meat', name: 'fill', value: '#7C4DFF' },             // 고기 보라
    { cx: 280, cy: 105, r: 14, type: 'remove',  id: 'milk' },                                              // 우유 사라짐
    { cx: 90,  cy: 180, r: 35, type: 'attr',    id: 'cart-body', name: 'fill', value: '#FFD54F' },        // 카트 노랑
    { cx: 330, cy: 145, r: 22, type: 'attr',    id: 'cookie', name: 'fill', value: '#5D4037' },           // 쿠키 갈색
    { cx: 280, cy: 80,  r: 80, type: 'attr',    id: 'shelf-bg', name: 'fill', value: '#FFE0B2' }          // 진열대 색
  ]
});

// === Theme 9: ⛺ 캠핑 ===
THEMES.push({
  id: 'camp', name: '캠핑', emoji: '⛺',
  imageA_svg: `<svg viewBox="0 0 400 250" xmlns="http://www.w3.org/2000/svg">
    <rect width="400" height="160" fill="#1A237E"/>
    <rect y="160" width="400" height="90" fill="#558B2F"/>
    <g id="moon"><circle id="moon-c" cx="80" cy="50" r="20" fill="#FFF59D" stroke="#2C2C2C" stroke-width="2.5"/></g>
    <g id="stars"><circle id="star1" cx="160" cy="40" r="2" fill="#fff"/><circle id="star2" cx="240" cy="60" r="2.5" fill="#fff"/><circle cx="300" cy="40" r="2" fill="#fff"/><circle id="star4" cx="350" cy="80" r="2" fill="#fff"/><circle cx="200" cy="100" r="1.5" fill="#fff"/></g>
    <g id="tent"><polygon id="tent-body" points="100,200 180,120 260,200" fill="#FF9800" stroke="#2C2C2C" stroke-width="2.5"/><polygon id="tent-door" points="160,200 180,150 200,200" fill="#5D4037" stroke="#2C2C2C" stroke-width="2"/><rect id="tent-flag" x="178" y="118" width="3" height="20" fill="#2C2C2C"/><polygon points="181,120 200,120 200,128 181,128" fill="#E53935" stroke="#2C2C2C" stroke-width="1.5"/></g>
    <g id="campfire"><polygon id="fire-flame" points="320,210 310,180 320,190 330,170 340,190 350,180 340,210" fill="#FF5722" stroke="#2C2C2C" stroke-width="2"/><polygon points="318,210 322,195 326,210" fill="#FFEB3B"/><line x1="305" y1="220" x2="345" y2="220" stroke="#5D4037" stroke-width="4"/><line x1="310" y1="225" x2="340" y2="218" stroke="#5D4037" stroke-width="3"/></g>
    <g id="log"><ellipse id="log-c" cx="60" cy="225" rx="22" ry="6" fill="#8D6E63" stroke="#2C2C2C" stroke-width="2.5"/></g>
    <g id="tree-pine"><polygon id="pine-top" points="350,190 340,160 360,160" fill="#2E7D32" stroke="#2C2C2C" stroke-width="2"/><polygon id="pine-mid" points="350,180 335,150 365,150" fill="#388E3C" stroke="#2C2C2C" stroke-width="2"/><polygon points="350,170 330,140 370,140" fill="#43A047" stroke="#2C2C2C" stroke-width="2"/><rect x="347" y="190" width="6" height="10" fill="#5D4037"/></g>
    <g id="lantern"><line x1="280" y1="200" x2="280" y2="220" stroke="#2C2C2C" stroke-width="2"/><circle id="lantern-c" cx="280" cy="190" r="9" fill="#FFEB3B" stroke="#2C2C2C" stroke-width="2.5"/></g>
    <g id="bag"><rect id="bag-c" x="220" y="210" width="22" height="25" fill="#7C4DFF" stroke="#2C2C2C" stroke-width="2.5"/><line x1="225" y1="215" x2="237" y2="215" stroke="#fff" stroke-width="1.5"/></g>
    <g id="marshmallow"><circle id="marsh" cx="290" cy="200" r="5" fill="#fff" stroke="#2C2C2C" stroke-width="1.5"/><line x1="290" y1="205" x2="285" y2="225" stroke="#5D4037" stroke-width="1.5"/></g>
  </svg>`,
  diffs: [
    { cx: 180, cy: 160, r: 35, type: 'attr',    id: 'tent-body', name: 'fill', value: '#43A047' },        // 텐트 초록
    { cx: 330, cy: 195, r: 25, type: 'remove',  id: 'fire-flame' },                                        // 모닥불 사라짐
    { cx: 80,  cy: 50,  r: 22, type: 'attr',    id: 'moon-c', name: 'fill', value: '#E1BEE7' },           // 달 보라
    { cx: 280, cy: 190, r: 12, type: 'attr',    id: 'lantern-c', name: 'fill', value: '#FF7043' },        // 랜턴 주황
    { cx: 240, cy: 60,  r: 8,  type: 'remove',  id: 'star2' },                                             // 별 사라짐
    { cx: 60,  cy: 225, r: 22, type: 'attr',    id: 'log-c', name: 'fill', value: '#5D4037' },            // 통나무 색
    { cx: 350, cy: 175, r: 20, type: 'attr',    id: 'pine-top', name: 'fill', value: '#FFD54F' },         // 소나무 끝 노랑
    { cx: 230, cy: 220, r: 18, type: 'attr',    id: 'bag-c', name: 'fill', value: '#E53935' },            // 가방 빨강
    { cx: 290, cy: 200, r: 8,  type: 'remove',  id: 'marsh' },                                             // 마시멜로 사라짐
    { cx: 350, cy: 80,  r: 8,  type: 'remove',  id: 'star4' },                                             // 별 사라짐
    { cx: 350, cy: 155, r: 18, type: 'attr',    id: 'pine-mid', name: 'fill', value: '#1976D2' }          // 소나무 중간 파랑
  ]
});

// === Theme 10: 🚜 농장 ===
THEMES.push({
  id: 'farm', name: '농장', emoji: '🚜',
  imageA_svg: `<svg viewBox="0 0 400 250" xmlns="http://www.w3.org/2000/svg">
    <rect width="400" height="160" fill="#B3E5FC"/>
    <rect y="160" width="400" height="90" fill="#A5D6A7"/>
    <g id="sun"><circle id="sun-c" cx="60" cy="40" r="22" fill="#FFD54F" stroke="#2C2C2C" stroke-width="2.5"/></g>
    <g id="barn"><rect id="barn-body" x="200" y="120" width="120" height="80" fill="#D32F2F" stroke="#2C2C2C" stroke-width="2.5"/><polygon id="barn-roof" points="195,120 260,80 325,120" fill="#5D4037" stroke="#2C2C2C" stroke-width="2.5"/><rect id="barn-door" x="245" y="160" width="30" height="40" fill="#5D4037" stroke="#2C2C2C" stroke-width="2.5"/><line x1="245" y1="180" x2="275" y2="180" stroke="#fff" stroke-width="2"/><rect x="215" y="135" width="20" height="20" fill="#fff" stroke="#2C2C2C" stroke-width="2"/><line x1="225" y1="135" x2="225" y2="155" stroke="#2C2C2C" stroke-width="1.5"/><line x1="215" y1="145" x2="235" y2="145" stroke="#2C2C2C" stroke-width="1.5"/></g>
    <g id="tractor"><rect id="tractor-body" x="60" y="170" width="50" height="25" fill="#43A047" stroke="#2C2C2C" stroke-width="2.5"/><rect x="65" y="160" width="25" height="15" fill="#fff" stroke="#2C2C2C" stroke-width="2"/><circle id="tractor-wheel-r" cx="100" cy="200" r="14" fill="#2C2C2C"/><circle cx="100" cy="200" r="6" fill="#9E9E9E"/><circle id="tractor-wheel-l" cx="65" cy="205" r="9" fill="#2C2C2C"/><circle cx="65" cy="205" r="4" fill="#9E9E9E"/></g>
    <g id="chicken"><ellipse cx="160" cy="225" rx="10" ry="8" fill="#fff" stroke="#2C2C2C" stroke-width="2"/><circle cx="155" cy="218" r="6" fill="#fff" stroke="#2C2C2C" stroke-width="2"/><polygon id="chicken-comb" points="153,213 155,210 157,213" fill="#E53935"/><polygon id="chicken-beak" points="148,219 144,221 148,222" fill="#FF9800"/></g>
    <g id="corn1"><line x1="350" y1="240" x2="350" y2="200" stroke="#388E3C" stroke-width="2"/><ellipse id="corn1-c" cx="350" cy="195" rx="6" ry="14" fill="#FFD54F" stroke="#2C2C2C" stroke-width="2"/></g>
    <g id="corn2"><line x1="370" y1="240" x2="370" y2="205" stroke="#388E3C" stroke-width="2"/><ellipse id="corn2-c" cx="370" cy="200" rx="6" ry="14" fill="#FFD54F" stroke="#2C2C2C" stroke-width="2"/></g>
    <g id="corn3"><line x1="335" y1="240" x2="335" y2="208" stroke="#388E3C" stroke-width="2"/><ellipse id="corn3-c" cx="335" cy="203" rx="6" ry="14" fill="#FFD54F" stroke="#2C2C2C" stroke-width="2"/></g>
    <g id="cloud"><ellipse cx="150" cy="50" rx="25" ry="13" fill="#fff" stroke="#2C2C2C" stroke-width="2"/></g>
    <g id="pig"><ellipse id="pig-body" cx="180" cy="225" rx="18" ry="11" fill="#FF80AB" stroke="#2C2C2C" stroke-width="2.5"/><circle cx="195" cy="220" r="9" fill="#FF80AB" stroke="#2C2C2C" stroke-width="2"/><circle id="pig-eye" cx="197" cy="218" r="1.5" fill="#2C2C2C"/><ellipse cx="201" cy="222" rx="3" ry="2" fill="#FFC1E3" stroke="#2C2C2C" stroke-width="1"/></g>
  </svg>`,
  diffs: [
    { cx: 260, cy: 160, r: 60, type: 'attr',    id: 'barn-body', name: 'fill', value: '#1976D2' },         // 헛간 파랑
    { cx: 100, cy: 200, r: 18, type: 'attr',    id: 'tractor-wheel-r', name: 'fill', value: '#FF7043' },   // 트랙터 바퀴
    { cx: 80,  cy: 180, r: 30, type: 'attr',    id: 'tractor-body', name: 'fill', value: '#FFD54F' },      // 트랙터 노랑
    { cx: 350, cy: 195, r: 14, type: 'attr',    id: 'corn1-c', name: 'fill', value: '#FF7043' },           // 옥수수 주황
    { cx: 335, cy: 220, r: 18, type: 'remove',  id: 'corn3' },                                              // 옥수수 사라짐
    { cx: 155, cy: 213, r: 8,  type: 'remove',  id: 'chicken-comb' },                                       // 닭벼슬 사라짐
    { cx: 148, cy: 220, r: 8,  type: 'attr',    id: 'chicken-beak', name: 'fill', value: '#E53935' },      // 닭부리 빨강
    { cx: 180, cy: 220, r: 22, type: 'attr',    id: 'pig-body', name: 'fill', value: '#FFCC80' },          // 돼지 색
    { cx: 197, cy: 218, r: 6,  type: 'attr',    id: 'pig-eye', name: 'r', value: '4' },                    // 돼지 눈 큼
    { cx: 60,  cy: 40,  r: 25, type: 'attr',    id: 'sun-c', name: 'fill', value: '#FF7043' },             // 해 주황
    { cx: 260, cy: 100, r: 35, type: 'attr',    id: 'barn-roof', name: 'fill', value: '#1565C0' }           // 지붕 파랑
  ]
});

// ── Sound Manager ────────────────────────────────────────────
const sound = createSoundManager({
  ding(ctx) { [523, 659, 784].forEach((f, i) => { const o = ctx.createOscillator(); const g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.type = 'sine'; const t = ctx.currentTime + i * 0.08; o.frequency.setValueAtTime(f, t); g.gain.setValueAtTime(0.32, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3); o.start(t); o.stop(t + 0.32); }); },
  buzz(ctx) { const o = ctx.createOscillator(); const g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.type = 'sawtooth'; o.frequency.setValueAtTime(180, ctx.currentTime); g.gain.setValueAtTime(0.2, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15); o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.15); },
  tick(ctx) { const o = ctx.createOscillator(); const g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.type = 'square'; o.frequency.setValueAtTime(880, ctx.currentTime); g.gain.setValueAtTime(0.12, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08); o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.08); },
  timeout(ctx) { const o = ctx.createOscillator(); const g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.type = 'triangle'; o.frequency.setValueAtTime(160, ctx.currentTime); g.gain.setValueAtTime(0.4, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5); o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.5); },
  fanfare(ctx) { [392, 494, 523, 659, 784].forEach((f, i) => { const o = ctx.createOscillator(); const g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.type = 'triangle'; const t = ctx.currentTime + i * 0.12; o.frequency.setValueAtTime(f, t); g.gain.setValueAtTime(0.3, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.38); o.start(t); o.stop(t + 0.38); }); },
});

// ── State ────────────────────────────────────────────────────
let playerCount = 2;
let selectedThemeIdx = 0;
let roundIdx = 0;
let scores = [];
let roundResults = [];
let zoneFoundIds = []; // each player: Set of found diff indices
let zoneSolved = [];
let phase = 'idle';
let timerHandle = null, nextHandle = null;
let timeRemaining = 60;

// ── DOM refs ─────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const introScreen = $('introScreen'), countdownScreen = $('countdownScreen'), countdownNumber = $('countdownNumber');
const gameScreen = $('gameScreen'), resultScreen = $('resultScreen');
const backBtn = $('backBtn'), playBtn = $('playBtn'), closeBtn = $('closeBtn'), retryBtn = $('retryBtn'), homeBtn = $('homeBtn');
const zonesWrap = $('zonesWrap'), questionCounter = $('questionCounter'), problemTimer = $('problemTimer'), problemStatus = $('problemStatus'), scoreBar = $('scoreBar');
const soundToggleIntro = $('soundToggleIntro');
const themeGrid = $('themeGrid');
const resultTitle = $('resultTitle'), resultWinner = $('resultWinner'), totalRow = $('totalRow');

// ── Helpers ──────────────────────────────────────────────────
function showScreen(s) { [introScreen, countdownScreen, gameScreen, resultScreen].forEach(x => x.classList.remove('active')); s.classList.add('active'); }
let countdownInterval = null;
function startPreGameCountdown(onDone) {
  showScreen(countdownScreen);
  let count = 3; countdownNumber.textContent = count;
  countdownInterval = setInterval(() => { count--; if (count <= 0) { clearInterval(countdownInterval); countdownInterval = null; onDone(); } else { countdownNumber.textContent = count; countdownNumber.style.animation = 'none'; countdownNumber.offsetHeight; countdownNumber.style.animation = ''; } }, 1000);
}
function clearTimers() { if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; } if (timerHandle) { clearInterval(timerHandle); timerHandle = null; } if (nextHandle) { clearTimeout(nextHandle); nextHandle = null; } }
function updateSoundBtn(btn) { btn.textContent = sound.isMuted() ? '🔇' : '🔊'; }

// imageA SVG에 첫 N개 diff를 적용해 imageB SVG 문자열 반환
function buildImageB(theme, numDiffs) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(theme.imageA_svg, 'image/svg+xml');
  for (let i = 0; i < numDiffs && i < theme.diffs.length; i++) {
    applyDiff(doc, theme.diffs[i]);
  }
  return new XMLSerializer().serializeToString(doc.documentElement);
}
function applyDiff(doc, diff) {
  if (diff.type === 'remove') {
    const el = doc.getElementById(diff.id);
    if (el) el.remove();
  } else if (diff.type === 'attr') {
    const el = doc.getElementById(diff.id);
    if (el) el.setAttribute(diff.name, diff.value);
  } else if (diff.type === 'add') {
    doc.documentElement.insertAdjacentHTML('beforeend', diff.html);
  } else if (diff.type === 'replace') {
    const el = doc.getElementById(diff.id);
    if (el) el.outerHTML = diff.html;
  }
}

// ── Theme grid (intro) ──────────────────────────────────────
function renderThemeGrid() {
  themeGrid.innerHTML = '';
  THEMES.forEach((th, i) => {
    const btn = document.createElement('button');
    btn.className = 'theme-btn' + (i === selectedThemeIdx ? ' active' : '');
    btn.dataset.idx = i;
    btn.innerHTML = `<span class="theme-emoji">${th.emoji}</span><span>${th.name}</span>`;
    onTap(btn, () => {
      selectedThemeIdx = i;
      themeGrid.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
    themeGrid.appendChild(btn);
  });
}
renderThemeGrid();

// ── Build zones ──────────────────────────────────────────────
function buildZones() {
  zonesWrap.innerHTML = '';
  zonesWrap.className = `zones-wrap p${playerCount}`;
  for (let i = 0; i < playerCount; i++) {
    const cfg = PLAYER_CONFIG[i];
    const zone = document.createElement('div');
    zone.className = `zone ${cfg.cls}`;
    zone.dataset.player = i;
    zone.innerHTML = `<div class="zone-header"><span class="zone-label">${cfg.label}</span><span class="zone-progress" id="prog-${i}">0/0</span></div>
      <div class="images-stack">
        <div class="scene-frame"><span class="scene-label">A</span><div class="scene-svg" id="sceneA-${i}"></div></div>
        <div class="scene-frame"><span class="scene-label">B</span><div class="scene-svg" id="sceneB-${i}"></div></div>
      </div>`;
    zonesWrap.appendChild(zone);
  }
}
function getZone(idx) { return zonesWrap.querySelector(`.zone[data-player="${idx}"]`); }

function renderRound(playerIdx) {
  const theme = THEMES[selectedThemeIdx];
  const numDiffs = ROUND_DIFFS[roundIdx];
  const sceneAEl = $(`sceneA-${playerIdx}`);
  const sceneBEl = $(`sceneB-${playerIdx}`);
  if (!sceneAEl || !sceneBEl) return;
  // imageA는 그대로 + clickable overlay 추가
  sceneAEl.innerHTML = wrapClickable(theme.imageA_svg, playerIdx, 'A');
  sceneBEl.innerHTML = wrapClickable(buildImageB(theme, numDiffs), playerIdx, 'B');
  // 클릭 핸들러
  [sceneAEl, sceneBEl].forEach(el => {
    const svg = el.querySelector('svg');
    if (svg) svg.addEventListener('click', e => handleSceneTap(playerIdx, svg, e));
  });
  updateProgressChip(playerIdx);
}
function wrapClickable(svgString, playerIdx, label) {
  // 이미 svg 문자열, 그대로 사용
  return svgString;
}
function updateProgressChip(playerIdx) {
  const el = $(`prog-${playerIdx}`);
  if (el) el.textContent = `${zoneFoundIds[playerIdx].size}/${ROUND_DIFFS[roundIdx]}`;
}

// SVG 좌표로 변환 (viewBox 기준)
function svgPoint(svg, evt) {
  const rect = svg.getBoundingClientRect();
  const vb = svg.viewBox.baseVal;
  const x = (evt.clientX - rect.left) * (vb.width / rect.width);
  const y = (evt.clientY - rect.top) * (vb.height / rect.height);
  return { x, y };
}

function handleSceneTap(playerIdx, svg, evt) {
  if (phase !== 'active' || zoneSolved[playerIdx]) return;
  const theme = THEMES[selectedThemeIdx];
  const numDiffs = ROUND_DIFFS[roundIdx];
  const pt = svgPoint(svg, evt);

  let hitIdx = -1;
  for (let i = 0; i < numDiffs; i++) {
    if (zoneFoundIds[playerIdx].has(i)) continue;
    const d = theme.diffs[i];
    const dist = Math.hypot(pt.x - d.cx, pt.y - d.cy);
    if (dist <= d.r) { hitIdx = i; break; }
  }

  if (hitIdx >= 0) {
    zoneFoundIds[playerIdx].add(hitIdx);
    sound.play('ding');
    // 두 그림 모두 마커 표시
    const diff = theme.diffs[hitIdx];
    [`sceneA-${playerIdx}`, `sceneB-${playerIdx}`].forEach(scid => {
      const sv = $(scid)?.querySelector('svg');
      if (!sv) return;
      const ns = 'http://www.w3.org/2000/svg';
      const c = document.createElementNS(ns, 'circle');
      c.setAttribute('cx', diff.cx);
      c.setAttribute('cy', diff.cy);
      c.setAttribute('r', diff.r * 0.85);
      c.setAttribute('fill', 'none');
      c.setAttribute('stroke', '#4CAF50');
      c.setAttribute('stroke-width', '4');
      c.setAttribute('class', 'found-marker');
      sv.appendChild(c);
    });
    updateProgressChip(playerIdx);
    if (zoneFoundIds[playerIdx].size === numDiffs) handleSolve(playerIdx);
  } else {
    sound.play('buzz');
    const ns = 'http://www.w3.org/2000/svg';
    const x = document.createElementNS(ns, 'text');
    x.setAttribute('x', pt.x); x.setAttribute('y', pt.y + 7);
    x.setAttribute('text-anchor', 'middle');
    x.setAttribute('font-size', '24'); x.setAttribute('font-weight', '900');
    x.setAttribute('fill', '#E53935');
    x.setAttribute('class', 'wrong-marker');
    x.textContent = '✗';
    svg.appendChild(x);
    setTimeout(() => x.remove(), 500);
  }
}

function handleSolve(winnerIdx) {
  if (zoneSolved[winnerIdx]) return;
  zoneSolved[winnerIdx] = true;
  const zone = getZone(winnerIdx);
  zone.classList.add('solved');
  if (roundResults.length === roundIdx) {
    roundResults.push({ winnerIdx, timedOut: false });
    scores[winnerIdx]++;
    updateBarScore(winnerIdx);
    sound.play('ding');
    problemStatus.textContent = `${PLAYER_CONFIG[winnerIdx].label} 승리!`;
    for (let i = 0; i < playerCount; i++) if (i !== winnerIdx && !zoneSolved[i]) getZone(i).classList.add('locked');
    phase = 'done';
    clearTimers();
    nextHandle = setTimeout(() => nextRound(), RESULT_PAUSE_MS);
  }
}

function buildScoreBar() {
  scoreBar.innerHTML = '';
  for (let i = 0; i < playerCount; i++) {
    const cfg = PLAYER_CONFIG[i];
    const chip = document.createElement('div');
    chip.className = 'score-chip';
    chip.innerHTML = `<span class="score-chip-dot" style="background:${cfg.dot}"></span><span>${cfg.label}</span><span class="score-chip-val" id="bar-score-${i}">0</span>`;
    scoreBar.appendChild(chip);
  }
}
function updateBarScore(idx) { const el = $(`bar-score-${idx}`); if (el) el.textContent = scores[idx]; }

function startCountdown() {
  timeRemaining = ROUND_TIMES[roundIdx];
  problemTimer.textContent = timeRemaining;
  problemTimer.classList.remove('urgent');
  timerHandle = setInterval(() => {
    timeRemaining--;
    problemTimer.textContent = timeRemaining;
    if (timeRemaining <= 5) { problemTimer.classList.add('urgent'); sound.play('tick'); }
    if (timeRemaining <= 0) { clearTimers(); handleTimeout(); }
  }, 1000);
}
function handleTimeout() {
  if (phase !== 'active') return;
  phase = 'done';
  sound.play('timeout');
  // 가장 많이 찾은 사람이 승
  let bestIdx = -1, bestCount = -1;
  for (let i = 0; i < playerCount; i++) {
    if (zoneFoundIds[i].size > bestCount) { bestCount = zoneFoundIds[i].size; bestIdx = i; }
  }
  // 동점이면 무승부
  let tieCount = 0;
  for (let i = 0; i < playerCount; i++) if (zoneFoundIds[i].size === bestCount) tieCount++;
  if (tieCount === 1 && bestCount > 0) {
    roundResults.push({ winnerIdx: bestIdx, timedOut: true });
    scores[bestIdx]++;
    updateBarScore(bestIdx);
    problemStatus.textContent = `시간 초과! ${PLAYER_CONFIG[bestIdx].label} 승 (${bestCount}개 찾음)`;
  } else {
    roundResults.push({ winnerIdx: -1, timedOut: true });
    problemStatus.textContent = `시간 초과! 무승부 (${bestCount}개)`;
  }
  for (let i = 0; i < playerCount; i++) if (!zoneSolved[i]) getZone(i).classList.add('locked');
  nextHandle = setTimeout(() => nextRound(), RESULT_PAUSE_MS);
}

function loadRound() {
  phase = 'active';
  zoneFoundIds = []; zoneSolved = [];
  for (let i = 0; i < playerCount; i++) {
    zoneFoundIds.push(new Set());
    zoneSolved.push(false);
    const zone = getZone(i);
    if (zone) zone.classList.remove('solved', 'locked');
    renderRound(i);
  }
  questionCounter.textContent = `${roundIdx + 1} / ${TOTAL_ROUNDS}`;
  problemStatus.textContent = `${THEMES[selectedThemeIdx].name} · 차이 ${ROUND_DIFFS[roundIdx]}곳!`;
  startCountdown();
}
function nextRound() { roundIdx++; if (roundIdx >= TOTAL_ROUNDS) showResult(); else loadRound(); }
function startGame() {
  roundIdx = 0; scores = new Array(playerCount).fill(0); roundResults = []; phase = 'idle';
  clearTimers(); buildZones(); buildScoreBar();
  showScreen(gameScreen);
  loadRound();
}
function showResult() {
  clearTimers(); phase = 'idle'; sound.play('fanfare');
  const max = Math.max(...scores);
  const winners = scores.map((s, i) => ({ s, i })).filter(x => x.s === max).map(x => x.i);
  if (max === 0) { resultTitle.textContent = '무승부!'; resultWinner.textContent = '아무도 라운드를 이기지 못했어요.'; }
  else if (winners.length === 1) { resultTitle.textContent = '게임 종료!'; resultWinner.textContent = `${PLAYER_CONFIG[winners[0]].label} 우승! (${max}승)`; }
  else { const labels = winners.map(w => PLAYER_CONFIG[w].label).join(', '); resultTitle.textContent = '동점!'; resultWinner.textContent = `${labels} 공동 1위! (${max}승)`; }
  totalRow.innerHTML = '';
  for (let i = 0; i < playerCount; i++) {
    const cfg = PLAYER_CONFIG[i]; const isWin = winners.includes(i);
    const chip = document.createElement('div'); chip.className = 'total-chip';
    chip.innerHTML = `<span class="chip-dot" style="background:${cfg.dot}"></span><span>${cfg.label}</span><span class="chip-score" style="color:${isWin ? '#2E7D32' : '#555'}">${scores[i]}승</span>${isWin ? '<span style="font-size:1.1rem;">★</span>' : ''}`;
    totalRow.appendChild(chip);
  }
  showScreen(resultScreen);
}

document.querySelectorAll('.player-btn').forEach(btn => onTap(btn, () => { document.querySelectorAll('.player-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); playerCount = parseInt(btn.dataset.count, 10); }));
onTap(soundToggleIntro, () => { sound.toggleMute(); updateSoundBtn(soundToggleIntro); }); updateSoundBtn(soundToggleIntro);
onTap(backBtn, () => goHome());
onTap(closeBtn, () => { clearTimers(); goHome(); });
onTap(homeBtn, () => goHome());
onTap(retryBtn, () => startPreGameCountdown(() => startGame()));
onTap(playBtn, () => startPreGameCountdown(() => startGame()));
