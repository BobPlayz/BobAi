[CmdletBinding()]
param(
  [ValidateSet("fast", "quality")]
  [string]$Profile = "quality",
  [switch]$SkipModelDownload
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root

function Set-DotEnvValue([string]$Name, [string]$Value) {
  $envPath = Join-Path $root ".env"
  if (-not (Test-Path $envPath)) {
    throw "Missing .env. Copy .env.example to .env first, then rerun this script."
  }
  $lines = @(Get-Content -LiteralPath $envPath)
  $pattern = "^\s*" + [regex]::Escape($Name) + "\s*=.*$"
  $replacement = "$Name=$Value"
  $found = $false
  for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match $pattern) {
      $lines[$i] = $replacement
      $found = $true
    }
  }
  if (-not $found) { $lines += $replacement }
  Set-Content -LiteralPath $envPath -Value $lines -Encoding utf8
}

$pythonLauncher = Get-Command py -ErrorAction SilentlyContinue
if (-not $pythonLauncher) {
  throw "Python Launcher was not found. Install Python 3.11 x64, including the Python Launcher, then rerun."
}
& py -3.11 --version
if ($LASTEXITCODE -ne 0) { throw "Python 3.11 was not found. Install Python 3.11 x64 and rerun." }

$venv = Join-Path $root ".venv-image"
$python = Join-Path $venv "Scripts\python.exe"
if (-not (Test-Path $python)) {
  & py -3.11 -m venv $venv
  if ($LASTEXITCODE -ne 0) { throw "Could not create the image-generation virtual environment." }
}

Write-Host ""
Write-Host "[1/4] Installing CPU-only PyTorch..."
& $python -m pip install --upgrade pip
if ($LASTEXITCODE -ne 0) { throw "pip upgrade failed." }
& $python -m pip install torch --index-url https://download.pytorch.org/whl/cpu
if ($LASTEXITCODE -ne 0) { throw "CPU-only PyTorch installation failed." }

Write-Host ""
Write-Host "[2/4] Installing Diffusers and image dependencies..."
& $python -m pip install -r (Join-Path $root "requirements-image.txt")
if ($LASTEXITCODE -ne 0) { throw "Image dependency installation failed." }

if ($Profile -eq "quality") {
  $modelPath = Join-Path $root "models\image\dreamshaper-8"
  $modelRepo = "Lykon/dreamshaper-8"
  $modelDescription = "DreamShaper 8 (higher-quality local model; larger and slower on CPU)"
} else {
  $modelPath = Join-Path $root "models\image\tiny-sd"
  $modelRepo = "segmind/tiny-sd"
  $modelDescription = "Segmind Tiny-SD (lightweight local model)"
}
New-Item -ItemType Directory -Force -Path $modelPath | Out-Null
if (-not $SkipModelDownload) {
  Write-Host ""
  Write-Host "[3/4] Downloading $modelDescription..."
  Write-Host "This requires internet once. Check the selected model's license before using or redistributing generated outputs."
  $downloadCode = "from huggingface_hub import snapshot_download; snapshot_download(repo_id='$modelRepo', local_dir=r'$($modelPath.Replace('\','\\'))')"
  & $python -c $downloadCode
  if ($LASTEXITCODE -ne 0) { throw "Model download failed. Check internet access and available disk space, then rerun." }
} elseif (-not (Test-Path (Join-Path $modelPath "model_index.json"))) {
  throw "SkipModelDownload was used, but the selected model directory does not contain model_index.json."
}

if (-not (Test-Path (Join-Path $modelPath "model_index.json"))) {
  throw "Model download did not produce model_index.json at $modelPath."
}

Write-Host ""
Write-Host "[4/4] Configuring the local .env..."
Set-DotEnvValue "BOBAI_PYTHON" $python
Set-DotEnvValue "BOBAI_IMAGE_MODEL_PATH" $modelPath
Set-DotEnvValue "BOBAI_IMAGE_PROFILE" $Profile

& $python -c "import torch, diffusers, transformers, PIL; print('PyTorch:', torch.__version__); print('Diffusers:', diffusers.__version__); print('CUDA available:', torch.cuda.is_available())"
if ($LASTEXITCODE -ne 0) { throw "Python dependency verification failed." }

Write-Host ""
Write-Host "Local image-generation profile '$Profile' is configured."
Write-Host "Next: run npm run test:image-generation to generate a real 512x512 PNG."
if ($Profile -eq "quality") {
  Write-Host "DreamShaper 8 can look substantially better than Tiny-SD, but on an 8 GB CPU-only laptop it may be very slow or run out of memory."
} else {
  Write-Host "Tiny-SD is the low-memory option. For higher local quality, rerun: npm run setup:image-generation -- -Profile quality"
}
Write-Host "After the smoke test, restart Jarvis. No hosted image API is used by this setup."
