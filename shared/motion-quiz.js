/* Shared round flow for the classroom and assembly games. */
'use strict';

function startMotionQuiz({ rounds, movement, saveScore }) {
  const ROUND_COUNT = 5;
  const MOVE_SECONDS = 5;
  const ANSWER_SECONDS = 8;
  const REVEAL_MS = 4000;
  const TEAM_COLORS = ['#7DD3FC', '#FBBF77', '#86EFAC', '#D8B4FE'];
  const SCREENS = [...document.querySelectorAll('.motion-quiz .screen')];
  const get = id => document.getElementById(id);
  const scene = get('roundScene');
  const teams = get('teamChoices');
  const phaseLabel = get('phaseLabel');
  const phaseTime = get('phaseTime');

  let playerCount = 2;
  let mode = 'desk';
  let phase = 'intro';
  let deck = [];
  let currentRound = 0;
  let scores = [];
  let picks = [];
  let timer;
  let revealTimeout;

  function showScreen(id) {
    SCREENS.forEach(screen => screen.classList.toggle('active', screen.id === id));
  }

  function stopTimers() {
    timer?.stop();
    clearTimeout(revealTimeout);
  }

  function countdown(seconds, onTick, onEnd) {
    timer?.stop();
    timer = createTimer(seconds, onTick, onEnd);
    timer.start();
  }

  function dealRounds() {
    const shuffled = [...rounds];
    for (let last = shuffled.length - 1; last > 0; last--) {
      const other = Math.floor(Math.random() * (last + 1));
      [shuffled[last], shuffled[other]] = [shuffled[other], shuffled[last]];
    }
    return shuffled.slice(0, ROUND_COUNT);
  }

  function makeTeam(player, choices) {
    const team = document.createElement('section');
    team.className = 'mq-team';
    team.style.setProperty('--team', TEAM_COLORS[player]);
    const name = '팀 ' + (player + 1);
    team.setAttribute('aria-label', name);

    const heading = document.createElement('h3');
    const points = document.createElement('span');
    points.className = 'mq-team-points';
    points.textContent = scores[player] + '점';
    heading.append(name, points);

    const options = document.createElement('div');
    options.className = 'mq-choices';
    options.style.setProperty('--choices', choices.length);
    choices.forEach((choice, index) => {
      const button = document.createElement('button');
      button.className = 'mq-choice';
      button.type = 'button';
      button.disabled = true;
      button.setAttribute('aria-label', name + ': ' + choice.label);
      // Choices are defined locally by each game.
      if (choice.art) button.append(choice.art());
      else button.textContent = choice.label;
      onTap(button, () => pickAnswer(player, index, options));
      options.append(button);
    });
    team.append(heading, options);
    return team;
  }

  function showRound() {
    const round = deck[currentRound];
    picks = Array(playerCount).fill(null);
    scene.dataset.revealed = 'false';
    scene.replaceChildren(round.art());
    get('roundLabel').textContent = (currentRound + 1) + ' / ' + ROUND_COUNT;
    get('roundPrompt').textContent = round.prompt;
    teams.dataset.players = playerCount;
    teams.replaceChildren(...scores.map((_, player) => makeTeam(player, round.choices)));

    if (mode === 'hall') {
      phase = 'move';
      phaseLabel.textContent = '몸으로 풀어요';
      get('roundExplanation').textContent = movement;
      countdown(MOVE_SECONDS, value => { phaseTime.textContent = value; }, openAnswers);
    } else {
      openAnswers();
    }
  }

  function openAnswers() {
    phase = 'answer';
    phaseLabel.textContent = '답을 골라요';
    get('roundExplanation').textContent = mode === 'hall' ? '각 구역 대표가 답을 눌러요.' : movement;
    teams.querySelectorAll('button').forEach(button => { button.disabled = false; });
    countdown(ANSWER_SECONDS, value => { phaseTime.textContent = value; }, reveal);
  }

  function pickAnswer(player, index, options) {
    if (phase !== 'answer' || picks[player] !== null) return;
    picks[player] = index;
    options.children[index].classList.add('is-selected');
    [...options.children].forEach(button => { button.disabled = true; });
    if (picks.every(pick => pick !== null)) reveal();
  }

  function reveal() {
    phase = 'reveal';
    stopTimers();
    const round = deck[currentRound];
    scene.dataset.revealed = 'true';
    phaseLabel.textContent = '정답 확인';
    phaseTime.textContent = '✓';
    get('roundExplanation').textContent = round.explanation;

    [...teams.children].forEach((team, player) => {
      const choices = team.querySelectorAll('button');
      choices.forEach(button => { button.disabled = true; });
      choices[round.answer].classList.add('is-correct');
      choices[round.answer].setAttribute('aria-label', choices[round.answer].getAttribute('aria-label') + ' (정답)');
      if (picks[player] === round.answer) {
        scores[player]++;
        team.querySelector('.mq-team-points').textContent = scores[player] + '점';
      } else if (picks[player] !== null) {
        choices[picks[player]].classList.add('is-wrong');
      }
    });
    revealTimeout = setTimeout(() => {
      currentRound++;
      if (currentRound < deck.length) showRound();
      else finish();
    }, REVEAL_MS);
  }

  function finish() {
    phase = 'result';
    const topScore = Math.max(...scores);
    const leaders = scores.flatMap((score, index) => score === topScore ? ['팀 ' + (index + 1)] : []);
    get('resultSummary').textContent = topScore === 0 ? '이번 판은 모두 0점이에요.'
      : leaders.join(', ') + (leaders.length === 1 ? ' 우승!' : ' 공동 우승!');
    const results = scores.map((score, player) => {
      const row = document.createElement('li');
      row.style.setProperty('--team', TEAM_COLORS[player]);
      const points = document.createElement('strong');
      points.className = 'mq-final-points';
      points.textContent = score;
      row.append('팀 ' + (player + 1), points, ' / ' + deck.length + '점');
      return row;
    });
    get('resultScores').replaceChildren(...results);
    saveScore(scores.slice());
    showScreen('resultScreen');
    get('resultHeading').focus();
  }

  function begin() {
    if (phase !== 'intro') return;
    stopTimers();
    phase = 'countdown';
    scores = Array(playerCount).fill(0);
    currentRound = 0;
    deck = dealRounds();
    showScreen('countdownScreen');
    countdown(3, value => { get('countdownNumber').textContent = Math.max(1, value); }, () => {
      showScreen('gameScreen');
      showRound();
    });
  }

  function setupOptions(selector, update) {
    const options = [...document.querySelectorAll(selector)];
    options.forEach(button => {
      button.addEventListener('click', () => {
        options.forEach(option => option.setAttribute('aria-pressed', option === button));
        update(button);
      });
    });
  }

  setupOptions('[data-count]', button => { playerCount = Number(button.dataset.count); });
  setupOptions('[data-mode]', button => {
    mode = button.dataset.mode;
    get('modeHint').textContent = mode === 'hall'
      ? '5초 동안 모두 자리에서 풀고, 그다음 대표가 답해요.'
      : '지금 보이는 문제에 각자 답해요.';
  });
  get('playBtn').addEventListener('click', begin);
  get('retryBtn').addEventListener('click', () => {
    stopTimers();
    phase = 'intro';
    showScreen('introScreen');
    get('playBtn').focus();
  });
}
