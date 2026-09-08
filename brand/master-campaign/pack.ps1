param(
  [string]$BuildDate = '2026-09-07',
  [switch]$ReplaceExisting
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$CampaignRoot = [System.IO.Path]::GetFullPath($PSScriptRoot)
$RepoRoot = [System.IO.Path]::GetFullPath((Join-Path $CampaignRoot '..\..'))
$ShareRoot = [System.IO.Path]::GetFullPath((Join-Path $RepoRoot 'output\share'))
$PhoneName = "OMERTA-Complete-Marketing-Campaign-Phone-$BuildDate"
$MasterName = "OMERTA-Complete-Marketing-Campaign-Master-$BuildDate"
$PhoneRoot = [System.IO.Path]::GetFullPath((Join-Path $ShareRoot $PhoneName))
$PhoneZip = [System.IO.Path]::GetFullPath((Join-Path $ShareRoot "$PhoneName.zip"))
$MasterZip = [System.IO.Path]::GetFullPath((Join-Path $ShareRoot "$MasterName.zip"))
$Checksums = [System.IO.Path]::GetFullPath((Join-Path $ShareRoot "OMERTA-Complete-Marketing-Campaign-SHA256-$BuildDate.txt"))

if (-not $PhoneRoot.StartsWith($ShareRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Phone output escaped the intended share directory: $PhoneRoot"
}

foreach ($Target in @($PhoneZip, $MasterZip, $Checksums)) {
  if ((Test-Path -LiteralPath $Target) -and -not $ReplaceExisting) {
    throw "Refusing to overwrite an existing campaign output: $Target"
  }
}

New-Item -ItemType Directory -Path $ShareRoot -Force | Out-Null
New-Item -ItemType Directory -Path $PhoneRoot -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $PhoneRoot 'cards') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $PhoneRoot 'contact-sheets') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $PhoneRoot 'editorial-art') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $PhoneRoot 'docs') -Force | Out-Null

function Convert-ToJpeg {
  param(
    [Parameter(Mandatory)][string]$Source,
    [Parameter(Mandatory)][string]$Destination,
    [int]$MaxWidth = 1080,
    [long]$Quality = 88
  )

  $TemporaryDestination = "$Destination.tmp.jpg"
  $Image = [System.Drawing.Image]::FromFile($Source)
  try {
    $Scale = [Math]::Min(1.0, $MaxWidth / $Image.Width)
    $Width = [Math]::Max(1, [int][Math]::Round($Image.Width * $Scale))
    $Height = [Math]::Max(1, [int][Math]::Round($Image.Height * $Scale))
    $Bitmap = New-Object System.Drawing.Bitmap($Width, $Height, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
    try {
      $Graphics = [System.Drawing.Graphics]::FromImage($Bitmap)
      try {
        $Graphics.Clear([System.Drawing.Color]::FromArgb(8, 9, 10))
        $Graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $Graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $Graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $Graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $Graphics.DrawImage($Image, 0, 0, $Width, $Height)
      }
      finally {
        $Graphics.Dispose()
      }

      $Encoder = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object MimeType -eq 'image/jpeg' | Select-Object -First 1
      $Parameters = New-Object System.Drawing.Imaging.EncoderParameters(1)
      try {
        $Parameters.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, $Quality)
        $Bitmap.Save($TemporaryDestination, $Encoder, $Parameters)
      }
      finally {
        $Parameters.Dispose()
      }
    }
    finally {
      $Bitmap.Dispose()
    }
  }
  finally {
    $Image.Dispose()
  }
  Move-Item -LiteralPath $TemporaryDestination -Destination $Destination -Force
}

$LaneDirectories = Get-ChildItem -LiteralPath (Join-Path $CampaignRoot 'png') -Directory | Sort-Object Name
foreach ($Lane in $LaneDirectories) {
  $DestinationLane = Join-Path (Join-Path $PhoneRoot 'cards') $Lane.Name
  New-Item -ItemType Directory -Path $DestinationLane -Force | Out-Null
  foreach ($Card in (Get-ChildItem -LiteralPath $Lane.FullName -Filter '*.png' -File | Sort-Object Name)) {
    $Destination = Join-Path $DestinationLane ($Card.BaseName + '.jpg')
    if ($ReplaceExisting -or -not (Test-Path -LiteralPath $Destination)) {
      Convert-ToJpeg -Source $Card.FullName -Destination $Destination -MaxWidth 1080 -Quality 88
    }
  }
}

$PhoneOverview = Join-Path $PhoneRoot '00-master-overview-16x9.jpg'
if ($ReplaceExisting -or -not (Test-Path -LiteralPath $PhoneOverview)) {
  Convert-ToJpeg -Source (Join-Path $CampaignRoot 'png\00-master-overview-16x9.png') -Destination $PhoneOverview -MaxWidth 1920 -Quality 90
}

