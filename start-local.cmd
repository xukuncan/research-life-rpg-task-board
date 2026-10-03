@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Please install Node.js 18 or newer.
  pause
  exit /b 1
)
if not exist server.mjs (
  echo server.mjs was not found in this folder.
  pause
  exit /b 1
)
node server.mjs
echo.
echo The local server has stopped.
pause
