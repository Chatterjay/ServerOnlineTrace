@echo off
chcp 65001 >nul
echo 正在关闭 TraceSession 服务...

set "PORT=4560"
for /f "tokens=*" %%a in ('netstat -ano ^| findstr ":%PORT% "') do (
  for %%b in (%%a) do set "PID=%%b"
  taskkill /F /PID %PID% >nul 2>&1 && echo 后端已关闭
)
if not defined PID echo 后端未运行
set PID=

set "PORT=5173"
for /f "tokens=*" %%a in ('netstat -ano ^| findstr ":%PORT% "') do (
  for %%b in (%%a) do set "PID=%%b"
  taskkill /F /PID %PID% >nul 2>&1 && echo 前端已关闭
)
if not defined PID echo 前端未运行

echo 完成
pause