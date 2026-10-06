param(
  [string]$Root = (Split-Path -Parent $PSScriptRoot)
)

Add-Type -AssemblyName System.Drawing

function New-RoundedPath([System.Drawing.Rectangle]$Rect, [int]$Radius) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $Radius * 2
  $path.AddArc($Rect.X, $Rect.Y, $d, $d, 180, 90)
  $path.AddArc(($Rect.Right - $d), $Rect.Y, $d, $d, 270, 90)
  $path.AddArc(($Rect.Right - $d), ($Rect.Bottom - $d), $d, $d, 0, 90)
  $path.AddArc($Rect.X, ($Rect.Bottom - $d), $d, $d, 90, 90)
  $path.CloseFigure()
  return $path
}

function Compose-Shot {
  param(
    [string]$SrcPath,
    [string]$OutPath,
    [int]$SrcCropW,
    [string[]]$Headline,
    [string[]]$Bullets
  )

  $src = [System.Drawing.Image]::FromFile($SrcPath)
  $bmp = New-Object System.Drawing.Bitmap(1280, 800)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

  $full = New-Object System.Drawing.Rectangle(0, 0, 1280, 800)
  $bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush($full, [System.Drawing.Color]::FromArgb(255, 14, 20, 29), [System.Drawing.Color]::FromArgb(255, 31, 44, 60), 90.0)
  $g.FillRectangle($bg, $full)

  $glow = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(16, 245, 97, 102))
  $g.FillEllipse($glow, 60, 540, 560, 380)

  $icon = [System.Drawing.Image]::FromFile((Join-Path $Root 'public\icons\icon128.png'))
  $g.DrawImage($icon, 90, 62, 44, 44)
  $fBrand = New-Object System.Drawing.Font('Segoe UI', 25, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $g.DrawString('TubeMeta AI', $fBrand, [System.Drawing.Brushes]::White, 148, 70)

  $fHead = New-Object System.Drawing.Font('Segoe UI', 43, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $y = 186
  foreach ($line in $Headline) {
    $g.DrawString($line, $fHead, [System.Drawing.Brushes]::White, 88, $y)
    $y += 55
  }

  $fBul = New-Object System.Drawing.Font('Segoe UI', 22, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
  $bulletBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 201, 213, 227))
  $bulletChar = [char]0x2022
  $y += 24
  foreach ($bullet in $Bullets) {
    $g.DrawString(($bulletChar.ToString() + '  ' + $bullet), $fBul, $bulletBrush, 90, $y)
    $y += 41
  }

  $scale = [Math]::Min(1.26, 720.0 / $src.Height)
  $dw = [int]($SrcCropW * $scale)
  $dh = [int]($src.Height * $scale)
  $dx = 1280 - $dw - 84
  $dy = [int]((800 - $dh) / 2)

  $shadowRect = New-Object System.Drawing.Rectangle(($dx - 6), ($dy + 2), ($dw + 12), ($dh + 14))
  $shadowPath = New-RoundedPath $shadowRect 20
  $shadowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(60, 0, 0, 0))
  $g.FillPath($shadowBrush, $shadowPath)
  $shadowPath2 = New-RoundedPath (New-Object System.Drawing.Rectangle(($dx - 2), ($dy + 6), ($dw + 4), ($dh + 6))) 18
  $shadowBrush2 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(80, 0, 0, 0))
  $g.FillPath($shadowBrush2, $shadowPath2)

  $cardRect = New-Object System.Drawing.Rectangle($dx, $dy, $dw, $dh)
  $cardPath = New-RoundedPath $cardRect 14
  $g.SetClip($cardPath)
  $destRect = New-Object System.Drawing.Rectangle($dx, $dy, $dw, $dh)
  $g.DrawImage($src, $destRect, 0, 0, $SrcCropW, $src.Height, [System.Drawing.GraphicsUnit]::Pixel)
  $g.ResetClip()
  $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(110, 150, 170, 195), 1)
  $g.DrawPath($pen, $cardPath)

  $bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)

  $g.Dispose()
  $bmp.Dispose()
  $src.Dispose()
  $icon.Dispose()
  Write-Output "wrote $OutPath"
}

$outDir = Join-Path $Root 'docs\store-assets'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

Compose-Shot (Join-Path $Root 'docs\store-assets\raw\video-1-ready.png') (Join-Path $outDir 'screenshot-1-extract.png') 384 @("Extract a video's metadata", 'in one click') @('Title, description, tags, hashtags', 'Duration, views, publish date, channel', 'Local-only: no account, no uploads')

Compose-Shot (Join-Path $Root 'docs\store-assets\raw\video-2-editing.png') (Join-Path $outDir 'screenshot-2-edit.png') 384 @('Edit any field', 'before you copy') @('Every field is editable', '"Edited" badge with one-click reset', 'Drafts stay per video for the session')

Compose-Shot (Join-Path $Root 'docs\store-assets\raw\video-3-copy.png') (Join-Path $outDir 'screenshot-3-copy.png') 384 @('Copy one field -', 'or everything') @('Clean fixed format with exact values', 'Details: URL, channel, date, views', 'Confirmation you can see and hear')
