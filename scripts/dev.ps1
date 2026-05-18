$root = Resolve-Path "$PSScriptRoot\.."

# Start the bot app in the background
Start-Job -ScriptBlock {
  Set-Location "$using:root\bot"
  yarn dev
}

# Start the UI app in the background
Start-Job -ScriptBlock {
  Set-Location "$using:root\ui"
  yarn dev
}

# Start the validator app in the background
Start-Job -ScriptBlock {
  Set-Location "$using:root\validator"
  docker compose -f .\docker-compose.yaml up -d --build
}

# Show running jobs
Get-Job
