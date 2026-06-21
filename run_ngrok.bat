@echo off
title Lex HTTPS Tunnel (ngrok)
echo ----------------------------------------------------
echo KHOI DONG DUONG HAM BAO MAT LEX HTTPS TUNNEL (NGROK)
echo ----------------------------------------------------
echo.

where ngrok >nul 2>&1
if errorlevel 1 (
    echo [!] Khong tim thay lenh 'ngrok' trong he thong.
    echo Anh vui long lam theo cac buoc sau de cai dat rat nhanh:
    echo 1. Truy cap trang chu https://ngrok.com de dang ky tai khoan mien phi.
    echo 2. Tai ngrok cho Windows va giai nen vao mot thu muc.
    echo 3. Copy file ngrok.exe vao thu muc nay (cung cap voi file run_ngrok.bat nay).
    echo 4. Chay lenh thiet lap token: ngrok config add-authtoken <TOKEN_CUA_ANH>
    echo.
    if exist "ngrok.exe" (
        echo Da phat hien ngrok.exe cuc bo! Dang khoi dong tunnel...
        ngrok.exe http 5000
    ) else (
        echo Anh hay tai va dat ngrok.exe vao day, sau do chay lai file nay nhe!
        pause
        exit
    )
) else (
    echo Dang khoi dong ngrok http 5000...
    ngrok http 5000
)
