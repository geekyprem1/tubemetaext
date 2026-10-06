$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$outDir = Join-Path $env:COMMANDCODE_SCRATCHPAD 'logos'
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

function Add-SoftShadow($g, $path, [int]$OffsetY, [int]$Spread, [int]$Alpha, [int]$Layers) {
  for ($i = $Layers; $i -ge 1; $i--) {
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

function Draw-RoundedShape($g, $path, $brush, $outlineColor, $outlineWidth) {
  $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(40, 0, 0, 0), 8)
  $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $g.FillPath($brush, $path)
  if ($outlineWidth -gt 0) {
    $stroke = New-Object System.Drawing.Pen($outlineColor, $outlineWidth)
    $stroke.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    $g.FillPath($stroke.Brush, $path)
    $g.DrawPath($stroke, $path)
    $stroke.Dispose()
  }
  $pen.Dispose()
}

function New-Canvas {
  $bmp = New-Object System.Drawing.Bitmap($M, $M)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  return @($bmp, $g)
}

function Save-Sizes($master, [string]$name) {
  foreach ($size in @(512, 128, 48, 16)) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.DrawImage($master, 0, 0, $size, $size)
    $g.Dispose()
    $bmp.Save((Join-Path $outDir "$name-$size.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
  }
  Write-Output "saved $name (512/128/48/16)"
}

# ---------- Concept 1: Play Tile (red gradient squircle + white play) ----------
function Draw-Concept1 {
  $pair = New-Canvas; $bmp = $pair[0]; $g = $pair[1]
  $tileRect = New-Object System.Drawing.RectangleF(52, 52, 920, 920)
  $tile = New-RoundedPath $tileRect 214
  Add-SoftShadow $g $tile 26 4 26 4
  $grad = New-Object System.Drawing.Drawing2D.LinearGradientBrush((New-Object System.Drawing.Rectangle(52, 52, 920, 920)), [System.Drawing.Color]::FromArgb(255, 255, 94, 99), [System.Drawing.Color]::FromArgb(255, 191, 31, 38), 90.0)
  $g.FillPath($grad, $tile)
  Add-GlassSheen $g $tile $tileRect
  $innerPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(46, 255, 255, 255), 8)
  $g.DrawPath($innerPen, $tile)
  $play = New-PlayPath 396 512 316
  Add-SoftShadow $g $play 14 10 60 3
  $white = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
  $triPen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, 52)
  $triPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $g.FillPath($white, $play)
  $g.DrawPath($triPen, $play)
  Save-Sizes $bmp 'concept1-play-tile'
  $g.Dispose(); $bmp.Dispose()
}

# ---------- Concept 2: Meta Rows (dark tile + red play + white bars) ----------
function Draw-Concept2 {
  $pair = New-Canvas; $bmp = $pair[0]; $g = $pair[1]
  $tileRect = New-Object System.Drawing.RectangleF(52, 52, 920, 920)
  $tile = New-RoundedPath $tileRect 214
  Add-SoftShadow $g $tile 26 4 26 4
  $dark = New-Object System.Drawing.Drawing2D.LinearGradientBrush((New-Object System.Drawing.Rectangle(52, 52, 920, 920)), [System.Drawing.Color]::FromArgb(255, 40, 49, 62), [System.Drawing.Color]::FromArgb(255, 15, 20, 28), 90.0)
  $g.FillPath($dark, $tile)
  Add-GlassSheen $g $tile $tileRect
  $innerPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(38, 255, 255, 255), 8)
  $g.DrawPath($innerPen, $tile)
  $play = New-PlayPath 288 352 236
  $red = New-Object System.Drawing.Drawing2D.LinearGradientBrush((New-Object System.Drawing.Rectangle(270, 230, 300, 300)), [System.Drawing.Color]::FromArgb(255, 255, 105, 110), [System.Drawing.Color]::FromArgb(255, 198, 40, 46), 55.0)
  $playPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 214, 47, 53), 40)
  $playPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $g.FillPath($red, $play)
  $g.DrawPath($playPen, $play)
  $barSpecs = @(
    @(288, 505, 448, 78, 235),
    @(288, 631, 352, 78, 175),
    @(288, 757, 260, 78, 120)
  )
  foreach ($spec in $barSpecs) {
    $bar = New-RoundedPath (New-Object System.Drawing.RectangleF($spec[0], $spec[1], $spec[2], $spec[3])) ($spec[3] / 2)
    $barBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 232, 239, 247))
    $g.FillPath($barBrush, $bar)
    $barBrush.Dispose()
    $bar.Dispose()
  }
  Save-Sizes $bmp 'concept2-meta-rows'
  $g.Dispose(); $bmp.Dispose()
}

