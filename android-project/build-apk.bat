@echo off
echo =======================================================
echo 🎮 WEGETHER ANDROID APK BUILDER
echo =======================================================

echo [1/3] Syncing latest client-web assets...
node sync-assets.js
if %errorlevel% neq 0 (
    echo ❌ Asset sync failed!
    exit /b %errorlevel%
)

echo [2/3] Checking Gradle environment...
if exist "..\gradlew.bat" (
    cd ..
    call gradlew.bat :app:assembleDebug
    cd android-project
) else if exist "gradlew.bat" (
    call gradlew.bat assembleDebug
) else (
    echo [INFO] Running gradle assembleDebug...
    gradle assembleDebug
)

echo =======================================================
echo ✅ APK Build Complete! Output APK:
echo    app\build\outputs\apk\debug\app-debug.apk
echo =======================================================
