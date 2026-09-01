@echo off
title Miller Pay - Local Development
cd /d "%~dp0"
if not exist "node_modules" (
  echo Preparing Miller Pay for first use...
  call npm install
)
echo.
echo Miller Pay is starting.
echo User app:  http://localhost:5173
echo Admin app: http://localhost:5174
echo Same Wi-Fi: use the Network links printed below after startup.
echo.
echo Keep this window open while using the apps.
call npm run dev
pause
