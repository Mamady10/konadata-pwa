# Test webhook Orange Money en local
# Prérequis: npm run dev, migration 049, ORANGE_MONEY_WEBHOOK_SECRET dans .env.local
# Usage:
#   .\scripts\test-webhook-orange-money.ps1 -PaymentToken "VOTRE_TOKEN" -AmountGnf 453600000

param(
  [Parameter(Mandatory = $true)]
  [string]$PaymentToken,
  [long]$AmountGnf = 0,
  [string]$BaseUrl = "http://localhost:3000",
  [string]$EventId = "test-om-$(Get-Date -Format 'yyyyMMddHHmmss')"
)

$envFile = Join-Path $PSScriptRoot "..\.env.local"
$secret = $null
if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*ORANGE_MONEY_WEBHOOK_SECRET\s*=\s*(.+)$') { $secret = $matches[1].Trim().Trim('"') }
    if (-not $secret -and $_ -match '^\s*BILLING_WEBHOOK_SECRET\s*=\s*(.+)$') { $secret = $matches[1].Trim().Trim('"') }
  }
}

if (-not $secret) {
  Write-Host "ERREUR: ORANGE_MONEY_WEBHOOK_SECRET manquant dans .env.local" -ForegroundColor Red
  exit 1
}

$bodyObj = @{
  event_id = $EventId
  status = "SUCCESS"
  amount_gnf = $AmountGnf
  payment_token = $PaymentToken
  reference = "TEST-REF-001"
}
$body = $bodyObj | ConvertTo-Json -Compress

$hmac = New-Object System.Security.Cryptography.HMACSHA256
$hmac.Key = [Text.Encoding]::UTF8.GetBytes($secret)
$hash = $hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($body))
$sig = -join ($hash | ForEach-Object { $_.ToString("x2") })

$url = "$BaseUrl/api/billing/webhook/orange-money"
Write-Host "POST $url"
Write-Host "Body: $body"

try {
  $resp = Invoke-RestMethod -Uri $url -Method POST -Body $body -ContentType "application/json" -Headers @{ "X-Webhook-Signature" = $sig }
  $resp | ConvertTo-Json -Depth 5
  Write-Host "OK" -ForegroundColor Green
} catch {
  Write-Host $_.Exception.Message -ForegroundColor Red
  if ($_.ErrorDetails.Message) { Write-Host $_.ErrorDetails.Message }
  exit 1
}
