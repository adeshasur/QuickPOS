# Script to update HTML files to use common.css and common.js

$rendererPath = "E:\Project\QuickPOS\src\renderer"

Get-ChildItem "$rendererPath\*.html" | ForEach-Object {
    $htmlFile = $_
    $fileName = $_.BaseName
    
    Write-Host "Updating: $($htmlFile.Name)" -ForegroundColor Cyan
    
    $content = Get-Content $htmlFile.FullName -Raw
    
    # Add common.css after the title tag
    if ($content -match '<title>.*?</title>') {
        $titleTag = $matches[0]
        $commonCssLink = '<link rel="stylesheet" href="../styles/common.css">' + "`n    "
        $content = $content -replace [regex]::Escape($titleTag), ($titleTag + "`n    " + $commonCssLink)
    }
    
    # Add common.js before the page-specific JS
    if ($content -match '<script src="js/' + [regex]::Escape($fileName) + '\.js"></script>') {
        $pageJs = $matches[0]
        $commonJsScript = '<script src="js/common.js"></script>' + "`n    "
        $content = $content -replace [regex]::Escape($pageJs), ($commonJsScript + $pageJs)
    }
    
    # Save updated HTML
    Set-Content -Path $htmlFile.FullName -Value $content -Encoding UTF8
    Write-Host "  Updated to include common files" -ForegroundColor Green
}

Write-Host "`nHTML files updated!" -ForegroundColor Magenta
