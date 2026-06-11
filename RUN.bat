@echo off
title PictureWall
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
    echo.
    echo  PictureWall needs Node.js to run.
    echo  Please install it from https://nodejs.org  ^(the "LTS" version^),
    echo  then double-click RUN.bat again.
    echo.
    pause
    exit /b 1
)

if not exist node_modules (
    echo.
    echo  First-time setup: downloading PictureWall's components.
    echo  This only happens once and may take a few minutes...
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo  Setup failed. Check your internet connection and try again.
        pause
        exit /b 1
    )
)

call npm start
