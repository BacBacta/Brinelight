# Stops only the programs started by start-test.ps1 (tunnels, server, game).
$f = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "logs\pids.txt"
if (-not (Test-Path $f)) { Write-Host "No test is running." } else {
  foreach ($id in (Get-Content $f).Split(",")) { if ($id) { taskkill /PID $id /T /F 2>$null | Out-Null } }
  Remove-Item $f; Write-Host "Test stopped: tunnels, server and game are closed."
}
Start-Sleep -Seconds 3
