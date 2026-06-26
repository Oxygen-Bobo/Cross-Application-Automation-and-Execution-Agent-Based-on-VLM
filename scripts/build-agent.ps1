$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$agentOutput = Join-Path $repoRoot "desktop\resources\agent"
$workPath = Join-Path $repoRoot "build\pyinstaller"

if (-not (Test-Path $agentOutput)) {
  New-Item -ItemType Directory -Path $agentOutput | Out-Null
}

function Invoke-PythonInline($code) {
  $tempScript = Join-Path $workPath ("inline-" + [Guid]::NewGuid().ToString("N") + ".py")
  if (-not (Test-Path $workPath)) {
    New-Item -ItemType Directory -Path $workPath | Out-Null
  }
  Set-Content -Path $tempScript -Value $code -Encoding UTF8
  try {
    python $tempScript
    return $LASTEXITCODE
  } finally {
    Remove-Item -LiteralPath $tempScript -Force -ErrorAction SilentlyContinue
  }
}

function Ensure-SpeechFfmpeg {
  $target = Join-Path $agentOutput "ffmpeg.exe"
  if (Test-Path $target) {
    Write-Host "Bundled ffmpeg found: $target"
    return
  }

  $ffmpegCommand = Get-Command ffmpeg -ErrorAction SilentlyContinue
  if ($ffmpegCommand -and (Test-Path $ffmpegCommand.Source)) {
    Copy-Item -LiteralPath $ffmpegCommand.Source -Destination $target -Force
  } else {
    $copyCode = @"
import shutil
import sys

target = r'''$target'''
try:
    import imageio_ffmpeg
except Exception:
    sys.exit(2)

shutil.copyfile(imageio_ffmpeg.get_ffmpeg_exe(), target)
"@
    $exitCode = Invoke-PythonInline $copyCode
    if ($exitCode -eq 2) {
      Write-Host "imageio-ffmpeg is not installed. Installing it into the current Python environment..."
      python -m pip install imageio-ffmpeg
      if ($LASTEXITCODE -ne 0) {
        throw "Failed to install imageio-ffmpeg. Cannot bundle ffmpeg.exe for speech input."
      }
      $exitCode = Invoke-PythonInline $copyCode
    }
    if ($exitCode -ne 0) {
      throw "Failed to copy bundled ffmpeg.exe."
    }
  }

  if (-not (Test-Path $target)) {
    throw "Bundled ffmpeg.exe was not generated: $target"
  }
  Write-Host "Bundled ffmpeg generated: $target"
}

function Ensure-WhisperModel {
  param([string]$ModelName = "base")

  $target = Join-Path $agentOutput "$ModelName.pt"
  if (Test-Path $target) {
    Write-Host "Bundled Whisper model found: $target"
    return
  }

  $cacheModel = Join-Path $env:USERPROFILE ".cache\whisper\$ModelName.pt"
  if (Test-Path $cacheModel) {
    Copy-Item -LiteralPath $cacheModel -Destination $target -Force
  } else {
    $downloadCode = @"
import whisper
whisper.load_model('$ModelName', download_root=r'''$agentOutput''')
"@
    $exitCode = Invoke-PythonInline $downloadCode
    if ($exitCode -ne 0) {
      throw "Failed to prepare Whisper model '$ModelName'. Please connect to the network once or place $ModelName.pt in $agentOutput."
    }
  }

  if (-not (Test-Path $target)) {
    throw "Bundled Whisper model was not generated: $target"
  }
  Write-Host "Bundled Whisper model generated: $target"
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
  Ensure-SpeechFfmpeg
  Ensure-WhisperModel "base"

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
