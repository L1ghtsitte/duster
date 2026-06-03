#Requires -RunAsAdministrator
[CmdletBinding()]
param(
    [ValidateSet(0,1,2,3,4)]
    [int]$Mode = 0,
    [string]$InstallDir = "C:\Duster",
    [string]$ServerIp = "",
    [int]$Port = 0,
    [string]$AgentToken = "",
    [int]$PcNumber = 1
)

$DusterVersion = "0.1.0"
$LogFile = "C:\Duster\install.log"

function Write-Log($m) { if ($LogFile) { $ts = Get-Date -Format "HH:mm:ss"; "$ts $m" | Out-File -FilePath $LogFile -Append -Encoding utf8 } }
function Write-Info($m) { Write-Log "[INFO] $m"; Write-Host $m -ForegroundColor Cyan }
function Write-Ok($m) { Write-Log "[OK] $m"; Write-Host "OK $m" -ForegroundColor Green }
function Write-Warn($m) { Write-Log "[WARN] $m"; Write-Host "WARN $m" -ForegroundColor Yellow }
function Write-Err($m) { Write-Log "[ERR] $m"; Write-Host "ERR $m" -ForegroundColor Red; exit 1 }

function Test-Cmd($n) { $null -ne (Get-Command $n -ErrorAction SilentlyContinue) }
function Refresh-Env { if (Test-Cmd refreshenv) { refreshenv 2>$null } }

function Install-Prerequisites {
    Write-Info "Checking dependencies..."
    if (-not (Test-Cmd node)) {
        Write-Info "Installing Node.js 22 LTS..."
        winget install OpenJS.NodeJS -v "22.0.0" --accept-package-agreements --accept-source-agreements
        if (-not $?) { winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements }
    }
    if (-not (Test-Cmd dotnet)) {
        Write-Info "Installing .NET 8 SDK..."
        winget install Microsoft.DotNet.SDK.8 --accept-package-agreements --accept-source-agreements
    }
    $gpu = Get-CimInstance -ClassName Win32_VideoController | Where-Object { $_.Name -match "NVIDIA" }
    if ($gpu) { Write-Ok "NVIDIA GPU detected - H.264 NVENC available" }
    else { Write-Warn "No NVIDIA GPU - software encoding only" }
    Refresh-Env
    Write-Ok "Prerequisites ready"
}

function Install-DockerStack {
    Write-Info "Docker mode"
    if (-not (Test-Cmd docker)) { Write-Err "Docker not found. Install Docker Desktop first." }
    $repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
    Push-Location $repoRoot
    $envFile = "packages\server\.env"
    if (-not (Test-Path $envFile)) {
        Copy-Item ".env.example" $envFile
        Write-Warn ".env created - update DUSTER_JWT_SECRET"
    }
    docker compose up -d --build
    Pop-Location
    Write-Ok "Docker stack running"
    Write-Host "API: http://${ServerIp}:${Port}/api/health"
    Write-Host "Admin: http://${ServerIp}:${Port}/admin"
}

function Install-ServerRole {
    Write-Info "Server mode"
    $ip = if ($ServerIp -and $ServerIp -ne "192.168.10.10") { $ServerIp } else { Read-Host "Server IP [Enter = 192.168.10.10]" }
    $port = if ($Port -and $Port -ne 3847) { $Port } else { Read-Host "Server port [Enter = 3847]" }
    New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
    $repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
    Push-Location $repoRoot
    if (-not (Test-Path "packages\server\.env")) { Copy-Item ".env.example" "packages\server\.env" }
    npm install --legacy-peer-deps
    npm run build 2>$null
    npm run db:migrate 2>$null
    npm run db:seed 2>$null
    Pop-Location
    Write-Ok "Server installed in $InstallDir"
    Write-Host "Run server: npm start --workspace=@duster/server"
}

function Install-AdminRole {
    Write-Info "Admin web panel mode"
    $repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
    Push-Location $repoRoot
    npm install --legacy-peer-deps --workspace=@duster/admin-web 2>$null
    npm run build --workspace=@duster/admin-web 2>$null
    Pop-Location
    Write-Ok "Admin panel built"
}

function Install-StationRole {
    Write-Info "Station PC mode"
    $ip = if ($ServerIp -and $ServerIp -ne "192.168.10.10") { $ServerIp } else { Read-Host "Server IP [Enter = 192.168.10.10]" }
    $port = if ($Port -and $Port -ne 3847) { $Port } else { Read-Host "Server port [Enter = 3847]" }
    $num = if ($PcNumber -and $PcNumber -ne 0) { $PcNumber } else { Read-Host "PC number [Enter = 1]" }
    $token = if ($AgentToken -and $AgentToken -ne "") { $AgentToken } else { Read-Host "Agent token" }
    New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
    $configDir = Join-Path $InstallDir "config"
    New-Item -ItemType Directory -Force -Path $configDir | Out-Null
    "http://${ip}:${port}" | Set-Content (Join-Path $configDir "server.url")
    "$token" | Set-Content (Join-Path $configDir "agent.token")
    if ($num) { "$num" | Set-Content (Join-Path $configDir "pc.number") }
    Write-Ok "Station config saved"
}

function Show-Menu {
    Clear-Host
    Write-Host "========================================" -ForegroundColor Blue
    Write-Host "  Duster v$DusterVersion - Universal Installer" -ForegroundColor Blue
    Write-Host "  (Not tested yet, tests from v1.0.0)" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Blue
    Write-Host ""
    Write-Host "[0] Docker Compose"
    Write-Host "[1] Server (full)"
    Write-Host "[2] Admin web panel"
    Write-Host "[3] Station PC (Agent)"
    Write-Host ""
    $c = Read-Host "Select mode"
    switch ($c.Trim()) {
        "0" { Install-Prerequisites; Install-DockerStack }
        "1" { Install-Prerequisites; Install-ServerRole }
        "2" { Install-Prerequisites; Install-AdminRole }
        "3" { Install-Prerequisites; Install-StationRole }
        default { Write-Err "Invalid selection" }
    }
    Write-Ok "Done"
}

if ($Mode -eq 0) { Show-Menu }
else {
    switch ($Mode) {
        1 { Install-Prerequisites; Install-DockerStack }
        2 { Install-Prerequisites; Install-ServerRole }
        3 { Install-Prerequisites; Install-AdminRole }
        4 { Install-Prerequisites; Install-StationRole }
    }
}