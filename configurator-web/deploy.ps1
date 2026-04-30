# Deploy incident-configurator to PL stand (82.38.66.177).
#
# Steps:
#   1) npm run build         -> dist/
#   2) scp Dockerfile/nginx.conf/docker-compose.yml/dist -> /opt/incident-configurator
#   3) docker compose up -d --build (on remote)
#   4) curl health check on http://<host>:8081
#
# Usage:
#   pwsh ./deploy.ps1
#   pwsh ./deploy.ps1 -SkipBuild
#   pwsh ./deploy.ps1 -RemoteHost PL

param(
    [string]$RemoteHost = "PL",
    [string]$RemoteDir = "/opt/incident-configurator",
    [int]$RemotePort = 8081,
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here

function Step($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }

if (-not $SkipBuild) {
    Step "Local build (npm run build)"
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "Build failed" }
}

if (-not (Test-Path "dist/index.html")) {
    throw "dist/index.html missing - run without -SkipBuild"
}

Step "Ensure remote dir: ${RemoteHost}:${RemoteDir}"
ssh $RemoteHost "mkdir -p $RemoteDir"
if ($LASTEXITCODE -ne 0) { throw "ssh mkdir failed" }

Step "Wipe stale dist on remote"
ssh $RemoteHost "rm -rf $RemoteDir/dist"
if ($LASTEXITCODE -ne 0) { throw "ssh rm dist failed" }

Step "scp dist + configs"
scp -r dist Dockerfile nginx.conf docker-compose.yml .dockerignore "${RemoteHost}:${RemoteDir}/"
if ($LASTEXITCODE -ne 0) { throw "scp failed" }

Step "docker compose up -d --build (remote)"
ssh $RemoteHost "cd $RemoteDir && docker compose up -d --build"
if ($LASTEXITCODE -ne 0) { throw "remote docker compose failed" }

Step "Health probe http://*:$RemotePort"
$cfgLines = ssh -G $RemoteHost
$serverHost = ($cfgLines | Where-Object { $_ -match "^hostname " }) -replace "^hostname ", ""
$probeUrl = "http://${serverHost}:${RemotePort}/"
try {
    $resp = Invoke-WebRequest -Uri $probeUrl -UseBasicParsing -TimeoutSec 10
    Write-Host ("OK {0} {1}" -f $resp.StatusCode, $probeUrl) -ForegroundColor Green
} catch {
    Write-Warning ("Health probe failed (firewall or proxy?). Container is up - check manually: {0}" -f $probeUrl)
}
