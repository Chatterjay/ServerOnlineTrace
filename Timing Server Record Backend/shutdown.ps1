# 关闭 TraceSession 前后端服务

Write-Host "Stopping TraceSession services..." -ForegroundColor Cyan

$ports = @{4560 = "Backend"; 5173 = "Frontend"}

foreach ($port in $ports.Keys) {
    $conn = netstat -ano | findstr ":$port"
    if ($conn) {
        $pid = ($conn -split "\s+")[-1]
        if ($pid -match "^\d+$") {
            taskkill /F /PID $pid > $null 2>&1
            Write-Host "$($ports[$port]) stopped (PID: $pid)" -ForegroundColor Green
        }
    } else {
        Write-Host "$($ports[$port]) not running" -ForegroundColor Yellow
    }
}

Write-Host "Done" -ForegroundColor Cyan
