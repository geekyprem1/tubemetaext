$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$outDir = Join-Path $root 'public\icons'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$M = 1024

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

function Add-SoftShadow($g, $path, [int]$OffsetY, [int]$Spread, [int]$Alpha) {
  for ($i = 4; $i -ge 1; $i--) {
    $m = New-Object System.Drawing.Drawing2D.Matrix
    $m.Translate(0, $OffsetY + $i * 2)
    $shadowPath = $path.Clone()
    $shadowPath.Transform($m)
    $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb([int]($Alpha / $i), 0, 0, 0), ($Spread + $i * 6))
    $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    $g.DrawPath($pen, $shadowPath)
    $pen.Dispose()
    $shadowPath.Dispose()
    $m.Dispose()
  }
}

function Add-GlassSheen($g, $tilePath, [System.Drawing.RectangleF]$Rect) {
  $state = $g.Save()
  $g.SetClip($tilePath)
  $sheen = New-Object System.Drawing.Drawing2D.GraphicsPath
  $sheen.AddEllipse(($Rect.X - $Rect.Width * 0.55), ($Rect.Y - $Rect.Height * 0.95), ($Rect.Width * 1.7), ($Rect.Height * 1.35))
  $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.RectangleF($Rect.X, ($Rect.Y - $Rect.Height), $Rect.Width, ($Rect.Height * 1.4))),
    [System.Drawing.Color]::FromArgb(52, 255, 255, 255),
    [System.Drawing.Color]::FromArgb(0, 255, 255, 255), 90.0)
  $g.FillPath($brush, $sheen)
  $brush.Dispose()
  $sheen.Dispose()
  $g.Restore($state)
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

function New-IconMaster([int]$Variant) {
  $bmp = New-Object System.Drawing.Bitmap($M, $M)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

  $tileRect = New-Object System.Drawing.RectangleF(52, 52, 920, 920)
  $tile = New-RoundedPath $tileRect 214
  Add-SoftShadow $g $tile 26 4 26
  $grad = New-Object System.Drawing.Drawing2D.LinearGradientBrush((New-Object System.Drawing.Rectangle(52, 52, 920, 920)), [System.Drawing.Color]::FromArgb(255, 255, 94, 99), [System.Drawing.Color]::FromArgb(255, 186, 28, 34), 90.0)
  $g.FillPath($grad, $tile)
  Add-GlassSheen $g $tile $tileRect
  $innerPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(46, 255, 255, 255), 8)
  $g.DrawPath($innerPen, $tile)

  $g.TranslateTransform(512, 512)
  $g.RotateTransform(-8)
  $g.TranslateTransform(-512, -512)

  $cardBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
  $playPen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, 0)
  $gradientTop = [System.Drawing.Color]::FromArgb(255, 248, 80, 86)
  $gradientBottom = [System.Drawing.Color]::FromArgb(255, 186, 28, 34)

  if ($Variant -eq 0) {
    # Detailed variant for 48 / 128
    $card = New-RoundedPath (New-Object System.Drawing.RectangleF(232, 300, 560, 424)) 46
    Add-SoftShadow $g $card 22 6 60
    $g.FillPath($cardBrush, $card)
    $play = New-PlayPath 300 390 150
    $playPen.Width = 30
    $playPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    $playGrad = New-Object System.Drawing.Drawing2D.LinearGradientBrush((New-Object System.Drawing.Rectangle(280, 320, 240, 200)), $gradientTop, $gradientBottom, 60.0)
    $g.FillPath($playGrad, $play)
    $g.DrawPath($playPen, $play)
    $lineSpecs = @(
      @(492, 344, 240, 46),
      @(492, 428, 190, 46),
      @(300, 560, 432, 46),
      @(300, 636, 300, 46)
    )
    foreach ($spec in $lineSpecs) {
      $line = New-RoundedPath (New-Object System.Drawing.RectangleF($spec[0], $spec[1], $spec[2], $spec[3])) ($spec[3] / 2)
      $lineBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 214, 221, 229))
      $g.FillPath($lineBrush, $line)
      $lineBrush.Dispose()
      $line.Dispose()
    }
    $playPen.Dispose()
    $playGrad.Dispose()
    $play.Dispose()
  } else {
    # Bold simplified variant for 16 / 32
    $card = New-RoundedPath (New-Object System.Drawing.RectangleF(216, 318, 592, 452)) 50
    Add-SoftShadow $g $card 22 6 60
    $g.FillPath($cardBrush, $card)
    $play = New-PlayPath 298 438 208
    $playPen.Width = 40
    $playPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    $playGrad = New-Object System.Drawing.Drawing2D.LinearGradientBrush((New-Object System.Drawing.Rectangle(280, 330, 280, 240)), $gradientTop, $gradientBottom, 60.0)
    $g.FillPath($playGrad, $play)
    $g.DrawPath($playPen, $play)
    $lineSpecs = @(
      @(298, 596, 432, 64),
      @(298, 692, 300, 64)
    )
    foreach ($spec in $lineSpecs) {
      $line = New-RoundedPath (New-Object System.Drawing.RectangleF($spec[0], $spec[1], $spec[2], $spec[3])) ($spec[3] / 2)
      $lineBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 206, 214, 224))
      $g.FillPath($lineBrush, $line)
      $lineBrush.Dispose()
      $line.Dispose()
    }
    $playPen.Dispose()
    $playGrad.Dispose()
    $play.Dispose()
  }

  $cardBrush.Dispose()
  $g.Dispose()
  return $bmp
}

function Save-Resized($master, [int]$size, [string]$path) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.DrawImage($master, 0, 0, $size, $size)
  $g.Dispose()
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Output "wrote $path"
}

function Save-Inset($master, [int]$size, [int]$inset, [string]$path) {
  # Chrome Web Store store-icon convention: 96x96 artwork inside a 128x128
  # image with 16 px of transparent padding on each side.
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.DrawImage($master, $inset, $inset, ($size - 2 * $inset), ($size - 2 * $inset))
  $g.Dispose()
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Output "wrote $path (artwork $($size - 2 * $inset) + $inset px transparent padding per side)"
}

$detailed = New-IconMaster 0
$bold = New-IconMaster 1

Save-Resized $bold 16 (Join-Path $outDir 'icon16.png')
Save-Resized $bold 32 (Join-Path $outDir 'icon32.png')
Save-Resized $detailed 48 (Join-Path $outDir 'icon48.png')
Save-Inset $detailed 128 16 (Join-Path $outDir 'icon128.png')

$detailed.Dispose()
$bold.Dispose()
Write-Output 'DONE — production icons generated (bold variant for 16/32, detailed for 48/128)'