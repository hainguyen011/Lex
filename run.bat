@echo off
title Lex All-in-One Server
cd /d "%~dp0server"
echo Dang khoi dong Lex Server...
echo --------------------------------------

if not exist "venv" goto skip_venv_check
call cmd /c .\venv\Scripts\pip.exe --version >nul 2>&1
if errorlevel 1 (
    echo Moi truong ao venv bi loi duong dan - do doi ten thu muc.
    echo Dang xoa venv cu de khoi tao lai...
    rmdir /S /Q "venv" 2>nul
    if exist "venv" (
        echo.
        echo [CANH BAO] Thu muc venv dang bi khoa - co the do Lex Server dang chay ngam.
        echo Anh vui long dong tat ca cac tien trinh Python hoac CMD dang chay, sau do:
        pause
        rmdir /S /Q "venv"
    )
)
:skip_venv_check

if not exist "venv\Scripts\python.exe" (
    echo Khong tim thay venv. Dang tien hanh tao moi truong ao va cai dat thu vien...
    python -m venv venv
    call cmd /c .\venv\Scripts\python.exe -m pip install --upgrade pip
    call cmd /c .\venv\Scripts\python.exe -m pip install -r requirements.txt
    echo Cai dat hoan tat!
    echo --------------------------------------
)

echo Dang khoi dong Lex Server tu ma nguon Python...
call cmd /c .\venv\Scripts\python.exe server_wifi.py
pause
