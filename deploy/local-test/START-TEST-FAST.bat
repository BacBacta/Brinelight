@echo off
rem The same test as START-TEST.bat, with the city 1000 times faster (DEV_SPEED=1000): from a new city, a raft in about 7 minutes.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-test.ps1" -Speed 1000
