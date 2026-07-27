param(
  [Parameter(Mandatory = $true)]
  [uri]$ApiUrl
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$distPath = Join-Path $repoRoot "apps\extension\dist"
$releasePath = Join-Path $repoRoot "release"
$manifestPath = Join-Path $distPath "manifest.json"

if ($ApiUrl.Scheme -ne "https" -or $ApiUrl.IsLoopback) {
  throw "A API de produção precisa usar uma URL HTTPS pública."
}

$productionApiUrl = $ApiUrl.AbsoluteUri.TrimEnd("/")
$previousApiUrl = $env:VITE_DEFAULT_API_URL
$env:VITE_DEFAULT_API_URL = $productionApiUrl
try {
  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) { throw "O build da extensão falhou." }
} finally {
  $env:VITE_DEFAULT_API_URL = $previousApiUrl
}

$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$origin = "{0}://{1}" -f $ApiUrl.Scheme, $ApiUrl.Authority
$manifest.host_permissions = @("$origin/*")
$manifestJson = $manifest | ConvertTo-Json -Depth 20
[System.IO.File]::WriteAllText(
  $manifestPath,
  $manifestJson,
  [System.Text.UTF8Encoding]::new($false)
)

$required = @(
  "manifest.json",
  "content.js",
  "service-worker.js",
  "inference-worker.js",
  "ort-wasm-simd-threaded.jsep.wasm",
  "models\d3-mobilenetv3\encoder.onnx",
  "icons\icon-128.png"
)
foreach ($relativePath in $required) {
  if (-not (Test-Path -LiteralPath (Join-Path $distPath $relativePath))) {
    throw "Arquivo obrigatório ausente no build: $relativePath"
  }
}

$version = $manifest.version
New-Item -ItemType Directory -Force -Path $releasePath | Out-Null
$zipPath = Join-Path $releasePath "brasil-perpendicular-$version.zip"
if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath }
Compress-Archive -Path (Join-Path $distPath "*") -DestinationPath $zipPath -CompressionLevel Optimal

Write-Output "Pacote: $zipPath"
Write-Output "API: $productionApiUrl"
Write-Output "SHA256: $((Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash)"
