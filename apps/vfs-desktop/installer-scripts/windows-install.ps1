# ============================================================================
# Ursly VFS Windows Installer Helper
# ============================================================================
# Run this script if Windows SmartScreen blocks the installer
# Right-click PowerShell -> Run as Administrator, then run this script
# ============================================================================

$ErrorActionPreference = "Stop"

function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    Write-Host $Message -ForegroundColor $Color
}

function Write-Header {
    param([string]$Title)
    Write-Host ""
    Write-Host "============================================================================" -ForegroundColor Cyan
    Write-Host "  $Title" -ForegroundColor Cyan
    Write-Host "============================================================================" -ForegroundColor Cyan
    Write-Host ""
}

Clear-Host
Write-Header "Ursly VFS Windows Installer Helper"

Write-Host "This script helps bypass Windows SmartScreen for the Ursly VFS installer." -ForegroundColor White
Write-Host ""

# Check if running as admin
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "[!] This script requires Administrator privileges." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Please right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "[OK] Running with Administrator privileges" -ForegroundColor Green

# Find the installer
$downloadPath = "$env:USERPROFILE\Downloads"
$installerPatterns = @(
    "Ursly VFS*.msi",
    "Ursly VFS*.exe",
    "ursly-vfs*.msi",
    "ursly-vfs*.exe"
)

$installer = $null
foreach ($pattern in $installerPatterns) {
    $found = Get-ChildItem -Path $downloadPath -Filter $pattern -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($found) {
        $installer = $found.FullName
        break
    }
}

if (-not $installer) {
    Write-Host ""
    Write-Host "[*] Could not find Ursly VFS installer in Downloads folder." -ForegroundColor Blue
    Write-Host ""
    $installer = Read-Host "Please enter the full path to the installer"
    
    if (-not (Test-Path $installer)) {
        Write-Host "[X] File not found: $installer" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
}

Write-Host "[OK] Found installer: $installer" -ForegroundColor Green

# Remove Zone.Identifier (Mark of the Web)
Write-Host "[*] Removing download security flags..." -ForegroundColor Blue

try {
    # Remove the Zone.Identifier alternate data stream
    $zoneFile = "$installer`:Zone.Identifier"
    if (Test-Path $zoneFile -ErrorAction SilentlyContinue) {
        Remove-Item $zoneFile -Force -ErrorAction SilentlyContinue
    }
    
    # Also try using Unblock-File
    Unblock-File -Path $installer -ErrorAction SilentlyContinue
    
    Write-Host "[OK] Security flags removed" -ForegroundColor Green
}
catch {
    Write-Host "[!] Could not remove security flags (may already be clean)" -ForegroundColor Yellow
}

# Run the installer
Write-Host ""
Write-Host "[*] Starting installer..." -ForegroundColor Blue
Write-Host ""

try {
    if ($installer -like "*.msi") {
        Start-Process msiexec.exe -ArgumentList "/i", "`"$installer`"" -Wait
    }
    else {
        Start-Process $installer -Wait
    }
    
    Write-Host ""
    Write-Host "[OK] Installation complete!" -ForegroundColor Green
}
catch {
    Write-Host "[X] Installation failed: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "Thank you for using Ursly VFS!" -ForegroundColor Cyan
Write-Host "Visit https://ursly.io for documentation and support." -ForegroundColor White
Write-Host ""
Read-Host "Press Enter to exit"

