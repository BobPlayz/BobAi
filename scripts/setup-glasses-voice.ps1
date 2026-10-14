$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$envPath = Join-Path $repoRoot ".env"
$glassesCandidates = @(
  (Join-Path (Split-Path $repoRoot -Parent) "Ai-Glasses"),
  (Join-Path (Split-Path $repoRoot -Parent) "Ai Glasses"),
  (Join-Path $repoRoot "Ai-Glasses")
)
$glassesRoot = $glassesCandidates | Where-Object { Test-Path (Join-Path $_ "models\tts\en_GB-alan-medium.onnx") } | Select-Object -First 1
if (-not $glassesRoot) {
  throw "Could not find Ai-Glasses\models\tts\en_GB-alan-medium.onnx beside Jarvis. Open the Ai-Glasses repo and run its setup first, then rerun this command."
}
$tts = Join-Path $glassesRoot "models\tts"
$alan = Join-Path $tts "en_GB-alan-medium.onnx"
$alanConfig = "$alan.json"
$venkatesh = Join-Path $tts "te_IN-venkatesh-medium.onnx"
$venkateshConfig = "$venkatesh.json"
foreach ($file in @($alan, $alanConfig, $venkatesh, $venkateshConfig)) {
  if (-not (Test-Path $file) -or (Get-Item $file).Length -lt 1000) {
    throw "Voice asset missing or incomplete: $file. Run Ai-Glasses\scripts\install_british_voice.ps1 first."
  }
}
if (-not (Test-Path $envPath)) {
  Copy-Item (Join-Path $repoRoot ".env.example") $envPath
  Write-Host "Created .env from .env.example. Review its required local settings before starting Jarvis." -ForegroundColor Yellow
}
$lines = [System.Collections.Generic.List[string]]::new()
$lines.AddRange([string[]](Get-Content -Path $envPath))
$settings = [ordered]@{
  BOBAI_PIPER_EN_MODEL_PATH = $alan
  BOBAI_PIPER_EN_CONFIG_PATH = $alanConfig
  BOBAI_PIPER_TE_MODEL_PATH = $venkatesh
  BOBAI_PIPER_TE_CONFIG_PATH = $venkateshConfig
}
# Find eSpeak data in the already-prepared AI Glasses Python environment.
$espeakCandidates = @(
  (Join-Path $glassesRoot ".venv\Lib\site-packages\piper_phonemize\espeak-ng-data"),
  (Join-Path $glassesRoot ".venv\Lib\site-packages\piper\phonemize\espeak-ng-data"),
  (Join-Path $glassesRoot ".venv\Lib\site-packages\piper_phonemize\lib\espeak-ng-data"),
  (Join-Path $glassesRoot "models\tts\espeak-ng-data")
)
$espeak = $espeakCandidates | Where-Object { Test-Path (Join-Path $_ "phontab") } | Select-Object -First 1
if (-not $espeak) {
  $sitePackages = Join-Path $glassesRoot ".venv\Lib\site-packages"
  if (Test-Path $sitePackages) {
    $match = Get-ChildItem -Path $sitePackages -Directory -Filter "espeak-ng-data" -Recurse -ErrorAction SilentlyContinue | Where-Object { Test-Path (Join-Path $_.FullName "phontab") } | Select-Object -First 1
    if ($match) { $espeak = $match.FullName }
  }
}
if ($espeak) { $settings.BOBAI_ESPEAK_DATA_PATH = $espeak }
foreach ($key in $settings.Keys) {
  $value = [string]$settings[$key]
  $escapedKey = [regex]::Escape($key)
  $found = $false
  for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match "^\s*$escapedKey\s*=") {
      $lines[$i] = "$key=$value"
      $found = $true
      break
    }
  }
  if (-not $found) { $lines.Add("$key=$value") }
}
Set-Content -Path $envPath -Value $lines -Encoding utf8
Write-Host ""
Write-Host "Alan Medium English and Venkatesh Medium Telugu voice paths are configured in .env." -ForegroundColor Green
Write-Host "Ai-Glasses source: $glassesRoot"
if ($espeak) {
  Write-Host "eSpeak data found: $espeak" -ForegroundColor Green
} else {
  Write-Host "eSpeak data was not auto-detected in the AI Glasses environment." -ForegroundColor Yellow
  Write-Host "The native Piper engine still needs a valid eSpeak data directory. No existing .env settings were removed."
}
$addon = Join-Path $repoRoot "native\media\build\Release\bobai_media.node"
if (Test-Path $addon) {
  Write-Host "Native media addon exists." -ForegroundColor Green
} else {
  Write-Host "Native media addon is not built yet. Alan paths are configured, but audio will not work until the native media runtime is built with Piper/Whisper dependencies." -ForegroundColor Yellow
}
Write-Host "Next: run npm run ai from the Jarvis repo root after confirming your existing DATABASE_URL is set."
