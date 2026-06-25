# Adding Games

TouchGame uses each game's `game.json` as the source of truth for launcher classification.

## Required Files

```text
games/{folder}/
  game.json
  index.html
  style.css
  game.js
```

`{folder}` must be lowercase kebab-case, for example `color-count` or `memory-relay`.

## Metadata

```json
{
  "name": "게임 이름",
  "description": "한 줄 설명",
  "icon": "🎮",
  "color": "#2DD4BF",
  "grades": [1, 2, 3, 4, 5, 6],
  "playTime": "1분",
  "category": "brain",
  "players": [2, 3, 4],
  "pattern": "A",
  "tags": ["brain", "group", "pattern-a"]
}
```

## Categories

- `speed`: quick reaction or tapping games
- `brain`: memory, matching, pattern, or reasoning games
- `math`: number, counting, calculation, clock, money, or comparison games
- `knowledge`: language, quiz, world, vocabulary, or fact games
- `coop`: role split, relay, speaking, or team games
- `puzzle`: maze, pipe, line, sliding, rotation, or logic puzzles

## Patterns

- `A`: shared question, fastest correct answer wins
- `B`: each player acts in their own zone
- `C`: turn-based or cooperative role split
- `D`: parallel puzzle race

## Register

```bash
npm run register:game -- games/{folder}
npm run verify
```

The registration script:

- validates required fields
- infers missing `category`, `players`, `pattern`, and `tags`
- writes normalized metadata back to `game.json`
- adds the game folder to `games/registry.json` without duplicates

If classification is ambiguous, edit `game.json` directly and run the command again.
