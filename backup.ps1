$source = "C:\ControlLayer"
$destination = "C:\ControlLayerBackups"

$date = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$zipFile = "$destination\ControlLayer_$date.zip"

Write-Host "Creating backup..."

Compress-Archive -Path "$source\*" -DestinationPath $zipFile -Force

Write-Host "Backup created at $zipFile"
