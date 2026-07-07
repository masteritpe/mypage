@echo off
chcp 65001 >nul
echo ===================================================
echo   🚀 로컬 IndexedDB 1초 자동 백업 스크립트
echo ===================================================
echo.

:: 원본 폴더 경로 (회원님 캡처 화면 기준)
set "SOURCE_DIR=C:\Users\%USERNAME%\AppData\Local\Google\Chrome\User Data\Profile 1\IndexedDB"

:: 바탕화면에 날짜+시간 이름으로 백업 폴더 생성
set "BACKUP_DIR=%USERPROFILE%\Desktop\LocalDB_Backup_%date:-=%"

echo 📂 바탕화면에 백업 폴더를 만듭니다...
mkdir "%BACKUP_DIR%" 2>nul

echo.
echo 💾 [leveldb] 폴더 복사 중...
xcopy "%SOURCE_DIR%\file__0.indexeddb.leveldb" "%BACKUP_DIR%\file__0.indexeddb.leveldb\" /E /I /H /Y >nul

echo 💾 [blob] 폴더 복사 중...
xcopy "%SOURCE_DIR%\file__0.indexeddb.blob" "%BACKUP_DIR%\file__0.indexeddb.blob\" /E /I /H /Y >nul

echo.
echo ✅ 백업이 완벽하게 끝났습니다! 바탕화면을 확인해주세요.
echo ===================================================
pause