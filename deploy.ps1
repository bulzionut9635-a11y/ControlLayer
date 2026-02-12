param(
    [string]$message = "Auto update"
)

Write-Host "Adding changes..."
git add .

Write-Host "Committing..."
git commit -m $message

Write-Host "Pushing to GitHub..."
git push

Write-Host "Deploy complete."
