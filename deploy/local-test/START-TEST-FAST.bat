@echo off
rem The same test as START-TEST.bat, with the city 60 times faster (DEV_SPEED=60), to try research and rafts.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-test.ps1" -Speed 60
