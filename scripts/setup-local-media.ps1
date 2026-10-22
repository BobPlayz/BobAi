$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $repoRoot

function Invoke-Setup([string]$Label, [string]$ScriptPath, [string[]]$Arguments = @()) {
  Write-Host ""
  Write-Host "===== $Label =====" -ForegroundColor Cyan
  & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $repoRoot $ScriptPath) @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$Label failed with exit code $LASTEXITCODE. Fix the reported error, then rerun npm run setup:local-media."
  }
}

if (-not (Test-Path (Join-Path $repoRoot ".env"))) {
  Copy-Item (Join-Path $repoRoot ".env.example") (Join-Path $repoRoot ".env")
  Write-Host "Created .env from .env.example. Existing environment files are never overwritten." -ForegroundColor Yellow
}

# Run independent setup tasks even if native C++ libraries are not installed yet.
Invoke-Setup "Prepare Whisper and eSpeak assets" "scripts/setup-native-media.ps1"
Invoke-Setup "Download the free Alan British voice and configure voice paths" "scripts/setup-glasses-voice.ps1"

# The Python CLI fallback avoids requiring separate native C++ builds for voice.
$voiceVenv = Join-Path $env:LOCALAPPDATA "Jarvis\voice-setup-venv"
$voicePython = Join-Path $voiceVenv "Scripts\python.exe"
$piperCommand = Join-Path $voiceVenv "Scripts\piper.exe"
if (-not (Test-Path $voicePython)) { throw "The local Piper Python environment was not created." }
Write-Host ""
Write-Host "===== Install CPU speech recognition =====" -ForegroundColor Cyan
& $voicePython -m pip install --upgrade faster-whisper huggingface_hub
if ($LASTEXITCODE -ne 0) { throw "Installing faster-whisper failed." }
$whisperModel = Join-Path $repoRoot "models\whisper\faster-whisper-base"
New-Item -ItemType Directory -Force -Path $whisperModel | Out-Null
if (-not (Test-Path (Join-Path $whisperModel "model.bin")) -or -not (Test-Path (Join-Path $whisperModel "config.json"))) {
  Write-Host "Downloading the local faster-whisper Base model (~150 MB)..." -ForegroundColor Cyan
  $downloadCode = "from huggingface_hub import snapshot_download; snapshot_download(repo_id='Systran/faster-whisper-base', local_dir=r'$($whisperModel.Replace('\','\\'))')"
  & $voicePython -c $downloadCode
  if ($LASTEXITCODE -ne 0) { throw "Downloading the faster-whisper model failed." }
}
if (-not (Test-Path (Join-Path $whisperModel "model.bin")) -or -not (Test-Path (Join-Path $whisperModel "config.json"))) { throw "The faster-whisper model download is incomplete." }
if (-not (Test-Path $piperCommand)) { throw "Piper CLI was not installed at $piperCommand." }

function Set-LocalEnvValue([string]$Key, [string]$Value) {
  $envPath = Join-Path $repoRoot ".env"
  $lines = [System.Collections.Generic.List[string]]::new()
  $lines.AddRange([string[]](Get-Content -LiteralPath $envPath))
  $pattern = "^\s*" + [regex]::Escape($Key) + "\s*=.*$"
  $found = $false
  for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match $pattern) { $lines[$i] = "$Key=$Value"; $found = $true; break }
  }
  if (-not $found) { $lines.Add("$Key=$Value") }
  Set-Content -LiteralPath $envPath -Value $lines -Encoding utf8
}
Set-LocalEnvValue "BOBAI_VOICE_PYTHON" $voicePython
Set-LocalEnvValue "BOBAI_PIPER_COMMAND" $piperCommand
Set-LocalEnvValue "BOBAI_WHISPER_PYTHON_MODEL_PATH" $whisperModel

Invoke-Setup "Install local image runtime and download Tiny-SD" "scripts/setup-image-generation.ps1"

Write-Host ""
Write-Host "Local Piper CLI and faster-whisper are configured for offline voice; the native C++ addon is optional." -ForegroundColor Green
Write-Host "Next: run npm run test:image-generation to verify image inference, then npm run ai."
