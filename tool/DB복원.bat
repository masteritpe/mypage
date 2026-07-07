@echo off
chcp 65001 >nul
echo ===================================================
echo   ♻️ 로컬 IndexedDB 1초 자동 복원 스크립트
echo ===================================================
echo.

:: 드래그 앤 드롭 확인
if "%~1"=="" (
    echo ⚠️ 사용 방법: 복원할 [백업 폴더]를 마우스로 끌어서 
    echo 이 스크립트 파일 아이콘 위로 '드래그 앤 드롭' 해주세요!
    echo.
    pause
    exit
)

set "BACKUP_DIR=%~1"
set "TARGET_DIR=C:\Users\%USERNAME%\AppData\Local\Google\Chrome\User Data\Profile 1\IndexedDB"

echo 🚨 아주 중요한 경고 🚨
echo 복원을 시작하기 전에 반드시 모든 크롬(Chrome) 창을 완전히 닫아주세요!
echo 크롬이 켜져 있으면 데이터가 덮어씌워지지 않고 에러가 발생합니다.
echo.
echo 크롬을 끄셨다면 아무 키나 눌러주세요...
pause >nul

echo.
echo ♻️ 기존 데이터 덮어쓰기(복원)를 시작합니다...

:: 덮어쓰기 복사 진행
echo 💾 [leveldb] 폴더 복원 중...
xcopy "%BACKUP_DIR%\file__0.indexeddb.leveldb" "%TARGET_DIR%\file__0.indexeddb.leveldb\" /E /I /H /Y >nul

echo 💾 [blob] 폴더 복원 중...
xcopy "%BACKUP_DIR%\file__0.indexeddb.blob" "%TARGET_DIR%\file__0.indexeddb.blob\" /E /I /H /Y >nul

echo.
echo ✅ 복원이 완벽하게 끝났습니다! 크롬을 켜서 로컬(file://) 사이트를 확인해보세요.
echo ===================================================
pause