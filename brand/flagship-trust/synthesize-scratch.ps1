param(
  [Parameter(Mandatory=$true)][string]$Plan,
  [string]$Chapter = ''
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$scratchPlan = Get-Content -LiteralPath $Plan -Raw -Encoding UTF8 | ConvertFrom-Json
$scratchSynth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$scratchSynth.SelectVoice('Microsoft David Desktop')
$scratchFormat = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(48000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
try {
  foreach ($utterance in $scratchPlan.utterances) {
    if ($Chapter -and $utterance.chapter -ne $Chapter) { continue }
    $scratchSynth.Rate = [int]$utterance.rate
    $scratchSynth.Volume = 100
    $scratchSynth.SetOutputToWaveFile([string]$utterance.file, $scratchFormat)
    $scratchSynth.Speak([string]$utterance.spokenText)
    $scratchSynth.SetOutputToNull()
  }
} finally {
  $scratchSynth.Dispose()
}
