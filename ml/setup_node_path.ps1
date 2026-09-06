$nodeDir = "C:\Users\Nitin\AppData\Local\Microsoft\WinGet\Packages\OpenJS.NodeJS.LTS_Microsoft.Winget.Source_8wekyb3d8bbwe\node-v24.19.0-win-x64"
$userPath = [Environment]::GetEnvironmentVariable("PATH", "User")
if ($userPath -notlike "*$nodeDir*") {
    [Environment]::SetEnvironmentVariable("PATH", "$nodeDir;$userPath", "User")
    Write-Host "Added Node to User PATH environment variable."
} else {
    Write-Host "Node already in User PATH."
}
