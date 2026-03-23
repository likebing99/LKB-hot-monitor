$nssm = 'C:\Users\lkb\AppData\Local\Microsoft\WinGet\Packages\NSSM.NSSM_Microsoft.Winget.Source_8wekyb3d8bbwe\nssm-2.24-101-g897c7ad\win64\nssm.exe'

# Remove existing services if any
& $nssm remove HotMonitorBackend confirm 2>$null
& $nssm remove HotMonitorTunnel confirm 2>$null

# === Backend Service ===
& $nssm install HotMonitorBackend 'C:\Program Files\nodejs\node.exe' 'D:\LKB-hot-monitor\server\index.js'
& $nssm set HotMonitorBackend AppDirectory 'D:\LKB-hot-monitor\server'
& $nssm set HotMonitorBackend DisplayName 'LKB Hot Monitor Backend'
& $nssm set HotMonitorBackend Description '李柯兵AI热点监控工具 - Node.js 后端服务'
& $nssm set HotMonitorBackend Start SERVICE_AUTO_START
& $nssm set HotMonitorBackend AppStdout 'D:\LKB-hot-monitor\server\service-stdout.log'
& $nssm set HotMonitorBackend AppStderr 'D:\LKB-hot-monitor\server\service-stderr.log'
& $nssm set HotMonitorBackend AppRotateFiles 1
& $nssm set HotMonitorBackend AppRotateBytes 1048576

# === Tunnel Service ===
& $nssm install HotMonitorTunnel 'C:\Users\lkb\AppData\Local\Microsoft\WinGet\Packages\Cloudflare.cloudflared_Microsoft.Winget.Source_8wekyb3d8bbwe\cloudflared.exe' 'tunnel --url http://localhost:3000'
& $nssm set HotMonitorTunnel DisplayName 'LKB Hot Monitor Tunnel'
& $nssm set HotMonitorTunnel Description '李柯兵AI热点监控工具 - Cloudflare Tunnel'
& $nssm set HotMonitorTunnel Start SERVICE_AUTO_START
& $nssm set HotMonitorTunnel AppStdout 'D:\LKB-hot-monitor\server\tunnel-stdout.log'
& $nssm set HotMonitorTunnel AppStderr 'D:\LKB-hot-monitor\server\tunnel-stderr.log'
& $nssm set HotMonitorTunnel AppRotateFiles 1
& $nssm set HotMonitorTunnel AppRotateBytes 1048576
& $nssm set HotMonitorTunnel DependOnService HotMonitorBackend

Write-Host '=== Services registered ==='

# Start backend first
& $nssm start HotMonitorBackend
Start-Sleep 3
& $nssm start HotMonitorTunnel
Start-Sleep 5

Write-Host '=== Services started ==='
Get-Service HotMonitorBackend, HotMonitorTunnel | Format-Table Name, Status, StartType -AutoSize
