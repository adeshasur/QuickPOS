# Script to remove duplicated styles from individual CSS files

$stylesPath = "E:\Project\QuickPOS\src\styles"
$commonCssPath = Join-Path $stylesPath "common.css"

# Read common.css to know what to remove
$commonCss = Get-Content $commonCssPath -Raw

Get-ChildItem "$stylesPath\*.css" | Where-Object { $_.Name -ne "common.css" } | ForEach-Object {
    $cssFile = $_
    $fileName = $_.Name
    
    Write-Host "Cleaning: $fileName" -ForegroundColor Cyan
    
    $content = Get-Content $cssFile.FullName -Raw
    
    # Remove common sidebar styles (already in common.css)
    $patterns = @(
        '\/\* Sidebar Styles.*?\}',
        '\.sidebar\s*\{[^}]*\}',
        '\.sidebar\.expanded\s*\{[^}]*\}',
        '\.sidebar\.collapsed\s*\{[^}]*\}',
        '\.hamburger-menu\s*\{[^}]*\}',
        '\.hamburger-btn\s*\{[^}]*\}',
        '\.hamburger-btn:hover\s*\{[^}]*\}',
        '\.logo\s*\{[^}]*\}',
        '\.logo\.collapsed\s*\{[^}]*\}',
        '\.nav-items\s*\{[^}]*\}',
        '\.nav-item\s*\{[^}]*\}',
        '\.nav-item:hover\s*\{[^}]*\}',
        '\.nav-item\.active\s*\{[^}]*\}',
        '\.nav-icon\s*\{[^}]*\}',
        '\.nav-text\s*\{[^}]*\}',
        '\.sidebar\.collapsed\s*\.nav-text\s*\{[^}]*\}',
        '\.main-content\s*\{[^}]*\}',
        '\.top-bar\s*\{[^}]*\}',
        '\.page-title\s*\{[^}]*\}',
        '\.user-info\s*\{[^}]*\}',
        '\.user-avatar\s*\{[^}]*\}',
        '\.btn\s*\{[^}]*\}',
        '\.btn-primary\s*\{[^}]*\}',
        '\.btn-primary:hover\s*\{[^}]*\}',
        '\.btn-danger\s*\{[^}]*\}',
        '\.btn-danger:hover\s*\{[^}]*\}',
        '\.btn-success\s*\{[^}]*\}',
        '\.btn-success:hover\s*\{[^}]*\}',
        '\.form-group\s*\{[^}]*\}',
        '\.form-label\s*\{[^}]*\}',
        '\.form-input\s*\{[^}]*\}',
        '\.form-input:focus\s*\{[^}]*\}',
        '\.data-table\s*\{[^}]*\}',
        '\.data-table\s*thead\s*\{[^}]*\}',
        '\.data-table\s*th\s*\{[^}]*\}',
        '\.data-table\s*td\s*\{[^}]*\}',
        '\.data-table\s*tbody\s*tr:hover\s*\{[^}]*\}',
        '\.card\s*\{[^}]*\}',
        '\*,\s*\*\s*\{[^}]*\}',
        ':root\s*\{[^}]*\}',
        'body\s*\{[^}]*\}'
    )
    
    foreach ($pattern in $patterns) {
        $content = $content -replace $pattern, ''
    }
    
    # Remove empty lines and cleanup
    $content = $content -split "`n" | Where-Object { $_.Trim() -ne '' }
    $content = $content -join "`n"
    
    # Add comment at top
    $content = "/* Page-specific styles for $($_.BaseName) */`n`n" + $content
    
    Set-Content -Path $cssFile.FullName -Value $content -Encoding UTF8
    Write-Host "  Cleaned up: $fileName" -ForegroundColor Green
}

Write-Host "`nCSS files cleaned!" -ForegroundColor Magenta
