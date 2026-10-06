$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$outDir = Join-Path $root 'docs\store-assets'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

function New-RoundedPath([System.Drawing.RectangleF]$Rect, [float]$Radius) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $Radius * 2
  $path.AddArc($Rect.X, $Rect.Y, $d, $d, 180, 90)
  $path.AddArc(($Rect.Right - $d), $Rect.Y, $d, $d, 270, 90)
  $path.AddArc(($Rect.Right - $d), ($Rect.Bottom - $d), $d, $d, 0, 90)
  $path.AddArc($Rect.X, ($Rect.Bottom - $d), $d, $d, 90, 90)
  $path.CloseFigure()
  return $path
}

function New-PlayPath([float]$X, [float]$Y, [float]$Size) {
  $h = $Size * 1.12
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $path.AddPolygon(@(
    [System.Drawing.PointF]::new($X, ($Y - $h / 2)),
    [System.Drawing.PointF]::new($X, ($Y + $h / 2)),
    [System.Drawing.PointF]::new(($X + $Size), $Y)
  ))
  return $path
}

function Draw-CardBackdrop($g, [System.Drawing.RectangleF]$Rect, [float]$Angle) {
  $save = $g.Save()
  $cx = $Rect.X + $Rect.Width / 2
  $cy = $Rect.Y + $Rect.Height / 2
  $g.TranslateTransform($cx, $cy)
  $g.RotateTransform($Angle)
  $g.TranslateTransform(-$cx, -$cy)
  $path = New-RoundedPath (New-Object System.Drawing.RectangleF($Rect.X, $Rect.Y, $Rect.Width, $Rect.Height)) ($Rect.Width * 0.075)
  $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(70, 255, 255, 255))
  $g.FillPath($brush, $path)
  $brush.Dispose()
  $path.Dispose()
  $g.Restore($save)
}

function Draw-CardFront($g, [System.Drawing.RectangleF]$Rect, [float]$Angle) {
  $save = $g.Save()
  $cx = $Rect.X + $Rect.Width / 2
  $cy = $Rect.Y + $Rect.Height / 2
  $g.TranslateTransform($cx, $cy)
  $g.RotateTransform($Angle)
  $g.TranslateTransform(-$cx, -$cy)

  $radius = $Rect.Width * 0.075
  $path = New-RoundedPath $Rect $radius

  $shadowPath = New-RoundedPath (New-Object System.Drawing.RectangleF($Rect.X, ($Rect.Y + $Rect.Height * 0.035), $Rect.Width, $Rect.Height)) $radius
  $shadow = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(55, 60, 8, 10))
  $g.FillPath($shadow, $shadowPath)
  $shadow.Dispose()
  $shadowPath.Dispose()

  $card = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
  $g.FillPath($card, $path)
  $card.Dispose()

  $playSize = $Rect.Width * 0.30
  $playX = $Rect.X + $Rect.Width * 0.14
  $playY = $Rect.Y + $Rect.Height * 0.36
  $play = New-PlayPath $playX $playY $playSize
  $playPen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, ($playSize * 0.22))
  $playPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $playGrad = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.RectangleF($playX, ($playY - $playSize), ($playSize * 1.5), ($playSize * 2))),
    [System.Drawing.Color]::FromArgb(255, 248, 80, 86),
    [System.Drawing.Color]::FromArgb(255, 178, 24, 30), 60.0)
  $g.FillPath($playGrad, $play)
  $g.DrawPath($playPen, $play)
  $playGrad.Dispose()
  $playPen.Dispose()
  $play.Dispose()

  $lineColor = [System.Drawing.Color]::FromArgb(255, 209, 217, 226)
  $barH = $Rect.Height * 0.115
  $bars = @(
    @(($Rect.X + $Rect.Width * 0.55), ($Rect.Y + $Rect.Height * 0.22), ($Rect.Width * 0.30), $barH),
    @(($Rect.X + $Rect.Width * 0.55), ($Rect.Y + $Rect.Height * 0.40), ($Rect.Width * 0.22), $barH),
    @(($Rect.X + $Rect.Width * 0.14), ($Rect.Y + $Rect.Height * 0.62), ($Rect.Width * 0.72), $barH),
    @(($Rect.X + $Rect.Width * 0.14), ($Rect.Y + $Rect.Height * 0.80), ($Rect.Width * 0.50), $barH)
  )
  foreach ($bar in $bars) {
    $barRect = New-Object System.Drawing.RectangleF($bar[0], $bar[1], $bar[2], $bar[3])
    $barPath = New-RoundedPath $barRect ($barH / 2)
    $barBrush = New-Object System.Drawing.SolidBrush($lineColor)
    $g.FillPath($barBrush, $barPath)
    $barBrush.Dispose()
    $barPath.Dispose()
  }

  $path.Dispose()
  $g.Restore($save)
}

function New-PromoCanvas([int]$W, [int]$H) {
  $bmp = New-Object System.Drawing.Bitmap($W, $H)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

  $rect = New-Object System.Drawing.Rectangle(0, 0, $W, $H)
  $bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, [System.Drawing.Color]::FromArgb(255, 255, 104, 109), [System.Drawing.Color]::FromArgb(255, 168, 20, 27), 35.0)
  $g.FillRectangle($bg, $rect)
  $bg.Dispose()

  $glow = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(38, 255, 255, 255))
  $g.FillEllipse($glow, (-[int]($W * 0.25)), (-[int]($H * 0.85)), ([int]($W * 0.85)), ([int]($H * 1.7)))
  $glow.Dispose()

  $vignette = New-Object System.Drawing.Drawing2D.GraphicsPath
  $vignette.AddEllipse(([int]($W * 0.62)), (-[int]($H * 0.25)), ([int]($W * 0.75)), ([int]($H * 1.5)))
  $vBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(26, 60, 0, 4))
  $g.FillPath($vBrush, $vignette)
  $vBrush.Dispose()
  $vignette.Dispose()

  return @($bmp, $g)
}

# ---- Small promo tile: 440 x 280 (required) ----
$pair = New-PromoCanvas 440 280
$bmp = $pair[0]; $g = $pair[1]
Draw-CardBackdrop $g (New-Object System.Drawing.RectangleF(196, 66, 150, 114)) 10.0
Draw-CardFront $g (New-Object System.Drawing.RectangleF(150, 58, 178, 136)) -8.0
$bmp.Save((Join-Path $outDir 'promo-440x280.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
Write-Output 'wrote promo-440x280.png'

# ---- Marquee tile: 1400 x 560 (optional) ----
$pair = New-PromoCanvas 1400 560
$bmp = $pair[0]; $g = $pair[1]
Draw-CardBackdrop $g (New-Object System.Drawing.RectangleF(508, 118, 360, 274)) 9.0
Draw-CardFront $g (New-Object System.Drawing.RectangleF(560, 96, 420, 320)) -8.0
$bmp.Save((Join-Path $outDir 'promo-1400x560.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
Write-Output 'wrote promo-1400x560.png'

Write-Output 'DONE — promotional images generated'