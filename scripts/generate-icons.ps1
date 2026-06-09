# Génère les icônes PWA sans dépendance Node.js (Windows + .NET)
Add-Type -AssemblyName System.Drawing

$brandColor = [System.Drawing.ColorTranslator]::FromHtml("#0D192F")
$accentColor = [System.Drawing.ColorTranslator]::FromHtml("#3B82F6")
$iconsDir = Join-Path $PSScriptRoot "..\public\icons"

if (-not (Test-Path $iconsDir)) {
    New-Item -ItemType Directory -Path $iconsDir -Force | Out-Null
}

foreach ($size in @(192, 512)) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.Clear($brandColor)

    $fontSize = [math]::Round($size * 0.28)
    $font = New-Object System.Drawing.Font("Segoe UI", $fontSize, [System.Drawing.FontStyle]::Bold)
    $brush = New-Object System.Drawing.SolidBrush($accentColor)
    $text = "GN"
    $format = New-Object System.Drawing.StringFormat
    $format.Alignment = [System.Drawing.StringAlignment]::Center
    $format.LineAlignment = [System.Drawing.StringAlignment]::Center
    $rect = New-Object System.Drawing.RectangleF(0, 0, $size, $size)
    $g.DrawString($text, $font, $brush, $rect, $format)

    $outPath = Join-Path $iconsDir "icon-${size}x${size}.png"
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)

    $g.Dispose()
    $bmp.Dispose()
    Write-Host "Created $outPath"
}

Write-Host "Done."
