@echo off
REM Yankee Office - spustenie na tomto pocitaci
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\server.ps1"
if errorlevel 1 start "" "%~dp0index.html"
