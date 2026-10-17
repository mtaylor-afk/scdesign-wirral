@echo off
title Set up the Projects page in the SC Design admin
cd /d "%~dp0"

echo.
echo   ============================================================
echo    Set up the Projects page so Sean can publish case studies
echo   ============================================================
echo.
echo   Getting the latest version from GitHub first...
git pull --ff-only origin main
echo.

node scripts\setup-projects-cms.mjs %*

echo.
pause
