# Cosmeredle Unlimited

A personal, Wordle-styled take on [Cosmeredle](https://git.tobot.dev/toby/cosmeredle), the Cosmere character-guessing game, with **unlimited rounds** instead of one per day.

## Play

Open `index.html` in a browser. That's it, with no build step or server. (Fonts load from Google Fonts when you're online and fall back to system fonts when you're not.)

## Features

- Unlimited play: a new random character every round, with recent answers avoided
- Type-ahead search for guesses (arrow keys + Enter)
- Animated tile reveals with Match / Close / Miss colors
- Stats: rounds played, win rate, streak, average guesses, guess distribution
- Spoiler control: choose which series the mystery character can come from
- Clean Wordle-style look with light, dark, and match-device themes
- High-contrast palette and reduced-motion options
- Your progress is saved in the browser

## Updating the character list

Characters live in `tools/characters.source.json` (copied from the original project). After editing it, run:

```sh
python3 tools/build_data.py
```

That regenerates `characters.js`.

## Credits

Character data and comparison rules come from the original Cosmeredle by Toby, released under CC0-1.0. Cosmere characters and settings belong to Brandon Sanderson / Dragonsteel. This is a fan project for personal use only.