foreach ($Sheet in (Get-ChildItem -LiteralPath (Join-Path $CampaignRoot 'contact-sheets') -Filter '*.png' -File | Sort-Object Name)) {
  $Destination = Join-Path (Join-Path $PhoneRoot 'contact-sheets') ($Sheet.BaseName + '.jpg')
  if ($ReplaceExisting -or -not (Test-Path -LiteralPath $Destination)) {
    Convert-ToJpeg -Source $Sheet.FullName -Destination $Destination -MaxWidth 1500 -Quality 88
  }
}

foreach ($Editorial in (Get-ChildItem -LiteralPath (Join-Path $CampaignRoot 'art') -Filter '*.png' -File | Sort-Object Name)) {
  $Destination = Join-Path (Join-Path $PhoneRoot 'editorial-art') ($Editorial.BaseName + '.jpg')
  if ($ReplaceExisting -or -not (Test-Path -LiteralPath $Destination)) {
    Convert-ToJpeg -Source $Editorial.FullName -Destination $Destination -MaxWidth 1920 -Quality 90
  }
}

Copy-Item -Path (Join-Path $CampaignRoot 'docs\*') -Destination (Join-Path $PhoneRoot 'docs') -Recurse
Copy-Item -LiteralPath (Join-Path $CampaignRoot 'README.md') -Destination (Join-Path $PhoneRoot 'README.md')
Copy-Item -LiteralPath (Join-Path $CampaignRoot 'gallery-phone.html') -Destination (Join-Path $PhoneRoot 'gallery.html')

$PhoneCopyPath = Join-Path $PhoneRoot 'docs\X-COPY.md'
$PhoneCopy = [System.IO.File]::ReadAllText($PhoneCopyPath)
$PhoneCopy = $PhoneCopy.Replace('../png/', '../cards/').Replace('.png)', '.jpg)')
[System.IO.File]::WriteAllText($PhoneCopyPath, $PhoneCopy, [System.Text.UTF8Encoding]::new($false))

$PhoneReadme = @"
OMERTÀ COMPLETE MARKETING CAMPAIGN — PHONE PACK

Open gallery.html in a browser to browse all 108 cards with their matching X copy.
Open docs/X-COPY.md for the copy bank.
Open docs/PUBLISHING-CALENDAR.csv for the dated posting order.
Use 00-master-overview-16x9.jpg as the pinned campaign opener.

Every graphic includes a status tag. Re-check production status before posting.
IN BUILD does not mean live. BUILT / DORMANT does not mean withdrawals are open.
"@
[System.IO.File]::WriteAllText((Join-Path $PhoneRoot 'START-HERE.txt'), $PhoneReadme, [System.Text.UTF8Encoding]::new($false))

Compress-Archive -LiteralPath $PhoneRoot -DestinationPath $PhoneZip -CompressionLevel Optimal -Force

$MasterItems = @(
  (Join-Path $CampaignRoot 'art'),
  (Join-Path $CampaignRoot 'contact-sheets'),
  (Join-Path $CampaignRoot 'docs'),
  (Join-Path $CampaignRoot 'png'),
  (Join-Path $CampaignRoot 'source-art'),
  (Join-Path $CampaignRoot 'svg'),
  (Join-Path $CampaignRoot 'README.md'),
  (Join-Path $CampaignRoot 'build.mjs'),
  (Join-Path $CampaignRoot 'campaign-data.mjs'),
  (Join-Path $CampaignRoot 'gallery.html'),
  (Join-Path $CampaignRoot 'gallery-phone.html'),
  (Join-Path $CampaignRoot 'manifest.json'),
  (Join-Path $CampaignRoot 'pack.ps1')
)
Compress-Archive -LiteralPath $MasterItems -DestinationPath $MasterZip -CompressionLevel Optimal -Force

Add-Type -AssemblyName System.IO.Compression.FileSystem
$Verification = foreach ($Archive in @($PhoneZip, $MasterZip)) {
  $Zip = [System.IO.Compression.ZipFile]::OpenRead($Archive)
  try {
    [pscustomobject]@{
      File = $Archive
      Entries = $Zip.Entries.Count
      MB = [Math]::Round((Get-Item -LiteralPath $Archive).Length / 1MB, 1)
      SHA256 = (Get-FileHash -LiteralPath $Archive -Algorithm SHA256).Hash.ToLowerInvariant()
    }
  }
  finally {
    $Zip.Dispose()
  }
}

$ChecksumLines = $Verification | ForEach-Object { "$($_.SHA256)  $([System.IO.Path]::GetFileName($_.File))" }
[System.IO.File]::WriteAllLines($Checksums, $ChecksumLines, [System.Text.UTF8Encoding]::new($false))

$PhoneCards = Get-ChildItem -LiteralPath (Join-Path $PhoneRoot 'cards') -Recurse -Filter '*.jpg' -File
$Result = [pscustomobject]@{
  PhoneFolder = $PhoneRoot
  PhoneCards = $PhoneCards.Count
  PhoneFolderMB = [Math]::Round(((Get-ChildItem -LiteralPath $PhoneRoot -Recurse -File | Measure-Object Length -Sum).Sum / 1MB), 1)
  Archives = $Verification
  Checksums = $Checksums
}

$Result | ConvertTo-Json -Depth 5
