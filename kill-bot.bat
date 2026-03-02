@echo off
echo.
echo Stopping all Node.js processes...
taskkill /F /IM node.exe 2>nul
if %errorlevel% == 0 (
    echo Done - all Node processes stopped.
) else (
    echo No Node processes were running.
)
echo.
echo Now run:  npm start
echo.
pause