# ---------- Concept 3: Light Monogram T (light tile + red gradient T) ----------
function Draw-Concept3 {
  $pair = New-Canvas; $bmp = $pair[0]; $g = $pair[1]
  $tileRect = New-Object System.Drawing.RectangleF(52, 52, 920, 920)
  $tile = New-RoundedPath $tileRect 214
  Add-SoftShadow $g $tile 26 4 22 4
  $light = New-Object System.Drawing.Drawing2D.LinearGradientBrush((New-Object System.Drawing.Rectangle(52, 52, 920, 920)), [System.Drawing.Color]::White, [System.Drawing.Color]::FromArgb(255, 232, 236, 241), 90.0)
  $g.FillPath($light, $tile)
  $borderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(30, 20, 30, 45), 6)
  $g.DrawPath($borderPen, $tile)
  $glow = New-Object System.Drawing.Drawing2D.GraphicsPath
  $glow.AddEllipse(180, 300, 664, 560)
  $glowBrush = New-Object System.Drawing.Drawing2D.PathGradientBrush($glow)
  $glowBrush.CenterColor = [System.Drawing.Color]::FromArgb(60, 235, 60, 66)
  $glowBrush.SurroundColors = @([System.Drawing.Color]::FromArgb(0, 235, 60, 66))
  $g.FillPath($glowBrush, $glow)
  $stem = New-RoundedPath (New-Object System.Drawing.RectangleF(452, 336, 120, 400)) 60
  $topBar = New-RoundedPath (New-Object System.Drawing.RectangleF(268, 296, 488, 120)) 60
  $tGrad = New-Object System.Drawing.Drawing2D.LinearGradientBrush((New-Object System.Drawing.Rectangle(268, 296, 488, 440)), [System.Drawing.Color]::FromArgb(255, 248, 80, 86), [System.Drawing.Color]::FromArgb(255, 184, 27, 33), 90.0)
  Add-SoftShadow $g $topBar 16 6 46 3
  $g.FillPath($tGrad, $topBar)
  $g.FillPath($tGrad, $stem)
  # small play accent bottom right of the T
  $accent = New-PlayPath 640 590 150
  $accentPen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, 34)
  $accentPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $accentGrad = New-Object System.Drawing.Drawing2D.LinearGradientBrush((New-Object System.Drawing.Rectangle(620, 500, 260, 220)), [System.Drawing.Color]::FromArgb(255, 248, 80, 86), [System.Drawing.Color]::FromArgb(255, 184, 27, 33), 60.0)
  $g.FillPath($accentGrad, $accent)
  $g.DrawPath($accentPen, $accent)
  Save-Sizes $bmp 'concept3-light-monogram'
  $g.Dispose(); $bmp.Dispose()
}

# ---------- Concept 4: Tilted Card (red tile + rotated metadata card) ----------
function Draw-Concept4 {
  $pair = New-Canvas; $bmp = $pair[0]; $g = $pair[1]
  $tileRect = New-Object System.Drawing.RectangleF(52, 52, 920, 920)
  $tile = New-RoundedPath $tileRect 214
  Add-SoftShadow $g $tile 26 4 26 4
  $grad = New-Object System.Drawing.Drawing2D.LinearGradientBrush((New-Object System.Drawing.Rectangle(52, 52, 920, 920)), [System.Drawing.Color]::FromArgb(255, 255, 94, 99), [System.Drawing.Color]::FromArgb(255, 186, 28, 34), 90.0)
  $g.FillPath($grad, $tile)
  Add-GlassSheen $g $tile $tileRect
  $innerPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(46, 255, 255, 255), 8)
  $g.DrawPath($innerPen, $tile)
  $g.TranslateTransform(512, 512)
  $g.RotateTransform(-8)
  $g.TranslateTransform(-512, -512)
  $card = New-RoundedPath (New-Object System.Drawing.RectangleF(232, 300, 560, 424)) 46
  Add-SoftShadow $g $card 22 6 60 4
  $cardBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
  $g.FillPath($cardBrush, $card)
  $play = New-PlayPath 300 390 150
  $playPen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, 30)
  $playPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $playGrad = New-Object System.Drawing.Drawing2D.LinearGradientBrush((New-Object System.Drawing.Rectangle(280, 320, 240, 200)), [System.Drawing.Color]::FromArgb(255, 248, 80, 86), [System.Drawing.Color]::FromArgb(255, 186, 28, 34), 60.0)
  $g.FillPath($playGrad, $play)
  $g.DrawPath($playPen, $play)
  $lineSpecs = @(
    @(492, 344, 240, 46, 110),
    @(492, 428, 190, 46, 110),
    @(300, 560, 432, 46, 120),
    @(300, 636, 300, 46, 120)
  )
  foreach ($spec in $lineSpecs) {
    $line = New-RoundedPath (New-Object System.Drawing.RectangleF($spec[0], $spec[1], $spec[2], $spec[3])) ($spec[3] / 2)
    $lineBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 214, 221, 229))
    $g.FillPath($lineBrush, $line)
    $lineBrush.Dispose()
    $line.Dispose()
  }
  Save-Sizes $bmp 'concept4-tilted-card'
  $g.Dispose(); $bmp.Dispose()
}

Draw-Concept1
Draw-Concept2
Draw-Concept3
Draw-Concept4
Write-Output "ALL DONE -> $outDir"