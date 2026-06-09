@echo off
REM Dvojklik = zkomprimuje hudbu z music\ na 128k MP3 a vygeneruje seznam tracku.
REM Potrebuje nainstalovany Node.js a ffmpeg.
cd /d "%~dp0.."
node tools\build-music.js
echo.
pause
