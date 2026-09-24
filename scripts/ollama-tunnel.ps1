# Aspire e Learning - share this laptop's Ollama with the website, automatically.
#
# Starts a Cloudflare tunnel to Ollama, publishes the tunnel address to the site (so every
# user connects without typing anything), and removes it again when you close this window
# or press Ctrl+C.
#
# Run it by double-clicking scripts\start-ollama-tunnel.bat.

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot

# Public Supabase address and key, read from the project's .env.development.
$cfg = @{}
Get-Content (Join-Path $repo '.env.development') | ForEach-Object {
  if ($_ -match '^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$') { $cfg[$Matches[1]] = $Matches[2].Trim('"').Trim("'") }
}
$supabaseUrl = $cfg['VITE_SUPABASE_URL']
$anonKey = $cfg['VITE_SUPABASE_ANON_KEY']
if (-not $supabaseUrl -or -not $anonKey) { throw 'Could not read VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY from .env.development' }

# The laptop's registration key, asked for once and kept in your user folder.
$keyFile = Join-Path $HOME '.aspire-ollama-key'
if (-not (Test-Path $keyFile)) {
  $entered = Read-Host 'Paste your Aspire Ollama key (asked only once)'
  Set-Content -Path $keyFile -Value $entered.Trim() -NoNewline
}
$registerKey = (Get-Content $keyFile -Raw).Trim()

function Publish([string]$address) {
  $body = @{ key = $registerKey; url = $address } | ConvertTo-Json
  Invoke-RestMethod -Method Post -Uri "$supabaseUrl/functions/v1/ollama-register" `
    -Headers @{ apikey = $anonKey; Authorization = "Bearer $anonKey" } `
    -ContentType 'application/json' -Body $body | Out-Null
}

# Let the website call Ollama (browsers need this permission).
if ([Environment]::GetEnvironmentVariable('OLLAMA_ORIGINS', 'User') -ne '*') {
  [Environment]::SetEnvironmentVariable('OLLAMA_ORIGINS', '*', 'User')
  $env:OLLAMA_ORIGINS = '*'
  Write-Host 'Allowed the website to use Ollama. Restarting Ollama...' -ForegroundColor Yellow
  Get-Process -Name 'ollama*' -ErrorAction SilentlyContinue | Stop-Process -Force
  Start-Sleep -Seconds 2
}

# Make sure Ollama is running.
function OllamaUp { try { Invoke-RestMethod 'http://localhost:11434/api/tags' -TimeoutSec 3 | Out-Null; $true } catch { $false } }
if (-not (OllamaUp)) {
  $app = Join-Path $env:LOCALAPPDATA 'Programs\Ollama\ollama app.exe'
  if (Test-Path $app) { Start-Process $app } else { Start-Process 'ollama' -ArgumentList 'serve' -WindowStyle Hidden }
  Write-Host 'Starting Ollama...'
  for ($i = 0; $i -lt 30 -and -not (OllamaUp); $i++) { Start-Sleep -Seconds 1 }
  if (-not (OllamaUp)) { throw 'Ollama did not start. Open the Ollama app and run this again.' }
}
Write-Host 'Ollama is running.' -ForegroundColor Green

# Start the tunnel and wait for its address.
$log = Join-Path $env:TEMP 'aspire-cloudflared.log'
Remove-Item $log -ErrorAction SilentlyContinue
$tunnel = Start-Process cloudflared -ArgumentList 'tunnel', '--url', 'http://localhost:11434', '--http-host-header', 'localhost:11434' `
  -RedirectStandardError $log -PassThru -WindowStyle Hidden
Write-Host 'Starting the tunnel...'
$address = $null
for ($i = 0; $i -lt 60 -and -not $address; $i++) {
  Start-Sleep -Seconds 1
  if (Test-Path $log) {
    $m = Select-String -Path $log -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' | Select-Object -First 1
    if ($m) { $address = $m.Matches[0].Value }
  }
}
if (-not $address) { Stop-Process -Id $tunnel.Id -ErrorAction SilentlyContinue; throw 'The tunnel did not start. Check your internet and try again.' }

try {
  Start-Sleep -Seconds 5   # give the new address a moment to become reachable
  Publish $address
  Write-Host ''
  Write-Host "  Connected: $address" -ForegroundColor Green
  Write-Host '  The website now uses this laptop for Ollama automatically.' -ForegroundColor Green
  Write-Host '  Keep this window open. Press Ctrl+C (or close it) to stop sharing.'
  Write-Host ''
  Wait-Process -Id $tunnel.Id
} finally {
  try { Publish '' ; Write-Host 'Stopped sharing Ollama.' } catch { }
  Stop-Process -Id $tunnel.Id -ErrorAction SilentlyContinue
}
