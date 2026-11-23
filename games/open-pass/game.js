'use strict';

(() => {
  const choices = [1, 2, 3].map(number => ({ label: number + '번' }));
  const receivers = [{ x: 18, y: 21 }, { x: 50, y: 19 }, { x: 82, y: 21 }];

  function position(marker, point) {
    marker.style.setProperty('--player-x', point.x + '%');
    marker.style.setProperty('--player-y', point.y + '%');
  }

  function player(field, point, type, label) {
    const marker = document.createElement('span');
    marker.className = 'pass-player ' + type;
    marker.textContent = label;
    position(marker, point);
    field.append(marker);
  }

  function draw(passer, defenders, receiver) {
    const field = document.createElement('div');
    field.className = 'pass-field';
    field.setAttribute('role', 'img');
    field.setAttribute('aria-label', '아래쪽 공에서 위쪽의 세 동료에게 패스할 수 있어요. 수비 두 명이 두 길을 막고 있어요.');
    const lane = document.createElement('div');
    lane.className = 'pass-lane';
    const route = [
      [passer.x - 0.7, passer.y], [receiver.x - 0.7, receiver.y],
      [receiver.x + 0.7, receiver.y], [passer.x + 0.7, passer.y]
    ];
    lane.style.clipPath = 'polygon(' + route.map(([x, y]) => x + '% ' + y + '%').join(',') + ')';
    field.append(lane);
    receivers.forEach((point, index) => player(field, point, 'pass-receiver', index + 1));
    defenders.forEach(point => player(field, point, 'pass-defender', '수비'));
    player(field, passer, 'pass-ball', '⚽');
    field.style.setProperty('--ball-from-x', passer.x + '%');
    field.style.setProperty('--ball-from-y', passer.y + '%');
    field.style.setProperty('--ball-to-x', receiver.x + '%');
    field.style.setProperty('--ball-to-y', (receiver.y + 10) + '%');
    return field;
  }

  const rounds = [25, 50, 75].flatMap((x, version) => receivers.map((receiver, answer) => {
    const passer = { x, y: 84 };
    // Place defenders directly on the other two passing lanes.
    const defenders = receivers.flatMap((target, index) => {
      if (index === answer) return [];
      const step = 0.53 + ((index + version) % 3) * 0.07;
      return [{ x: passer.x + (target.x - passer.x) * step, y: passer.y + (target.y - passer.y) * step }];
    });
    return {
      prompt: '어느 동료에게 공을 보내면 좋을까요?',
      explanation: (answer + 1) + '번에게 가는 길에는 수비가 없어요. 공이 닿는 길을 따라가 봐요.',
      choices,
      answer,
      art: () => draw(passer, defenders, receiver)
    };
  }));

  startMotionQuiz({
    rounds,
    movement: '공을 보내고 싶은 동료 쪽으로 손을 뻗어 패스 방향을 보여 줘요.',
    saveScore: scores => reportGameResult({ gameId: 'open-pass', playerCount: scores.length, scores })
  });
})();
