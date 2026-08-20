$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$resRoot = Join-Path $projectRoot "android\app\src\main\res"

Add-Type -AssemblyName System.Drawing

function New-RoundedRectPath {
  param(
    [System.Drawing.RectangleF]$Rect,
    [float]$Radius
  )

  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $diameter = $Radius * 2
  $path.AddArc($Rect.X, $Rect.Y, $diameter, $diameter, 180, 90)
  $path.AddArc($Rect.Right - $diameter, $Rect.Y, $diameter, $diameter, 270, 90)
  $path.AddArc($Rect.Right - $diameter, $Rect.Bottom - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($Rect.X, $Rect.Bottom - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

function Draw-CountHubIcon {
  param(
    [int]$Size,
    [string]$OutputPath
  )

  $bitmap = New-Object System.Drawing.Bitmap $Size, $Size
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.Clear([System.Drawing.Color]::FromArgb(15, 23, 42))

  $outerRect = New-Object System.Drawing.RectangleF ($Size * 0.16), ($Size * 0.13), ($Size * 0.68), ($Size * 0.74)
  $outerPath = New-RoundedRectPath -Rect $outerRect -Radius ($Size * 0.09)
  $outerBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(20, 184, 166))
  $graphics.FillPath($outerBrush, $outerPath)

  $innerRect = New-Object System.Drawing.RectangleF ($Size * 0.24), ($Size * 0.21), ($Size * 0.52), ($Size * 0.58)
  $innerPath = New-RoundedRectPath -Rect $innerRect -Radius ($Size * 0.06)
  $innerBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(240, 253, 250))
  $graphics.FillPath($innerBrush, $innerPath)

  $lineBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(15, 23, 42))
  $lineHeight = [Math]::Max(4, [int]($Size * 0.045))
  $lineRadius = [Math]::Max(4, [int]($Size * 0.02))
  $lineYPositions = @(
    ($Size * 0.31),
    ($Size * 0.42),
    $Size * 0.53
  )

  foreach ($lineY in $lineYPositions) {
    $lineRect = New-Object System.Drawing.RectangleF ($Size * 0.31), $lineY, ($Size * 0.34), $lineHeight
    $linePath = New-RoundedRectPath -Rect $lineRect -Radius $lineRadius
    $graphics.FillPath($lineBrush, $linePath)
    $linePath.Dispose()
  }

  $dotBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(244, 63, 94))
  $dotSize = $Size * 0.1
  $graphics.FillEllipse($dotBrush, $Size * 0.58, $Size * 0.63, $dotSize, $dotSize)

  $badgeBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(15, 23, 42))
  $badgeRect = New-Object System.Drawing.RectangleF ($Size * 0.18), ($Size * 0.68), ($Size * 0.22), ($Size * 0.12)
  $badgePath = New-RoundedRectPath -Rect $badgeRect -Radius ($Size * 0.04)
  $graphics.FillPath($badgeBrush, $badgePath)

  $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)

  $badgePath.Dispose()
  $dotBrush.Dispose()
  $lineBrush.Dispose()
  $innerBrush.Dispose()
  $innerPath.Dispose()
  $outerBrush.Dispose()
  $outerPath.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
}

$targets = @{
  "mipmap-mdpi\ic_launcher.png" = 48
  "mipmap-mdpi\ic_launcher_round.png" = 48
  "mipmap-mdpi\ic_launcher_foreground.png" = 48
  "mipmap-hdpi\ic_launcher.png" = 72
  "mipmap-hdpi\ic_launcher_round.png" = 72
  "mipmap-hdpi\ic_launcher_foreground.png" = 72
  "mipmap-xhdpi\ic_launcher.png" = 96
  "mipmap-xhdpi\ic_launcher_round.png" = 96
  "mipmap-xhdpi\ic_launcher_foreground.png" = 96
  "mipmap-xxhdpi\ic_launcher.png" = 144
  "mipmap-xxhdpi\ic_launcher_round.png" = 144
  "mipmap-xxhdpi\ic_launcher_foreground.png" = 144
  "mipmap-xxxhdpi\ic_launcher.png" = 192
  "mipmap-xxxhdpi\ic_launcher_round.png" = 192
  "mipmap-xxxhdpi\ic_launcher_foreground.png" = 192
}

foreach ($target in $targets.GetEnumerator()) {
  $outputPath = Join-Path $resRoot $target.Key
  Draw-CountHubIcon -Size $target.Value -OutputPath $outputPath
}

Write-Output "[android-icons] generated CountHub launcher assets"
