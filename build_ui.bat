@echo off
title Build Lex UI
echo ==========================================
echo Dang tien hanh build giao dien Mobile...
echo (Qua trinh nay co the mat 1-2 phut)
echo ==========================================

cd /d "%~dp0mobile-client"
call npm install
call npm run build

echo.
echo ==========================================
echo Dang copy giao dien sang PC Server...
echo ==========================================
cd /d "%~dp0"
rmdir /S /Q "pc-server-py\www" 2>nul
mkdir "pc-server-py\www"
xcopy /E /Y "mobile-client\www\*" "pc-server-py\www\"

echo.
echo ==========================================
echo HOAN TAT! Giao dien da duoc cap nhat.
echo Anh co the tat cua so nay va chay file run.bat
echo ==========================================
pause
