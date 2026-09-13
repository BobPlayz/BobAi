$ErrorActionPreference = "Stop"
$repo = (Get-Location).Path
$kit = Join-Path $repo "bobai-final-repo-kit"

if (-not (Test-Path (Join-Path $repo "package.json"))) {
    throw "Run this command from the BobAI repository root."
}

$targets = @(
    "model-training\build_large_dataset.py",
    "model-training\prepare_dataset.py",
    "model-training\README.md"
)

foreach ($target in $targets) {
    $src = Join-Path $kit $target
    $dst = Join-Path $repo $target
    if (-not (Test-Path $src)) { throw "Missing kit file: $target" }
    New-Item -ItemType Directory -Force -Path (Split-Path $dst) | Out-Null
    Copy-Item $src $dst -Force
    Write-Host "Updated $target"
}

New-Item -ItemType Directory -Force -Path (Join-Path $repo "model-training\data\sources") | Out-Null

Write-Host ""
Write-Host "BobAI kit installed."
Write-Host "Build command:"
Write-Host "python model-training\build_large_dataset.py --source-dir model-training\data\sources --output-dir model-training\data\large --overflow-dir E:\BobAI-data"
