$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$envPath = Join-Path $repoRoot ".env"
$ttsDir = Join-Path $repoRoot "models\tts"
$whisperDir = Join-Path $repoRoot "models\whisper"
$whisperModel = Join-Path $whisperDir "ggml-base.bin"
$espeakTarget = Join-Path $ttsDir "espeak-ng-data"

function Set-EnvValue([string]$Key, [string]$Value) {
  $script:envLines = [System.Collections.Generic.List[string]]::new()
  if (Test-Path $envPath) { $script:envLines.AddRange([string[]](Get-Content -Path $envPath)) }
  else { Copy-Item (Join-Path $repoRoot ".env.example") $envPath; $script:envLines.AddRange([string[]](Get-Content -Path $envPath)) }
  $escaped = [regex]::Escape($Key)
  $found = $false
  for ($i = 0; $i -lt $script:envLines.Count; $i++) {
    if ($script:envLines[$i] -match "^\s*$escaped\s*=") {
      $script:envLines[$i] = "$Key=$Value"
      $found = $true
      break
    }
  }
  if (-not $found) { $script:envLines.Add("$Key=$Value") }
  Set-Content -Path $envPath -Value $script:envLines -Encoding utf8
}

New-Item -ItemType Directory -Force -Path $ttsDir, $whisperDir | Out-Null

# The Whisper.cpp model is a separate asset from Piper's voice models.
if (-not (Test-Path $whisperModel) -or (Get-Item $whisperModel).Length -lt 10000000) {
  Write-Host "Downloading Whisper Base model (~150 MB)..." -ForegroundColor Cyan
  Invoke-WebRequest -Uri "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin?download=true" -OutFile $whisperModel -UseBasicParsing
}
if (-not (Test-Path $whisperModel) -or (Get-Item $whisperModel).Length -lt 10000000) {
  throw "Whisper model download failed or the file is incomplete: $whisperModel"
}
Set-EnvValue "BOBAI_WHISPER_MODEL_PATH" $whisperModel

# Obtain the packaged eSpeak NG data from Piper's Python distribution, then store a stable local copy.
$espeakExists = Test-Path (Join-Path $espeakTarget "phontab")
if (-not $espeakExists) {
  $pythonCandidates = @()
  $repoVenvPython = Join-Path $repoRoot ".venv\Scripts\python.exe"
  if (Test-Path $repoVenvPython) { $pythonCandidates += $repoVenvPython }
  $pyLauncher = Get-Command py -ErrorAction SilentlyContinue
  if ($pyLauncher) {
    $pythonCandidates += "py -3.11"
    $pythonCandidates += "py -3"
  }
  $pythonReady = $false
  foreach ($candidate in $pythonCandidates) {
    try {
      if ($candidate -eq "py -3.11") { & py -3.11 -m pip --version *> $null }
      elseif ($candidate -eq "py -3") { & py -3 -m pip --version *> $null }
      else { & $candidate -m pip --version *> $null }
      if ($LASTEXITCODE -eq 0) { $pythonReady = $true; break }
    } catch {}
  }
  if (-not $pythonReady) {
    throw "Python with pip was not found. Install Python 3.11, then rerun npm run setup:native-media."
  }

  $voiceVenv = Join-Path $env:LOCALAPPDATA "Jarvis\voice-setup-venv"
  if (-not (Test-Path (Join-Path $voiceVenv "Scripts\python.exe"))) {
    if (Get-Command py -ErrorAction SilentlyContinue) { & py -3.11 -m venv $voiceVenv }
    else { & python -m venv $voiceVenv }
    if ($LASTEXITCODE -ne 0) { throw "Could not create the private Piper setup environment at $voiceVenv" }
  }
  $voicePython = Join-Path $voiceVenv "Scripts\python.exe"
  Write-Host "Installing Piper's Python package into a separate setup-only environment to obtain eSpeak data..." -ForegroundColor Cyan
  & $voicePython -m pip install --upgrade pip
  if ($LASTEXITCODE -ne 0) { throw "Could not update pip in the setup-only environment." }
  & $voicePython -m pip install piper-tts
  if ($LASTEXITCODE -ne 0) { throw "Could not install piper-tts. This Python/platform combination may not have a compatible wheel." }

  $sitePackages = & $voicePython -c "import site; print(site.getsitepackages()[0])"
  $match = Get-ChildItem -Path $sitePackages -Directory -Filter "espeak-ng-data" -Recurse -ErrorAction SilentlyContinue |
    Where-Object { Test-Path (Join-Path $_.FullName "phontab") } | Select-Object -First 1
  if (-not $match) {
    $match = Get-ChildItem -Path $sitePackages -File -Filter "phontab" -Recurse -ErrorAction SilentlyContinue |
      Select-Object -First 1 | ForEach-Object { Get-Item $_.Directory.FullName }
  }
  if (-not $match) { throw "Piper installed, but its package did not expose an espeak-ng-data folder containing phontab." }
  if (Test-Path $espeakTarget) { Remove-Item -LiteralPath $espeakTarget -Recurse -Force }
  Copy-Item -LiteralPath $match.FullName -Destination $espeakTarget -Recurse -Force
  if (-not (Test-Path (Join-Path $espeakTarget "phontab"))) {
    $nested = Get-ChildItem -Path $espeakTarget -Directory -Recurse -ErrorAction SilentlyContinue |
      Where-Object { Test-Path (Join-Path $_.FullName "phontab") } | Select-Object -First 1
    if ($nested) {
      $temp = "$espeakTarget.tmp"
      Move-Item -LiteralPath $nested.FullName -Destination $temp
      Remove-Item -LiteralPath $espeakTarget -Recurse -Force
      Move-Item -LiteralPath $temp -Destination $espeakTarget
    }
  }
}
if (-not (Test-Path (Join-Path $espeakTarget "phontab"))) {
  throw "eSpeak data is not valid: expected $espeakTarget\phontab"
}
Set-EnvValue "BOBAI_ESPEAK_DATA_PATH" $espeakTarget

