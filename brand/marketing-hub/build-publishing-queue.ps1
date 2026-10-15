$ErrorActionPreference = 'Stop'

$repo = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$queuePath = Join-Path $PSScriptRoot 'PUBLISHING-QUEUE.csv'
$cards = Import-Csv (Join-Path $repo 'brand/master-campaign/docs/PUBLISHING-CALENDAR.csv')
$ready = Get-Content (Join-Path $PSScriptRoot 'READY-TO-POST.md') -Raw -Encoding utf8
$prior = @{}
if (Test-Path $queuePath) {
    foreach ($row in (Import-Csv $queuePath)) { $prior[$row.id] = $row }
}

$videos = @()
$pattern = '(?ms)^### (S(?:3[6-9]|4[01]))[^\r\n]*\r?\n\r?\nAttach: \[[^\]]+\]\(([^)]+)\)\r?\n\r?\n```text\r?\n(.*?)\r?\n```'
foreach ($match in [regex]::Matches($ready, $pattern)) {
    $asset = (Resolve-Path (Join-Path $PSScriptRoot $match.Groups[2].Value)).Path
    $videos += [pscustomobject]@{
        source_sequence = ''
        id = $match.Groups[1].Value
        series = 'CONNECTED CITY VIDEO'
        source_status = 'SHOWCASE — CHECK ON-SCREEN STATUS'
        media_type = 'video'
        asset = [IO.Path]::GetRelativePath($repo, $asset).Replace('\', '/')
        post = $match.Groups[3].Value.Trim()
        source_file = 'brand/marketing-hub/READY-TO-POST.md'
    }
}
if ($videos.Count -ne 6) { throw "Expected six video posts; found $($videos.Count)." }

$items = @()
$videoAfter = @(9, 27, 45, 63, 81, 99)
foreach ($card in ($cards | Where-Object { $_.sequence -ne '1' })) {
    $items += [pscustomobject]@{
        source_sequence = $card.sequence
        id = $card.id
        series = $card.series
        source_status = $card.status
        media_type = 'image'
        asset = ('brand/master-campaign/' + $card.asset)
        post = $card.post
        source_file = 'brand/master-campaign/docs/PUBLISHING-CALENDAR.csv'
    }
    $videoIndex = [array]::IndexOf($videoAfter, [int]$card.sequence)
    if ($videoIndex -ge 0) { $items += $videos[$videoIndex] }
}
$firstCard = $cards | Where-Object sequence -eq '1'
$items += [pscustomobject]@{
    source_sequence = $firstCard.sequence
    id = $firstCard.id
    series = $firstCard.series
    source_status = $firstCard.status
    media_type = 'image'
    asset = ('brand/master-campaign/' + $firstCard.asset)
    post = $firstCard.post
    source_file = 'brand/master-campaign/docs/PUBLISHING-CALENDAR.csv'
}
if ($items.Count -ne 114) { throw "Expected 114 posts; found $($items.Count)." }

$slots = @('10:15 ET', '11:15 ET', '12:15 ET', '13:15 ET', '14:15 ET', '15:15 ET', '16:15 ET', '17:15 ET', '18:15 ET', '19:45 ET')
$day = [datetime]'2026-09-28'
$queue = for ($i = 0; $i -lt $items.Count; $i++) {
    if ($i -gt 0 -and $i % 10 -eq 0) {
        $day = $day.AddDays(1)
        while ($day.DayOfWeek -eq 'Sunday') { $day = $day.AddDays(1) }
    }
    $item = $items[$i]
    $old = $prior[$item.id]
    [pscustomobject]@{
        publish_order = $i + 1
        target_date = if ($old -and $old.target_date) { $old.target_date } else { $day.ToString('yyyy-MM-dd') }
        target_time = if ($old -and $old.target_time) { $old.target_time } else { $slots[$i % 10] }
        id = $item.id
        source_sequence = $item.source_sequence
        series = $item.series
        source_status = $item.source_status
        media_type = $item.media_type
        asset = $item.asset
        post = $item.post
        source_file = $item.source_file
        state = if ($old -and $old.state) { $old.state } else { 'planned' }
        x_url = if ($old) { $old.x_url } else { '' }
    }
}
$queue | Export-Csv -LiteralPath $queuePath -NoTypeInformation -Encoding utf8
Write-Output "Built $($queue.Count) posts: $($queue[0].target_date)–$($queue[-1].target_date)."
