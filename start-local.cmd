@echo off
setlocal
cd /d "%~dp0"
set "LEVELUP_NODE=node.exe"
where node.exe >nul 2>&1
if errorlevel 1 set "LEVELUP_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
"%LEVELUP_NODE%" --version >nul 2>&1
if errorlevel 1 (
  echo Node.js 24 is required. See README.md.
  exit /b 1
)
if not exist "node_modules\next\dist\bin\next" (
  echo Install project dependencies first. See README.md.
  exit /b 1
)
if not exist ".env" (
  echo Create .env and prepare PostgreSQL first. See README.md.
  exit /b 1
)
set "LEVELUP_DEV_DIST=.next-local"
"%LEVELUP_NODE%" ".\node_modules\next\dist\bin\next" dev --hostname 127.0.0.1 %*
