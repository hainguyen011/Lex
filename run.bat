@echo off
title Lex All-in-One Server
cd /d "%~dp0server"
echo Dang khoi dong Lex Server...
echo --------------------------------------

if exist "venv" (
    .\venv\Scripts\python.exe --version >nul 2>&1
    if errorlevel 1 (
        echo Moi truong ao venv bi loi duong dan (do doi ten thu muc).
        echo Dang xoa venv cu de khoi tao lai...
        rmdir /S /Q "venv"
    )
)

if not exist "venv\Scripts\python.exe" (
    echo Khong tim thay venv. Dang tien hanh tao moi truong ao va cai dat thu vien...
    python -m venv venv
    .\venv\Scripts\python.exe -m pip install --upgrade pip
    .\venv\Scripts\pip.exe install -r requirements.txt
    echo Cai dat hoan tat!
    echo --------------------------------------
)

.\venv\Scripts\python.exe server_wifi.py
pause
