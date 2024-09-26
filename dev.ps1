# Start the UI app in the background
Start-Job -ScriptBlock {
  Set-Location bot
  yarn dev
}

# Start the bot app in the background
Start-Job -ScriptBlock {
  Set-Location ui
  yarn dev
}

# Show running jobs
Get-Job
