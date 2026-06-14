# Project-Specific Rules for CodeWhale

- The game is built with React and Three.js. All new code must be in plain-English, self-describing filenames.
- Always run `npm run build` after any change to ensure a production build succeeds.
- Do not commit directly to the `main` branch. Always work on a feature branch.
- When fixing UI issues, use the browser's developer tools mindset to verify CSS changes.
- For any change that affects game balance (e.g., inflation rate), note the old and new values in the commit message.
- Before marking a leaderboard task as complete, ensure it works without the Claude artifact environment.
