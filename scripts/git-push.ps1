param(
  [Parameter(Mandatory = $true)]
  [string]$Message
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

$git = "C:\Program Files\Git\bin\git.exe"
if (-not (Test-Path $git)) {
  $git = "git"
}

& $git status --short
if ($LASTEXITCODE -ne 0) { throw "git status a échoué" }

$changes = & $git status --porcelain
if (-not $changes) {
  Write-Host "Aucun changement à committer."
  exit 0
}

& $git add -A
& $git commit -m $Message
if ($LASTEXITCODE -ne 0) { throw "git commit a échoué" }

$remote = & $git remote get-url origin 2>$null
if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "⚠ Remote 'origin' absent. Liez GitHub d'abord :"
  Write-Host "  git remote add origin https://github.com/VOTRE-COMPTE/guinea-pwa.git"
  Write-Host "  git push -u origin main"
  exit 0
}

& $git push
if ($LASTEXITCODE -ne 0) { throw "git push a échoué" }

Write-Host ""
Write-Host "✅ Poussé vers GitHub — Vercel déploie automatiquement si le projet est connecté."
