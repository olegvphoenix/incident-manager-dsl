# Deploy Incident Manager (runner + configurator) to PL stand (82.38.66.177).
#
# Один контейнер, один порт 8080, два приложения внутри:
#   /              -> runner-web
#   /configurator/ -> configurator-web (vite base = /configurator/)
#
# Steps:
#   1) build runner-web   -> runner-web/dist
#   2) build configurator -> configurator-web/dist  -> runner-web/dist/configurator
#   3) scp dist/, Dockerfile, nginx.conf, docker-compose.yml -> /opt/incident-runner
#   4) docker compose up -d --build (remote)
#   5) health probe http://<host>:8080
#
# Usage:
#   powershell -File ./deploy.ps1
#   powershell -File ./deploy.ps1 -SkipBuild
#   powershell -File ./deploy.ps1 -RemoteHost PL

param(
    [string]$RemoteHost = "PL",
    [string]$RemoteDir = "/opt/incident-runner",
    [int]$RemotePort = 8080,
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here

$cfgDir = Resolve-Path (Join-Path $here "..\configurator-web")

function Step($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }

if (-not $SkipBuild) {
    Step "Build runner-web (npm run build)"
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "runner-web build failed" }

    Step "Build configurator-web (npm run build)"
    Push-Location $cfgDir
    try {
        npm run build
        if ($LASTEXITCODE -ne 0) { throw "configurator-web build failed" }
    } finally {
        Pop-Location
    }

    Step "Inline configurator into runner dist (dist/configurator/)"
    $cfgDist = Join-Path $cfgDir "dist"
    if (-not (Test-Path "$cfgDist/index.html")) {
        throw "configurator dist missing: $cfgDist"
    }
    $targetCfg = Join-Path "dist" "configurator"
    if (Test-Path $targetCfg) { Remove-Item $targetCfg -Recurse -Force }
    Copy-Item -Recurse $cfgDist $targetCfg
}

if (-not (Test-Path "dist/index.html")) {
    throw "dist/index.html missing - run without -SkipBuild"
}
if (-not (Test-Path "dist/configurator/index.html")) {
    throw "dist/configurator/index.html missing - run without -SkipBuild"
}

Step "Ensure remote dir: ${RemoteHost}:${RemoteDir}"
ssh $RemoteHost "mkdir -p $RemoteDir"
if ($LASTEXITCODE -ne 0) { throw "ssh mkdir failed" }

Step "Wipe stale dist on remote"
ssh $RemoteHost "rm -rf $RemoteDir/dist"
if ($LASTEXITCODE -ne 0) { throw "ssh rm dist failed" }

Step "scp dist + configs"
scp -r dist Dockerfile nginx.conf docker-compose.yml "${RemoteHost}:${RemoteDir}/"
if ($LASTEXITCODE -ne 0) { throw "scp failed" }

Step "docker compose up -d --build (remote)"
ssh $RemoteHost "cd $RemoteDir && docker compose up -d --build"
if ($LASTEXITCODE -ne 0) { throw "remote docker compose failed" }

Step "Health probe http://*:$RemotePort"
$cfgLines = ssh -G $RemoteHost
$serverHost = ($cfgLines | Where-Object { $_ -match "^hostname " }) -replace "^hostname ", ""
$rootUrl = "http://${serverHost}:${RemotePort}/"
$cfgUrl  = "http://${serverHost}:${RemotePort}/configurator/"
try {
    $resp1 = Invoke-WebRequest -Uri $rootUrl -UseBasicParsing -TimeoutSec 10
    Write-Host ("OK {0} {1}" -f $resp1.StatusCode, $rootUrl) -ForegroundColor Green
    $resp2 = Invoke-WebRequest -Uri $cfgUrl -UseBasicParsing -TimeoutSec 10
    Write-Host ("OK {0} {1}" -f $resp2.StatusCode, $cfgUrl) -ForegroundColor Green
} catch {
    Write-Warning ("Health probe failed. Container is up - check manually: {0}, {1}" -f $rootUrl, $cfgUrl)
}
