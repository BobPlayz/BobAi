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
Invoke-Setup "Install local image runtime and download Tiny-SD" "scripts/setup-image-generation.ps1"

Write-Host ""
Write-Host "Local model assets are prepared. This does not claim native voice is operational until compatible Piper/Whisper C++ libraries are installed and the native addon exists." -ForegroundColor Yellow
Write-Host "Next: run npm run test:image-generation, then npm run native:media:build if the native dependencies are configured, then npm run ai."
