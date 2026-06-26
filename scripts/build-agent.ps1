$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$agentOutput = Join-Path $repoRoot "desktop\resources\agent"
$workPath = Join-Path $repoRoot "build\pyinstaller"

if (-not (Test-Path $agentOutput)) {
  New-Item -ItemType Directory -Path $agentOutput | Out-Null
}

$pyInstallerReady = $false
python -m PyInstaller --version | Out-Null
if ($LASTEXITCODE -eq 0) {
  $pyInstallerReady = $true
}

if (-not $pyInstallerReady) {
  Write-Host "PyInstaller is not installed. Installing it into the current Python environment..."
  python -m pip install pyinstaller
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to install PyInstaller. Please check the current Python and pip environment."
  }
}

Push-Location $repoRoot
try {
  python -m PyInstaller `
    --clean `
    --onefile `
    --name agent_bridge `
    --distpath $agentOutput `
    --workpath $workPath `
    --specpath $workPath `
    --paths $repoRoot `
    agent_bridge.py
  if ($LASTEXITCODE -ne 0) {
    throw "PyInstaller failed with exit code $LASTEXITCODE"
  }
} finally {
  Pop-Location
}

$exePath = Join-Path $agentOutput "agent_bridge.exe"
if (-not (Test-Path $exePath)) {
  throw "Agent executable was not generated: $exePath"
}

Write-Host "Agent executable generated: $exePath"
