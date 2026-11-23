'use strict';

(() => {
  const directions = [
    { name: '위', x: 0, y: -1, angle: 180, arrow: '↑' },
    { name: '오른쪽', x: 1, y: 0, angle: -90, arrow: '→' },
    { name: '아래', x: 0, y: 1, angle: 0, arrow: '↓' },
    { name: '왼쪽', x: -1, y: 0, angle: 90, arrow: '←' }
  ];
  const objects = [
    { name: '나무 블록', className: 'cube' },
    { name: '둥근 기둥', className: 'pillar' }
  ];
  const choices = directions.map(direction => ({
    label: direction.name,
    art: () => {
      const label = document.createElement('span');
      label.className = 'shadow-choice';
      const arrow = document.createElement('span');
      arrow.setAttribute('aria-hidden', 'true');
      arrow.textContent = direction.arrow;
      label.append(arrow, direction.name);
      return label;
    }
  }));

  function draw(light, shadow, object) {
    const field = document.createElement('div');
    field.className = 'shadow-field';
    field.setAttribute('role', 'img');
    field.setAttribute('aria-label', '위에서 본 장면. 손전등은 ' + object.name + '의 ' + light.name + '에 있어요.');
    const lampX = 50 + light.x * 36;
    const lampY = 50 + light.y * 36;
    const spreadX = light.y * 10;
    const spreadY = light.x * 14;
    const beam = [[lampX, lampY], [50 + spreadX, 50 + spreadY], [50 - spreadX, 50 - spreadY]];
    field.style.setProperty('--lamp-x', lampX + '%');
    field.style.setProperty('--lamp-y', lampY + '%');
    field.style.setProperty('--beam-shape', 'polygon(' + beam.map(([x, y]) => x + '% ' + y + '%').join(', ') + ')');
    field.style.setProperty('--shadow-turn', shadow.angle + 'deg');
    field.innerHTML =
      '<div class="shadow-ray"></div><div class="shadow-cast"></div>' +
      '<div class="shadow-object ' + object.className + '"></div>' +
      '<span class="shadow-lamp">빛</span>';
    return field;
  }

  const rounds = objects.flatMap(object => directions.map((light, index) => {
    const answer = (index + 2) % directions.length;
    const shadow = directions[answer];
    return {
      prompt: '그림자는 어느 쪽에 생길까요?',
      explanation: object.name + '이 빛을 가려요. 빛이 있는 ' + light.name + '의 반대쪽인 ' + shadow.name + '에 그림자가 생겨요.',
      choices,
      answer,
      art: () => draw(light, shadow, object)
    };
  }));

  startMotionQuiz({
    rounds,
    movement: '한 손을 물체로 놓고, 다른 손으로 그 물체에서 그림자가 뻗는 방향을 가리켜요.',
    saveScore: scores => reportGameResult({ gameId: 'shadow-direction', playerCount: scores.length, scores })
  });
})();
