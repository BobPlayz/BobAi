$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root

$python = Join-Path $root ".venv-image\Scripts\python.exe"
$model = Join-Path $root "models\image\tiny-sd"
$output = Join-Path $root "storage\image-generation-smoke.png"

if (-not (Test-Path $python)) {
  throw "Image Python environment not found. Run npm run setup:image-generation first."
}
if (-not (Test-Path (Join-Path $model "model_index.json"))) {
  throw "Local image model not found. Run npm run setup:image-generation first."
}

& $python (Join-Path $root "scripts\test-image-generation.py") $model $output
if ($LASTEXITCODE -ne 0) {
  throw "Image-generation smoke test failed. See the error above; on an 8 GB laptop, close other heavy applications and retry."
}
