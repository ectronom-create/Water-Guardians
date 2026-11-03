@echo off
chcp 65001 >nul
echo.
echo  ╔══════════════════════════════════════════╗
echo  ║     حُرّاس المياه – ابتكري الحل         ║
echo  ║     Water Guardians - Launch Script      ║
echo  ╚══════════════════════════════════════════╝
echo.
echo  Starting server...
echo.
cd /d "%~dp0"
node server.js
pause
