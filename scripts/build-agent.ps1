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

function Build-OneFilePython($entryFile, $name) {
  python -m PyInstaller `
    --clean `
    --onefile `
    --name $name `
    --distpath $agentOutput `
    --workpath (Join-Path $workPath $name) `
    --specpath $workPath `
    --paths $repoRoot `
    $entryFile
  if ($LASTEXITCODE -ne 0) {
    throw "PyInstaller failed for $entryFile with exit code $LASTEXITCODE"
  }
}

Push-Location $repoRoot
try {
  Build-OneFilePython "agent_bridge.py" "agent_bridge"

  $speechHelper = Join-Path $repoRoot "speech_to_text.py"
  if (Test-Path $speechHelper) {
    Build-OneFilePython "speech_to_text.py" "speech_to_text"
  }
} finally {
  Pop-Location
}

$exePath = Join-Path $agentOutput "agent_bridge.exe"
if (-not (Test-Path $exePath)) {
  throw "Agent executable was not generated: $exePath"
}

$speechExePath = Join-Path $agentOutput "speech_to_text.exe"
if ((Test-Path (Join-Path $repoRoot "speech_to_text.py")) -and -not (Test-Path $speechExePath)) {
  throw "Speech executable was not generated: $speechExePath"
}

Write-Host "Agent executable generated: $exePath"
if (Test-Path $speechExePath) {
  Write-Host "Speech executable generated: $speechExePath"
}
