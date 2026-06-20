@echo off
title Package Lex Application
echo ==========================================
echo BATCH PROCESS: PACKAGING LEX APPLICATION
echo ==========================================

rem Step 1: Build UI and copy to server
echo.
echo [1/3] Dang build giao dien Mobile Client...
call "%~dp0build_ui.bat"

rem Step 2: Set up Python environment and dependencies
echo.
echo [2/3] Dang kiem tra moi truong Python...
cd /d "%~dp0server"

if exist "venv" (
    .\venv\Scripts\python.exe --version >nul 2>&1
    if errorlevel 1 (
        echo Moi truong ao venv bi loi duong dan (do doi ten thu muc).
        echo Dang xoa venv cu de khoi tao lai...
        rmdir /S /Q "venv"
    )
)

if not exist "venv\Scripts\python.exe" (
    echo Khong tim thay venv. Dang khoi dong tao moi truong ao...
    python -m venv venv
)

echo Dang cap nhat pip va cai dat dependencies...
call .\venv\Scripts\python.exe -m pip install --upgrade pip
call .\venv\Scripts\pip.exe install -r requirements.txt

echo Kiem tra va cai dat PyInstaller...
call .\venv\Scripts\pip.exe install pyinstaller

rem Step 3: Package using PyInstaller
echo.
echo [3/3] Dang dong goi bang PyInstaller...
call .\venv\Scripts\pyinstaller.exe --clean lex.spec

echo.
echo ==========================================
if exist "dist\lex.exe" (
    echo [OK] Dong goi thanh cong! File executable nam tai server\dist\lex.exe
    echo Dang copy lex.exe ra thu muc goc...
    copy /Y "dist\lex.exe" "%~dp0lex.exe"
    echo.
    echo HOAN TAT! Anh co the chay file lex.exe ngay o thu muc goc roi nhe!
) else (
    echo [ERROR] Dong goi that bai. Vui long kiem tra lai log o tren.
)
echo ==========================================
pause
