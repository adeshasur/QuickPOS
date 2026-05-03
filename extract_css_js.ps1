# Script to extract CSS and JS from HTML files

$rendererPath = "E:\Project\QuickPOS\src\renderer"
$stylesPath = "E:\Project\QuickPOS\src\styles"
$jsPath = "E:\Project\QuickPOS\src\renderer\js"

Get-ChildItem "$rendererPath\*.html" | ForEach-Object {
    $htmlFile = $_
    $fileName = $_.BaseName
    
    Write-Host "Processing: $($htmlFile.Name)" -ForegroundColor Cyan
    
    $content = Get-Content $htmlFile.FullName -Raw
    
    # Extract CSS
    if ($content -match '(?s)<style>(.*?)</style>') {
        $cssContent = $matches[1]
        $cssFile = Join-Path $stylesPath "$fileName.css"
        Set-Content -Path $cssFile -Value $cssContent -Encoding UTF8
        Write-Host "  Extracted CSS to: $fileName.css" -ForegroundColor Green
        
        # Remove style tag and add link
        $content = $content -replace '(?s)<style>.*?</style>', "`n    <link rel=`"stylesheet`" href=`"../styles/$fileName.css`">"
    }
    
    # Extract JS
    if ($content -match '(?s)<script>(.*?)</script>') {
        $jsContent = $matches[1]
        $jsFile = Join-Path $jsPath "$fileName.js"
        Set-Content -Path $jsFile -Value $jsContent -Encoding UTF8
        Write-Host "  Extracted JS to: $fileName.js" -ForegroundColor Green
        
        # Remove script tag and add script src
        $content = $content -replace '(?s)<script>.*?</script>', "<script src=`"js/$fileName.js`"></script>"
    }
    
    # Save updated HTML
    Set-Content -Path $htmlFile.FullName -Value $content -Encoding UTF8
    Write-Host "  Updated HTML file" -ForegroundColor Yellow
}
Write-Host "`nDone! All files processed." -ForegroundColor Magenta
