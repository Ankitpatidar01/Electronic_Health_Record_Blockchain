$apps = @(
    # Hospital Backends
    @{ dir = "orgs/hospital/EHR_hospitalOrg-main/ehr-backend-v3/ipfs-service"; cmd = "npm start" },
    @{ dir = "orgs/hospital/EHR_hospitalOrg-main/ehr-backend-v3/peer0-api"; cmd = "npm start" },
    @{ dir = "orgs/hospital/EHR_hospitalOrg-main/ehr-backend-v3/peer1-api"; cmd = "npm start" },
    @{ dir = "orgs/hospital/EHR_hospitalOrg-main/ehr-backend-v3/peer2-api"; cmd = "npm start" },
    @{ dir = "orgs/hospital/EHR_hospitalOrg-main/ehr-backend-v3/extorg-api"; cmd = "npm start" },
    @{ dir = "orgs/hospital/EHR_hospitalOrg-main/ehr-backend-v3/patient-api"; cmd = "npm start" },
    @{ dir = "orgs/digilocker/backend"; cmd = "npm start" },
    
    # Pharmacy Frontends
    @{ dir = "orgs/pharmacy/fabric-network-swarm/app/frontend"; cmd = "npm run dev -- --host 0.0.0.0 --port 5175"; isVite = $true },

    # Lab
    @{ dir = "orgs/lab/EHR-LABORG-main/client/node-gateway"; cmd = "npm run web" }
)

$rootDir = Get-Location

# Shared secrets and per-service .env files (idempotent).
node (Join-Path $rootDir "scripts/init-env.js")
if ($LASTEXITCODE -ne 0) { Write-Error "scripts/init-env.js failed; is Node.js installed?"; exit 1 }

foreach ($app in $apps) {
    $fullPath = Join-Path $rootDir $app.dir
    Write-Host "`n======================================================="
    Write-Host "Installing $($app.dir)..."
    Write-Host "======================================================="
    
    # Clean corrupted lock files
    Remove-Item -Force "$fullPath/package-lock.json" -ErrorAction SilentlyContinue
    Remove-Item -Force -Recurse "$fullPath/node_modules" -ErrorAction SilentlyContinue

    Set-Location $fullPath
    
    # Run npm install synchronously
    npm install
    
    if ($app.isVite) {
        Write-Host "Upgrading Vite..."
        npm install vite@latest @vitejs/plugin-react@latest
    }
    
    Write-Host "Starting $($app.dir) in background..."
    Start-Process powershell -ArgumentList "-NoExit -Command `"cd '`$($fullPath)' && $($app.cmd)`"" -WindowStyle Minimized
    
    Set-Location $rootDir
}

Write-Host "`nAll applications installed and started successfully!"
