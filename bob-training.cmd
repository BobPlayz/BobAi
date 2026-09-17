@echo off
setlocal
cd /d "%~dp0"
set ACTION=%~1
if "%ACTION%"=="" set ACTION=start
if /I "%ACTION%"=="start" goto start
if /I "%ACTION%"=="resume" goto resume
if /I "%ACTION%"=="pause" goto pause
if /I "%ACTION%"=="status" goto status
if /I "%ACTION%"=="stop" goto stop
echo Usage: bob-training.cmd [start^|pause^|status^|resume^|stop]
exit /b 2
:start
echo Starting BobAI training from %CD%
echo This command confirms you reviewed the upstream dataset terms used by the corpus builder.
python model-training\pipeline.py --confirm-upstream-terms --profile dev
exit /b %ERRORLEVEL%
:resume
python model-training\pipeline.py --resume
exit /b %ERRORLEVEL%
:pause
python model-training\training_control.py pause
exit /b %ERRORLEVEL%
:status
python model-training\training_control.py status
exit /b %ERRORLEVEL%
:stop
python model-training\training_control.py stop
exit /b %ERRORLEVEL%