Write-Host ""
Write-Host "Voice assets are ready:" -ForegroundColor Green
Write-Host "  eSpeak data: $espeakTarget"
Write-Host "  Whisper model: $whisperModel"
Write-Host "  .env updated without deleting unrelated settings."

$piperRoot = [Environment]::GetEnvironmentVariable("BOBAI_PIPER_ROOT")
$whisperRoot = [Environment]::GetEnvironmentVariable("BOBAI_WHISPER_ROOT")
$piperHeader = if ($piperRoot) { Join-Path $piperRoot "include\piper.h" } else { "" }
$whisperHeader = if ($whisperRoot) { Join-Path $whisperRoot "include\whisper.h" } else { "" }
$piperLib = if ($piperRoot) { Join-Path $piperRoot "lib\piper.lib" } else { "" }
$whisperLib = if ($whisperRoot) { Join-Path $whisperRoot "lib\whisper.lib" } else { "" }

if ($piperRoot -and $whisperRoot -and (Test-Path $piperHeader) -and (Test-Path $whisperHeader) -and (Test-Path $piperLib) -and (Test-Path $whisperLib)) {
  Write-Host "Piper and Whisper C++ headers/libraries found. Building the native media addon..." -ForegroundColor Cyan
  Push-Location $repoRoot
  try { & npm run native:media:build; if ($LASTEXITCODE -ne 0) { throw "Native media build failed. Check the compiler output above." } }
  finally { Pop-Location }
  $addon = Join-Path $repoRoot "native\media\build\Release\bobai_media.node"
  if (-not (Test-Path $addon)) { throw "Build command completed but the native addon file was not produced: $addon" }
  Write-Host "Native media addon built successfully: $addon" -ForegroundColor Green
} else {
  Write-Host ""
  Write-Host "BLOCKED: native addon build needs compatible Piper and whisper.cpp C++ development packages." -ForegroundColor Yellow
  Write-Host "Expected BOBAI_PIPER_ROOT to contain include\piper.h and lib\piper.lib."
  Write-Host "Expected BOBAI_WHISPER_ROOT to contain include\whisper.h and lib\whisper.lib."
  Write-Host "These compiled libraries are not the same as the downloaded ONNX voice models or ggml-base.bin."
  Write-Host "After obtaining compatible Windows x64 builds and setting those two environment variables, rerun npm run setup:native-media."
}
