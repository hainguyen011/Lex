@echo off
title Build Lex UI
echo ==========================================
echo Dang tien hanh build giao dien Mobile...
echo (Qua trinh nay co the mat 1-2 phut)
echo ==========================================

cd /d "%~dp0client"
call npm install
call npm run build

echo.
echo ==========================================
echo Dang copy giao dien sang PC Server...
echo ==========================================
cd /d "%~dp0"
rmdir /S /Q "server\www" 2>nul
mkdir "server\www"
xcopy /E /Y "client\www\*" "server\www\"

echo.
echo ==========================================
echo HOAN TAT! Giao dien da duoc cap nhat.
echo Anh co the tat cua so nay va chay file run.bat
echo ==========================================
pause
