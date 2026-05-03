# Script to remove duplicated functions from individual JS files

$jsPath = "E:\Project\QuickPOS\src\renderer\js"

Get-ChildItem "$jsPath\*.js" | Where-Object { $_.Name -ne "common.js" } | ForEach-Object {
    $jsFile = $_
    $fileName = $_.Name
    
    Write-Host "Cleaning: $fileName" -ForegroundColor Cyan
    
    $content = Get-Content $jsFile.FullName -Raw
    
    # Remove common functions (already in common.js)
    $patterns = @(
        'function toggleSidebar\(\)\s*\{[^}]*\}[^}]*\}[^}]*\}',
        'function checkAuth\(\)\s*\{[^}]*\}[^}]*\}[^}]*\}',
        'function checkUserRole\([^)]*\)\s*\{[^}]*\}[^}]*\}',
        'function setupLogout\(\)\s*\{[^}]*\}[^}]*\}[^}]*\}[^}]*\}',
        'function initSidebar\(\)\s*\{[^}]*\}[^}]*\}[^}]*\}[^}]*\}[^}]*\}[^}]*\}',
        'function formatCurrency\([^)]*\)\s*\{[^}]*\}[^}]*\}[^}]*\}',
        'function initCommon\(\)\s*\{[^}]*\}[^}]*\}[^}]*\}[^}]*\}[^}]*\}[^}]*\}[^}]*\}[^}]*\}[^}]*\}[^}]*\}',
        'document\.addEventListener\([''']DOMContentLoaded[''''],\s*initCommon\)'
    )
    
    foreach ($pattern in $patterns) {
        $content = $content -replace $pattern, ''
    }
    
    # Remove DOMContentLoaded listeners that are in common.js
    $content = $content -replace 'document\.addEventListener\([''']DOMContentLoaded[''''],\s*\(\s*\)\s*=>\s*\{[^}]*\}\s*\)', ''
    
    # Remove empty lines and cleanup
    $content = $content -split "`n" | Where-Object { $_.Trim() -ne '' }
    $content = $content -join "`n"
    
    # Add comment at top
    $content = "// Page-specific JavaScript for $($_.BaseName)`n`n" + $content
    
    Set-Content -Path $jsFile.FullName -Value $content -Encoding UTF8
    Write-Host "  Cleaned up: $fileName" -ForegroundColor Green
}

Write-Host "`nJS files cleaned!" -ForegroundColor Magenta
