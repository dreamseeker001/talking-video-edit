param(
 [Parameter(Mandatory)][ValidateSet('Transcribe','Prep','Cut','Render','Check')][string]$Stage,
 [Parameter(Mandatory)][string]$RunDir,
 [string]$Media,[string]$Edl,[string]$Output,[string]$Module,[int]$Crossfade=40
)
. "$PSScriptRoot/Video-Common.ps1"
$environment=Get-VideoEnvironment
Use-VideoEnvironment $environment
$RunDir=[IO.Path]::GetFullPath($RunDir)
if($RunDir -match '[^\x00-\x7F]'){throw 'Use the ASCII workspace alias for RunDir.'}
New-Item -ItemType Directory -Force -Path "$RunDir/logs" | Out-Null
$stamp=Get-Date -Format 'yyyyMMdd-HHmmss-fff'
$started=Get-Date
function Invoke-Native([string[]]$Arguments,[string]$Label){
 Invoke-VideoLogged $environment.Node (@($environment.Cli)+$Arguments) "$RunDir/logs/$stamp-$Label.log"
}
if($Stage -in @('Transcribe','Prep')){
 if(-not (Test-Path -LiteralPath $Media)){throw 'Media is required.'}
 $native=Join-Path $environment.Runtime ('runs/'+[IO.Path]::GetFileNameWithoutExtension($Media))
 if([IO.Path]::GetFullPath($native) -ne $RunDir){throw "Native run is $native; media basename must equal RunDir leaf."}
}
switch($Stage){
 'Transcribe' {Invoke-Native @('transcribe',$Media,'--language','zh','--model','medium') 'transcribe'}
 'Prep' {Invoke-Native @('prep',$Media) 'prep'}
 'Cut' {
  if(-not $Edl -or -not $Output){throw 'Cut requires Edl and Output.'}
  if([IO.Path]::GetFileNameWithoutExtension($Output) -ne (Split-Path $RunDir -Leaf)){throw 'Output basename must equal native RunDir leaf.'}
  if(Test-Path -LiteralPath $Output){throw 'Choose a new cut output; existing video is preserved.'}
  $edlDoc=Get-Content -LiteralPath $Edl -Raw | ConvertFrom-Json
  foreach($inputTranscript in $edlDoc.transcripts.PSObject.Properties.Value){
   if([IO.Path]::GetFullPath($inputTranscript) -eq [IO.Path]::GetFullPath("$RunDir/transcript.json")){throw 'Retime output would overwrite its input transcript. Use a separate native cut run.'}
  }
  Invoke-Native @('apply-edl','--edl',$Edl,'--out',$Output,'--crossfade',"$Crossfade") 'cut'
  Invoke-Native @('retime-transcript','--edl',$Edl,'--out',"$RunDir/transcript.json") 'retime'
  Invoke-Native @('prep',$Output) 'prep'
 }
 'Render' {
  if(-not (Test-Path -LiteralPath $Module)){throw 'Render requires a project recipe module.'}
  & "$PSScriptRoot/Assert-VideoStyle.ps1" -RunDir $RunDir -Module $Module
  $oldContext=$env:VIDEO_STYLE_CONTEXT
  try{
   $env:VIDEO_STYLE_CONTEXT=Join-Path $RunDir 'style.resolved.json'
   Invoke-Native @('generate-recipe','--run',$RunDir,'--module',$Module,'--record') 'render'
  } finally {$env:VIDEO_STYLE_CONTEXT=$oldContext}
  Invoke-Native @('mux-audio',$RunDir) 'mux'
  $Output="$RunDir/final/out.mp4"
 }
 'Check' {
  if(-not $Output){$Output="$RunDir/final/out.mp4"}
  if(-not (Test-Path -LiteralPath $Output)){throw 'Output video does not exist.'}
  Invoke-VideoLogged $environment.FFprobe @('-v','error','-show_streams','-show_format','-of','json',$Output) "$RunDir/logs/$stamp-probe.json"
  Invoke-VideoLogged $environment.FFmpeg @('-v','error','-i',$Output,'-f','null','-') "$RunDir/logs/$stamp-decode.log"
  $probe=Get-Content -LiteralPath "$RunDir/logs/$stamp-probe.json" -Raw | ConvertFrom-Json
  $video=@($probe.streams | Where-Object codec_type -eq video)[0]
  $audio=@($probe.streams | Where-Object codec_type -eq audio)
  if(-not $video -or $audio.Count -eq 0){throw 'Missing video or narration audio stream.'}
  if(Test-Path -LiteralPath "$RunDir/meta.json"){
   $meta=Get-Content -LiteralPath "$RunDir/meta.json" -Raw | ConvertFrom-Json
   if($video.width -ne $meta.width -or $video.height -ne $meta.height){throw 'Output dimensions differ from prepared canvas.'}
   if([math]::Abs([double]$probe.format.duration-[double]$meta.durationSec) -gt 0.12){throw 'Output duration differs from prepared source by more than 120 ms.'}
   $ratio=$video.avg_frame_rate -split '/';$fps=[double]$ratio[0]/[double]$ratio[1]
   if([math]::Abs($fps-[double]$meta.fps) -gt 0.05){throw 'Output frame rate changed; explicitly normalize the source and rebuild.'}
  }
  if($audio[0].duration -and $video.duration -and [math]::Abs([double]$audio[0].duration-[double]$video.duration) -gt 0.12){throw 'Audio/video duration mismatch exceeds 120 ms.'}
  [pscustomobject]@{Width=$video.width;Height=$video.height;Fps=$video.avg_frame_rate;Duration=$probe.format.duration;AudioStreams=$audio.Count} | ConvertTo-Json -Compress | Write-Output
 }
}
$record=[ordered]@{Stage=$Stage;Finished=(Get-Date).ToString('o');Seconds=[math]::Round(((Get-Date)-$started).TotalSeconds,2);Output=$Output;LogPrefix="$RunDir/logs/$stamp"}
($record | ConvertTo-Json -Compress) | Add-Content -LiteralPath "$RunDir/stages.jsonl" -Encoding utf8
$record | ConvertTo-Json -Compress
