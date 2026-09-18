#Requires -Version 5.1
<#
.SYNOPSIS
    Builds the ActionClip installer and places the EXE at the project root.
.DESCRIPTION
    1. Reads version from version.json (single source of truth)
    2. Syncs version into desktop-agent/package.json
    3. Runs npm run dist (electron-builder)
    4. Copies the resulting EXE to the project root
    5. Prints a summary
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ProjectRoot = $PSScriptRoot
$AgentDir    = Join-Path $ProjectRoot 'desktop-agent'
$VersionFile = Join-Path $ProjectRoot 'version.json'

Write-Host ""
Write-Host "=== ActionClip Build ===" -ForegroundColor Cyan

# 1. Read version
$versionObj = Get-Content $VersionFile -Raw | ConvertFrom-Json
$Version = $versionObj.version
Write-Host "Version : $Version" -ForegroundColor Yellow

# 2. Sync version into package.json
$pkgPath = Join-Path $AgentDir 'package.json'
$pkg = Get-Content $pkgPath -Raw | ConvertFrom-Json
if ($pkg.version -ne $Version) {
    Write-Host "Syncing package.json version $($pkg.version) -> $Version"
    $pkg.version = $Version
    $pkg | ConvertTo-Json -Depth 20 | Set-Content $pkgPath -Encoding UTF8
}

# 3. Build
Write-Host ""
Write-Host "Building installer..." -ForegroundColor Cyan
Push-Location $AgentDir
try {
    npm run dist
    if ($LASTEXITCODE -ne 0) { throw "npm run dist failed (exit $LASTEXITCODE)" }
} finally {
    Pop-Location
}

# 4. Find the EXE (may be in dist\ or a sub-folder)
$exeName = "ActionClip-Setup-$Version.exe"
$exeSrc  = Get-ChildItem (Join-Path $AgentDir 'dist') -Filter $exeName -Recurse | Select-Object -First 1

if (-not $exeSrc) {
    Write-Warning "EXE not found under desktop-agent\dist\ - skipping root copy."
} else {
    $exeDst = Join-Path $ProjectRoot $exeName
    Copy-Item $exeSrc.FullName $exeDst -Force
    Write-Host ""
    Write-Host "Installer ready: $exeDst" -ForegroundColor Green
    Write-Host "Size           : $([math]::Round($exeSrc.Length / 1MB, 1)) MB"
}

Write-Host ""
Write-Host "Build complete." -ForegroundColor Green
