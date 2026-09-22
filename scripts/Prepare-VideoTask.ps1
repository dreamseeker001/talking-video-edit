param([Parameter(Mandatory)][string]$Media,[Parameter(Mandatory)][ValidatePattern('^[a-z0-9][a-z0-9_-]+$')][string]$RunKey,[string]$RunDir,[switch]$AdoptExistingTranscript,[string]$Profile,[string]$TaskPreferences)
. "$PSScriptRoot/Video-Common.ps1"
$environment=Get-VideoEnvironment
if(-not $environment.Validation.Passed){throw 'Environment initialization has not passed; run Install-VideoSkill.ps1 to finish setup.'}
Use-VideoEnvironment $environment
$prefsPath=Join-Path $environment.DataRoot 'preferences.md'
$prefs=Read-VideoPreferences $prefsPath
if(-not $prefs.confirmed){throw "Confirm preferences during installation: $prefsPath"}
$source=Get-Item -LiteralPath $Media
if(-not $RunDir){$RunDir=Join-Path $environment.Runtime "runs/$RunKey"}
if([IO.Path]::GetFullPath($RunDir) -ne [IO.Path]::GetFullPath((Join-Path $environment.Runtime "runs/$RunKey"))){throw 'RunDir must be the native runtime/runs/RunKey directory.'}
New-Item -ItemType Directory -Force -Path $RunDir | Out-Null
$identityPath=Join-Path $RunDir 'source-identity.json'
$old=if(Test-Path -LiteralPath $identityPath){Get-Content -LiteralPath $identityPath -Raw | ConvertFrom-Json}else{$null}
if($old -and $old.Original -eq $source.FullName -and $old.Bytes -eq $source.Length -and $old.Modified -eq $source.LastWriteTimeUtc.ToString('o')){$sha=$old.Sha256}
else{$sha=(Get-FileHash -LiteralPath $Media -Algorithm SHA256).Hash}
if($old -and $old.Sha256 -ne $sha){throw 'This RunKey belongs to different source content; choose a new unique key.'}
if(-not $old -and (Test-Path -LiteralPath "$RunDir/transcript.json") -and -not $AdoptExistingTranscript){
 $meta=if(Test-Path -LiteralPath "$RunDir/meta.json"){Get-Content -LiteralPath "$RunDir/meta.json" -Raw | ConvertFrom-Json}else{$null}
 if(-not $meta -or -not(Test-Path -LiteralPath $meta.videoPath) -or (Get-FileHash -LiteralPath $meta.videoPath).Hash -ne $sha){
  throw 'Existing transcript has no matching source evidence. Choose a new key, or explicitly adopt a verified retimed/imported transcript with -AdoptExistingTranscript.'
 }
}
$inputDir=Join-Path $environment.AliasRoot 'inputs'
New-Item -ItemType Directory -Force -Path $inputDir | Out-Null
$prepared=Join-Path $inputDir ($RunKey+$source.Extension.ToLowerInvariant())
if(-not (Test-Path -LiteralPath $prepared)){
 try{New-Item -ItemType HardLink -Path $prepared -Target $source.FullName -ErrorAction Stop | Out-Null}
 catch{Copy-Item -LiteralPath $source.FullName -Destination $prepared}
} elseif((Get-FileHash -LiteralPath $prepared -Algorithm SHA256).Hash -ne $sha){throw 'Prepared source collision; use a new RunKey.'}
Write-VideoJson ([ordered]@{Original=$source.FullName;Prepared=$prepared;Bytes=$source.Length;Modified=$source.LastWriteTimeUtc.ToString('o');Sha256=$sha;Asr='whisperx-3.4.3/medium/cpu/int8'}) $identityPath
$snapshot=Join-Path $RunDir 'preferences.snapshot.md'
$effectiveInput=if($TaskPreferences){$TaskPreferences}else{$prefsPath}
$bindingJson=& $environment.Node "$PSScriptRoot/preference-contract.mjs" prepare $effectiveInput (Split-Path $PSScriptRoot -Parent) $RunDir $Profile
if($LASTEXITCODE -ne 0){throw 'Preference binding failed; no rendering started.'}
$binding=($bindingJson -join "`n") | ConvertFrom-Json
$taskPrefs=Read-VideoPreferences $snapshot
$references=@()
foreach($id in $taskPrefs.references){
 $refRoot=Join-Path $environment.DataRoot "references/$id"
 $ref=Get-Content -LiteralPath "$refRoot/reference.json" -Raw | ConvertFrom-Json
 foreach($frame in $ref.Keyframes){if(-not(Test-Path -LiteralPath "$refRoot/$frame")){throw "Reference frame missing: $refRoot/$frame"}}
 if(-not(Test-Path -LiteralPath "$refRoot/$($ref.Archive)")){throw "Reference source missing: $refRoot"}
 if(-not(Test-Path -LiteralPath "$refRoot/analysis.md")){throw "Reference has no distilled analysis: $refRoot/analysis.md"}
 $references+=@{Id=$id;Analysis="$refRoot/analysis.md";Frames=@($ref.Keyframes | ForEach-Object {"$refRoot/$_"})}
}
Invoke-VideoLogged $environment.FFprobe @('-v','error','-show_streams','-show_format','-of','json',$prepared) "$RunDir/source-probe.json"
if(-not(Test-Path -LiteralPath "$RunDir/task.md")){
 @("# $RunKey","","偏好快照 revision $($taskPrefs.revision)。原片：$($source.FullName)","","阶段：已准备；待读取脚本、查看参考及素材。字幕以口播为准。","","工程：$RunDir。尚未交付成片。") | Set-Content -LiteralPath "$RunDir/task.md" -Encoding utf8
}
[ordered]@{Media=$prepared;RunDir=$RunDir;Preferences=$prefsPath;Snapshot=$snapshot;Task="$RunDir/task.md";SnapshotRevision=$taskPrefs.revision;CurrentRevision=$prefs.revision;Profile=$binding.Profile;StyleId=$binding.StyleId;StyleModule=$binding.StyleModule;ReferenceEvidence=$references;TranscriptExists=(Test-Path -LiteralPath "$RunDir/transcript.json");MediaInfo="$RunDir/source-probe.json"} | ConvertTo-Json -Depth 10
