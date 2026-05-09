#!/bin/bash
# 关闭 TraceSession 前后端服务

echo "正在关闭 TraceSession 服务..."

# 关闭后端 (端口 4560)
PID=$(netstat -ano | grep 4560 | grep LISTEN | awk '{print $NF}' | head -1)
if [ -n "$PID" ]; then
  taskkill.exe //F //PID $PID 2>/dev/null
  echo "后端已关闭 (PID: $PID)"
else
  echo "后端未运行"
fi

# 关闭前端 (端口 5173)
PID=$(netstat -ano | grep 5173 | grep LISTEN | awk '{print $NF}' | head -1)
if [ -n "$PID" ]; then
  taskkill.exe //F //PID $PID 2>/dev/null
  echo "前端已关闭 (PID: $PID)"
else
  echo "前端未运行"
fi

echo "完成"
