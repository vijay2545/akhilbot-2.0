@echo off
title Crypto 6Club Bot - Shree Win VIP
cd /d "%~dp0"

:loop
cls
echo ====================================================
echo   Crypto 6Club Bot (Shree Win VIP) - ACTIVE
echo   Channel: SHREE WIN VIP (-1002151560609)
echo ====================================================
node index.js
echo.
echo [WARNING] Bot process stopped! Restarting in 2 seconds...
timeout /t 2 /nobreak >nul
goto loop
