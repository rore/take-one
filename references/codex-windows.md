# Codex on Windows

This adapter applies when Take One runs in Codex on Windows. It resolves Claude-, macOS- and shell-specific examples elsewhere in this skill; the creative workflow and quality bar stay the same.

## Tools and review

- Use Codex's available browser or web tools for site research, and supported browser automation for a logged-in product. Do not assume Claude in Chrome or another connector is installed. If no suitable browser tool is available, ask the user to capture the product or provide screenshots.
- Ask a separate fresh-context agent to review the exported film when one is available and authorized. Give it only the review pack and brief. If no independent agent is available, perform a self-review and label it as such; never call it independent or fresh eyes.
- For music-video session ownership, use supported Codex session tools to look for an existing owner. If those tools are unavailable, ask the user whether another session owns the project; never search a guessed Claude-private path or other private session files.
- Opus/Claude token and time figures elsewhere describe past runs. They are not Codex estimates or promises. State uncertainty and avoid fabricated precision.

## Windows commands and paths

- Run the ported shell helpers by their `.mjs` names with Node: `doctor.mjs`, `new-canvas-project.mjs`, `render-parallel.mjs`, `mux-audio.mjs`, `storyboard-sheet.mjs`, `contact-sheet.mjs`, and `review-pack.mjs`. The shared render scripts (`serve.mjs`, `frames.mjs`, `export.mjs`, and other existing Node scripts) remain Node scripts. Do not invoke these helpers through Bash or assume a Unix shell.
- Resolve every skill-owned script from the installed skill directory: take the directory containing this `SKILL.md`, then join `scripts/<name>`. Resolve project inputs and outputs from the film project directory. Do not guess a clone path or depend on the current working directory for skill scripts.
- Use Node 20 or later for JavaScript helpers. The scaffold writes a project package manifest; run `npm install` explicitly in that film project before rendering to install its project-local Playwright Core dependency. At the skill repository root, use `npm ci` to install the locked development dependencies before qualification checks. Use an available Python interpreter only for optional Python features. `ffmpeg` is required for video export and audio muxing; Python voice/music operations need their documented optional packages (including NumPy, SciPy, Pillow, or Whisper and its model where applicable). Check availability before choosing those routes and offer the code-only path when they are absent. Do not install packages or models without the user's agreement when that would incur cost or change their environment.
- The browser-based code-only route uses Chrome with Playwright Core and requires no paid service. Use project-local dependencies when needed; do not change global installations or PATH.
- `matte.swift` depends on Apple Vision and is unavailable on Windows. Use a supplied alpha mask when available; otherwise keep the subject in front of type or choose a composition that does not require a cut-out. Do not add an ML dependency for this fallback.
- In PowerShell, set environment values with `$env:NAME = 'value'` before the command; do not copy Unix `NAME=value command` examples literally. Open a local page with an available Codex app tool or `Start-Process` in PowerShell. Save the film to the project output path the user chose; do not assume Desktop or Downloads.

## Personal fork and updates

The personal fork is `https://github.com/rore/take-one`; its upstream source is `https://github.com/talsiach/take-one`. Keep `origin` pointed at the personal fork and `upstream` at the source repository so changes can be reviewed and merged without replacing the fork. Preserve upstream attribution and licensing.

Install or update instructions should be explicit, but do not run skill-registration commands, installers, or global setup automatically. For qualification, merge upstream into an isolated worktree, validate the skill and helpers there (`npm run check`, `npm test`, `node scripts/smoke-test.mjs`, and `npm run gate:self-test`), and review the diff before updating an active skill installation. Updating the personal fork and registering it in a user's global skill directory are separate actions.
