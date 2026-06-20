@echo off
title Package Lex Application
echo ==========================================
echo BATCH PROCESS: PACKAGING LEX APPLICATION
echo ==========================================

rem Step 1: Build UI and copy to server
echo.
echo [1/3] Dang build giao dien Mobile Client...
cd /d "%~dp0client"
call cmd /c npm install
call cmd /c npm run build

echo.
echo Dang copy giao dien sang PC Server...
cd /d "%~dp0"
rmdir /S /Q "server\www" 2>nul
mkdir "server\www"
xcopy /E /Y "client\www\*" "server\www\"

rem Step 2: Set up Python environment and dependencies
echo.
echo [2/3] Dang kiem tra moi truong Python...
cd /d "%~dp0server"

if not exist "venv" goto skip_venv_check
call cmd /c .\venv\Scripts\pip.exe --version >nul 2>&1
if errorlevel 1 (
    echo Moi truong ao venv bi loi duong dan - do doi ten thu muc.
    echo Dang xoa venv cu de khoi tao lai...
    rmdir /S /Q "venv" 2>nul
    if exist "venv" (
        echo.
        echo [CANH BAO] Thu muc venv dang bi khoa - co the do Lex Server dang chay.
        echo Anh vui long dong tat ca cac cua so CMD dang chay Lex Server, sau do:
        pause
        rmdir /S /Q "venv"
    )
)
:skip_venv_check

if not exist "venv\Scripts\python.exe" (
    echo Khong tim thay venv. Dang khoi dong tao moi truong ao...
    python -m venv venv
)

echo Dang cap nhat pip va cai dat dependencies...
call cmd /c .\venv\Scripts\python.exe -m pip install --upgrade pip
call cmd /c .\venv\Scripts\python.exe -m pip install -r requirements.txt

echo Kiem tra va cai dat PyInstaller...
call cmd /c .\venv\Scripts\python.exe -m pip install pyinstaller

echo Dang khoi tao file icon...
call cmd /c .\venv\Scripts\python.exe ..\create_icon.py

rem Step 3: Package using PyInstaller
echo.
echo [3/3] Dang dong goi bang PyInstaller...
call cmd /c .\venv\Scripts\python.exe -m PyInstaller --clean lex.spec

echo.
echo ==========================================
if exist "dist\Lex.exe" (
    echo [OK] Dong goi thanh cong! File executable nam tai server\dist\Lex.exe
    echo Dang copy Lex.exe vao thu muc bin o goc...
    if not exist "%~dp0bin" mkdir "%~dp0bin"
    copy /Y "dist\Lex.exe" "%~dp0bin\Lex.exe"
    del /F /Q "%~dp0Lex.exe" >nul 2>&1
    echo Dang lam moi bo nho dem icon cua Windows...
    ie4uinit.exe -ClearIconCache >nul 2>&1
    ie4uinit.exe -show >nul 2>&1
    echo.
    echo HOAN TAT! Anh co the chay file Lex.exe trong thu muc bin roi nhe!
) else (
    echo [ERROR] Dong goi that bai. Vui long kiem tra lai log o tren.
)
echo ==========================================
pause
