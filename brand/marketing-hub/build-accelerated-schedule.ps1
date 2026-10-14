$ErrorActionPreference = 'Stop'

$queuePath = Join-Path $PSScriptRoot 'PUBLISHING-QUEUE.csv'
$planPath = Join-Path $PSScriptRoot 'ACCELERATED-SCHEDULE.csv'
$rows = @(Import-Csv $queuePath | Sort-Object { [int]$_.publish_order })
if ($rows.Count -ne 114) { throw "Expected 114 queue rows; found $($rows.Count)." }

$baseSlots = @('10:15 ET', '11:15 ET', '12:15 ET', '13:15 ET', '14:15 ET', '15:15 ET', '16:15 ET', '17:15 ET', '18:15 ET', '19:45 ET')
$halfHourSlots = @(0..47 | ForEach-Object { ([datetime]'2026-09-29T00:15:00').AddMinutes(30 * $_).ToString('HH:mm') + ' ET' })
$extraTuesday = @($halfHourSlots | Where-Object { $_ -notin $baseSlots })
$extraWednesday = @($halfHourSlots | Where-Object { $_ -notin $baseSlots })
if ($extraTuesday.Count -ne 38 -or $extraWednesday.Count -ne 38) { throw 'Unexpected slot count.' }

$plan = for ($i = 0; $i -lt $rows.Count; $i++) {
    $row = $rows[$i]
    if ($i -lt 30) {
        $date = ([datetime]'2026-09-28').AddDays([math]::Floor($i / 10)).ToString('yyyy-MM-dd')
        $time = $baseSlots[$i % 10]
    } elseif ($i -lt 38) {
        $date = '2026-09-28'
        $time = ([datetime]'2026-09-28T20:15:00').AddMinutes(30 * ($i - 30)).ToString('HH:mm') + ' ET'
    } elseif ($i -lt 76) {
        $date = '2026-09-29'
        $time = $extraTuesday[$i - 38]
    } else {
        $date = '2026-09-30'
        $time = $extraWednesday[$i - 76]
    }
    [pscustomobject]@{
        publish_order = $row.publish_order
        id = $row.id
        desired_date = $date
        desired_time = $time
    }
}
$plan | Export-Csv -LiteralPath $planPath -NoTypeInformation -Encoding utf8
Write-Output "Planned $($plan.Count) posts: Monday 18, Tuesday 48, Wednesday 48."
