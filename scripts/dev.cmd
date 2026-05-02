@echo off
:: Wrapper for `npm run dev` that ensures the right Node.js is used.
::
:: Background: this machine has Brackets (an old, EOL editor) installed at
:: C:\Program Files (x86)\Brackets\, which bundled Node.js 6 and shoved it
:: into PATH. Next.js needs Node 18+, so we prepend the official nodejs
:: install before running anything.
::
:: Used by .claude/launch.json when starting the dev server through Claude's
:: preview tool. Safe to run manually too: `scripts\dev.cmd`.

set "PATH=C:\Program Files\nodejs;%PATH%"
npm run dev
