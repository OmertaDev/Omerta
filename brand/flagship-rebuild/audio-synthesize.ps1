param(
  [Parameter(Mandatory=$true)][string]$Plan,
  [string]$Chapter = ''
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
Add-Type -ReferencedAssemblies System.Speech -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Speech.Synthesis;
public class AudioTimingStamp {
  public string kind;
  public string text;
  public double ms;
  public int character;
  public int length;
}
public class AudioTimingRecorder {
  public readonly List<AudioTimingStamp> stamps = new List<AudioTimingStamp>();
  public void Attach(SpeechSynthesizer synth) {
    synth.BookmarkReached += (sender, e) => stamps.Add(new AudioTimingStamp { kind = "bookmark", text = e.Bookmark, ms = e.AudioPosition.TotalMilliseconds });
    synth.SpeakProgress += (sender, e) => stamps.Add(new AudioTimingStamp { kind = "word", text = e.Text, ms = e.AudioPosition.TotalMilliseconds, character = e.CharacterPosition, length = e.CharacterCount });
  }
}
'@
$audioPlan = Get-Content -LiteralPath $Plan -Raw -Encoding UTF8 | ConvertFrom-Json
$audioSynth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$audioSynth.SelectVoice([string]$audioPlan.voice)
$audioFormat = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
$audioRecorder = New-Object AudioTimingRecorder
$audioRecorder.Attach($audioSynth)
try {
  foreach ($chapterRead in $audioPlan.chapters) {
    if ($Chapter -and $chapterRead.id -ne $Chapter) { continue }
    $audioRecorder.stamps.Clear()
    $audioSynth.Rate = 0
    $audioSynth.Volume = 100
    # SAPI timing events use a 16 kHz clock here; match it before the final 48 kHz mix.
    $audioSynth.SetOutputToWaveFile([string]$chapterRead.file, $audioFormat)
    $audioSynth.SpeakSsml([string]$chapterRead.ssml)
    $audioSynth.SetOutputToNull()
    @($audioRecorder.stamps) | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath ([string]$chapterRead.timingFile) -Encoding UTF8
  }
} finally {
  $audioSynth.Dispose()
}
