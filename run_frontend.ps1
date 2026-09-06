$nodeDir = "C:\Users\Nitin\AppData\Local\Microsoft\WinGet\Packages\OpenJS.NodeJS.LTS_Microsoft.Winget.Source_8wekyb3d8bbwe\node-v24.19.0-win-x64"
$env:PATH = "$nodeDir;" + $env:PATH

Set-Location "d:\Spill Sense\SIH-26143-OIL-Spill\frontend"

Write-Host "Node: $(node --version)"
Write-Host "Running npm install..."
& "$nodeDir\npm.cmd" install --ignore-scripts

Write-Host "Starting Vite dev server on port 5173..."
& "$nodeDir\npx.cmd" vite --port 5173 --host
