$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$desktopRoot = Join-Path $repoRoot "desktop"

# Use system CAs and mirror URLs to make electron-builder downloads more stable
# on Windows machines behind enterprise or regional network proxies.
$env:NODE_OPTIONS = "--use-system-ca"
if (-not $env:ELECTRON_MIRROR) {
  $env:ELECTRON_MIRROR = "https://npmmirror.com/mirrors/electron/"
}
if (-not $env:ELECTRON_BUILDER_BINARIES_MIRROR) {
  $env:ELECTRON_BUILDER_BINARIES_MIRROR = "https://npmmirror.com/mirrors/electron-builder-binaries/"
}

Push-Location $desktopRoot
try {
  npm run agent:build
  if ($LASTEXITCODE -ne 0) {
    throw "Python agent build failed with exit code $LASTEXITCODE"
  }

  npm run build
  if ($LASTEXITCODE -ne 0) {
    throw "Electron build failed with exit code $LASTEXITCODE"
  }

  npx electron-builder --win nsis
  if ($LASTEXITCODE -ne 0) {
    throw "electron-builder failed with exit code $LASTEXITCODE"
  }
} finally {
  Pop-Location
}
