@echo off
setlocal enabledelayedexpansion
title Push SC Design Wirral to GitHub (goes live via Cloudflare Pages)
cd /d "%~dp0"

echo.
echo   ============================================================
echo    Push the "Matt website changes 2" build to the live site
echo   ============================================================
echo.
echo   Commits waiting to go up:
echo.
git --no-pager log --oneline origin/main..HEAD
echo.

echo   ------------------------------------------------------------
echo   [1/2] Trying a normal push.
echo.
echo   This window IS a real terminal, so Git Credential Manager can
echo   finally ask GitHub who you are - which it cannot do from
echo   inside Claude. A GitHub sign-in window may open: approve it.
echo   You are already signed in to GitHub in Edge, so it should be
echo   one click. Do that once and every future push just works, with
echo   no tokens ever again.
echo   ------------------------------------------------------------
echo.

git push origin main
if not errorlevel 1 goto done

echo.
echo   ------------------------------------------------------------
echo   [2/2] That did not work, so fall back to a one-off token.
echo.
echo   Open:  https://github.com/settings/personal-access-tokens/new
echo     Repository access : Only select repositories - scdesign-wirral
echo     Permissions       : Contents = Read and write
echo     Expiration        : 7 days
echo   Copy the token (it starts github_pat_) and paste it below.
echo   It is used once, for this push, and is not saved anywhere.
echo   ------------------------------------------------------------
echo.
set "TOKEN="
set /p "TOKEN=Token (or just press Enter to give up): "
if "!TOKEN!"=="" goto giveup

echo.
git -c credential.helper= push https://x-access-token:!TOKEN!@github.com/mtaylor-afk/scdesign-wirral.git HEAD:main
set "PUSHERR=!errorlevel!"
set "TOKEN="
cls
if not "!PUSHERR!"=="0" goto fail

:done
echo.
echo   ============================================================
echo    Pushed. Cloudflare Pages rebuilds in about 30-60 seconds.
echo.
echo    Then have a look at:
echo      https://scdesignwirral.co.uk/
echo      https://scdesignwirral.co.uk/projects/
echo      https://scdesignwirral.co.uk/about/
echo      https://scdesignwirral.co.uk/homeowners-guide/
echo   ============================================================
echo.
pause
exit /b 0

:giveup
echo.
echo   Nothing pushed. The commits are still here, ready for next time.
echo.
pause
exit /b 1

:fail
echo.
echo   ------------------------------------------------------------
echo    Stopped. The message above says why. Nothing was lost - every
echo    commit stays in this clone until it is pushed.
echo   ------------------------------------------------------------
echo.
pause
exit /b 1
