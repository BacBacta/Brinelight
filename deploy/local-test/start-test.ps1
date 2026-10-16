# Brinelight - sign-in test with a real wallet (Phantom), without a rented server. Windows only.
# Starts two temporary Cloudflare tunnels, the server (in-memory database) and the game.
# Everything stops when you press Enter at the end, or with STOP-TEST.bat.
# Nothing is installed except cloudflared (with winget, the first time).
# -Speed 60 (START-TEST-FAST.bat): the account's city runs 60 times faster (the server's DEV_SPEED), to try
# research and rafts without waiting hours. 1 by default: real time. A city played without an account is not sped up.
param([ValidateRange(1, 3600)][int]$Speed = 1)
$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$repo = Resolve-Path (Join-Path $here "..\..")
$logs = Join-Path $here "logs"
New-Item -ItemType Directory -Force -Path $logs | Out-Null
$procs = @()

function Step($t) { Write-Host ""; Write-Host "==> $t" -ForegroundColor Cyan }
function Refresh-Path { $env:Path = [Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [Environment]::GetEnvironmentVariable("Path","User") }
function Wait-Url($file) {
  for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Seconds 1
    if (Test-Path $file) {
      $m = Select-String -Path $file -Pattern "https://[a-z0-9-]+\.trycloudflare\.com" | Where-Object { $_.Matches[0].Value -ne "https://api.trycloudflare.com" } | Select-Object -First 1
      if ($m) { return $m.Matches[0].Value }
    }
  }
  throw "The tunnel gave no address. See $file"
}

try {
  if ($Speed -eq 1) { Write-Host "Game speed: real time (DEV_SPEED=1)" -ForegroundColor Green }
  else { Write-Host "Game speed: $Speed times faster than real time (DEV_SPEED=$Speed). For testing only." -ForegroundColor Magenta }

  Step "Checking the tools"
  foreach ($t in "node","npm") { if (-not (Get-Command $t -ErrorAction SilentlyContinue)) { throw "$t not found. Install Node.js 22 (nodejs.org), then run again." } }
  $nv = (node -v).TrimStart("v").Split(".")[0]
  if ([int]$nv -lt 22) { throw "Node.js $((node -v)) is too old: version 22 or later is needed." }
  Write-Host "Node $(node -v)"
  if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
    Step "Installing cloudflared (once)"
    winget install --id Cloudflare.cloudflared -e --accept-source-agreements --accept-package-agreements
    Refresh-Path
    if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) { throw "cloudflared is installed but not visible yet. Close this window and run again." }
  }

  Step "Installing the game"
  Set-Location $repo
  npm install --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw "npm install failed (see above)." }

  Step "Opening the two tunnels"
  Remove-Item "$logs\*.log" -ErrorAction SilentlyContinue
  $procs += Start-Process cloudflared -ArgumentList "tunnel","--no-autoupdate","--url","http://127.0.0.1:8787" -RedirectStandardError "$logs\tunnel-api.log" -RedirectStandardOutput "$logs\tunnel-api.out" -WindowStyle Hidden -PassThru
  $procs += Start-Process cloudflared -ArgumentList "tunnel","--no-autoupdate","--url","http://127.0.0.1:4173" -RedirectStandardError "$logs\tunnel-game.log" -RedirectStandardOutput "$logs\tunnel-game.out" -WindowStyle Hidden -PassThru
  ($procs | ForEach-Object { $_.Id }) -join "," | Set-Content "$logs\pids.txt"
  $api = Wait-Url "$logs\tunnel-api.log"
  $game = Wait-Url "$logs\tunnel-game.log"
  Write-Host "API address: $api"
  Write-Host "Game address: $game"

  Step "Building the game with the API address"
  $env:VITE_API_URL = $api
  npm run build
  if ($LASTEXITCODE -ne 0) { throw "The game build failed (see above)." }

  Step "Starting the server and the game"
  $env:ALLOWED_ORIGINS = $game
  $env:TRUSTED_PROXY = "127.0.0.1"
  $env:DEV_SPEED = "$Speed"
  $procs += Start-Process npm.cmd -ArgumentList "run","dev:server" -WorkingDirectory $repo -RedirectStandardOutput "$logs\server.log" -RedirectStandardError "$logs\server.err.log" -WindowStyle Hidden -PassThru
  $procs += Start-Process npm.cmd -ArgumentList "run","preview","-w","client","--","--host","127.0.0.1","--port","4173","--strictPort" -WorkingDirectory $repo -RedirectStandardOutput "$logs\game.log" -RedirectStandardError "$logs\game.err.log" -WindowStyle Hidden -PassThru
  ($procs | ForEach-Object { $_.Id }) -join "," | Set-Content "$logs\pids.txt"

  Step "Checking the server through its tunnel (up to 1 minute)"
  $ok = $false
  for ($i = 0; $i -lt 30 -and -not $ok; $i++) {
    Start-Sleep -Seconds 2
    try { $r = Invoke-RestMethod "$api/health" -TimeoutSec 5; if ($r.ok) { $ok = $true } } catch {}
  }
  if (-not $ok) { throw "The server does not answer through the tunnel. See $logs\server.log and $logs\server.err.log" }
  Write-Host "The server answers." -ForegroundColor Green

  Set-Clipboard -Value $game
  Write-Host ""
  Write-Host "=================================================================" -ForegroundColor Yellow
  Write-Host " READY. Game address (copied to the clipboard):" -ForegroundColor Yellow
  Write-Host "   $game" -ForegroundColor Yellow
  if ($Speed -ne 1) { Write-Host " Signed in, the city runs $Speed times faster than real time." -ForegroundColor Magenta }
  Write-Host ""
  Write-Host " On your phone: Phantom > browser tab > type this address."
  Write-Host " Tap the Power card > Sign in with your wallet > approve in Phantom."
  Write-Host " The message must say: Sign in to Brinelight. This does not send a"
  Write-Host " transaction and costs nothing. If Phantom asks for a TRANSACTION: refuse."
  Write-Host ""
  Write-Host " Do not share this address. Press Enter here to STOP EVERYTHING."
  Write-Host "=================================================================" -ForegroundColor Yellow
  [void](Read-Host)
}
catch {
  Write-Host ""
  Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "Press Enter to stop."
  [void](Read-Host)
}
finally {
  Write-Host "Stopping everything..."
  foreach ($p in $procs) { if ($p -and -not $p.HasExited) { taskkill /PID $p.Id /T /F 2>$null | Out-Null } }
  Remove-Item "$logs\pids.txt" -ErrorAction SilentlyContinue
  Write-Host "Done. The test logs are in $logs"
  Start-Sleep -Seconds 2
}
