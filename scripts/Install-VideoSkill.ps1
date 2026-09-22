param([string]$Workspace,[string]$DataRoot,[string]$AliasRoot,[switch]$Verify)
. "$PSScriptRoot/Video-Common.ps1"
if($PSVersionTable.PSVersion.Major -lt 7 -or -not $IsWindows -or -not [Environment]::Is64BitProcess){throw 'Use PowerShell 7 on Windows x64.'}
$skillRoot=Split-Path $PSScriptRoot -Parent
$lock=Get-Content -LiteralPath "$skillRoot/assets/dependency-lock.json" -Raw | ConvertFrom-Json
$pointer=Join-Path $PSScriptRoot 'local-settings.json'
if(Test-Path -LiteralPath $pointer){
 $prior=Get-Content -LiteralPath $pointer -Raw | ConvertFrom-Json
 if(-not $DataRoot){$DataRoot=$prior.DataRoot}
 if(Test-Path -LiteralPath "$DataRoot/environment.json"){
  $previous=Get-Content -LiteralPath "$DataRoot/environment.json" -Raw | ConvertFrom-Json
  if(-not $Workspace){$Workspace=$previous.Workspace}
  if(-not $AliasRoot){$AliasRoot=$previous.AliasRoot}
 }
}
if(-not $Workspace){$Workspace=Join-Path $env:LOCALAPPDATA 'codex-video-workspace'}
if(-not $DataRoot){$DataRoot=Join-Path $env:LOCALAPPDATA 'codex-video-data'}
if(-not $AliasRoot){$AliasRoot=if($Workspace -match '[^\x00-\x7F]'){Join-Path $env:LOCALAPPDATA 'codex-video-workspace'}else{$Workspace}}
$Workspace=[IO.Path]::GetFullPath($Workspace); $DataRoot=[IO.Path]::GetFullPath($DataRoot); $AliasRoot=[IO.Path]::GetFullPath($AliasRoot)
if($AliasRoot -match '[^\x00-\x7F]'){throw 'AliasRoot must contain only ASCII characters.'}
New-Item -ItemType Directory -Force -Path $Workspace,$DataRoot | Out-Null
if($Workspace -ne $AliasRoot){
 if(Test-Path -LiteralPath $AliasRoot){
  $link=Get-Item -LiteralPath $AliasRoot
  if($link.LinkType -ne 'Junction' -or [IO.Path]::GetFullPath($link.Target) -ne $Workspace){throw "AliasRoot points elsewhere: $AliasRoot"}
 }else{New-Item -ItemType Junction -Path $AliasRoot -Target $Workspace | Out-Null}
}
$installRoot=Join-Path $AliasRoot '.tools/skill-setup'
New-Item -ItemType Directory -Force -Path $installRoot,"$DataRoot/logs" | Out-Null
function Get-Package([string]$Url,[string]$Name,[string]$Sha=''){
 $path=Join-Path $installRoot $Name
 if(-not(Test-Path -LiteralPath $path)){
  Invoke-WebRequest -Uri $Url -OutFile "$path.partial"
  Move-Item -LiteralPath "$path.partial" -Destination $path
 }
 if($Sha -and (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash -ne $Sha){throw "Checksum mismatch: $path; existing file preserved."}
 return $path
}
function First-Existing([string[]]$Candidates){
 foreach($candidate in $Candidates){if($candidate -and (Test-Path -LiteralPath $candidate)){return [IO.Path]::GetFullPath($candidate)}}
 return $null
}
$nodePath=First-Existing @($previous.Node,(Get-Command node -ErrorAction SilentlyContinue).Source,"$installRoot/node-v$($lock.nodeVersion)-win-x64/node.exe")
if($nodePath -and [int]((& $nodePath --version).TrimStart('v').Split('.')[0]) -lt 24){$nodePath=$null}
if(-not $nodePath){
 $zip=Get-Package "https://nodejs.org/dist/v$($lock.nodeVersion)/node-v$($lock.nodeVersion)-win-x64.zip" 'node.zip'
 Expand-Archive -LiteralPath $zip -DestinationPath $installRoot -Force
 $nodePath="$installRoot/node-v$($lock.nodeVersion)-win-x64/node.exe"
}
$env:PATH="$(Split-Path $nodePath);$env:PATH"
$runtime=Join-Path $AliasRoot '.open-edit/runtime'
if(-not(Test-Path -LiteralPath "$runtime/refs/tags.json")){
 if(Test-Path -LiteralPath $runtime){throw "Incomplete runtime preserved at $runtime; choose a fresh workspace or inspect and repair it."}
 $archive=Get-Package "https://codeload.github.com/veedstudio/open-edit/tar.gz/$($lock.openeditCommit)" 'open-edit.tar.gz'
 New-Item -ItemType Directory -Force -Path "$installRoot/source" | Out-Null
 Invoke-VideoLogged 'tar.exe' @('-xzf',$archive,'-C',"$installRoot/source") "$DataRoot/logs/extract-source.log"
 New-Item -ItemType Directory -Force -Path (Split-Path $runtime) | Out-Null
 # Move one known extracted snapshot, entirely within this workspace.
 $extracted=[IO.Path]::GetFullPath("$installRoot/source/open-edit-$($lock.openeditCommit)")
 if(-not $extracted.StartsWith($AliasRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Unexpected source extraction path.'}
 Move-Item -LiteralPath $extracted -Destination $runtime
}
$cli="$runtime/cli/dist/cli.js"
if(-not(Test-Path -LiteralPath $cli) -or -not(Test-Path -LiteralPath "$runtime/node_modules/tsx")){
 $pnpm=First-Existing @("$AliasRoot/.tools/node/node_modules/pnpm/bin/pnpm.cjs","$installRoot/npm/node_modules/pnpm/bin/pnpm.cjs")
 if(-not $pnpm){
  $npm=Join-Path (Split-Path $nodePath) 'node_modules/npm/bin/npm-cli.js'
  Invoke-VideoLogged $nodePath @($npm,'install','--prefix',"$installRoot/npm","pnpm@$($lock.pnpmVersion)") "$DataRoot/logs/pnpm.log"
  $pnpm="$installRoot/npm/node_modules/pnpm/bin/pnpm.cjs"
 }
 Push-Location $runtime
 try{
  Invoke-VideoLogged $nodePath @($pnpm,'install','--frozen-lockfile') "$DataRoot/logs/dependencies.log"
  Invoke-VideoLogged $nodePath @('cli/scripts/build.mjs') "$DataRoot/logs/build.log"
 }finally{Pop-Location}
}
$ffmpeg=First-Existing @($previous.FFmpeg,"$env:APPDATA/veed-openedit/ffmpeg/bin/ffmpeg.exe","$installRoot/ffmpeg-9.0.1-essentials_build/bin/ffmpeg.exe")
if(-not $ffmpeg){
 $zip=Get-Package $lock.ffmpegUrl 'ffmpeg.zip' $lock.ffmpegSha256
 Expand-Archive -LiteralPath $zip -DestinationPath $installRoot -Force
 $ffmpeg="$installRoot/ffmpeg-9.0.1-essentials_build/bin/ffmpeg.exe"
}
$engine=First-Existing @($previous.Engine,"$env:APPDATA/veed-openedit/engine/veed-engine-cli.exe","$installRoot/engine/veed-engine-cli.exe")
if(-not $engine){
 $zip=Get-Package "https://github.com/veedstudio/weave-renderer-public-releases/releases/download/$($lock.engineTag)/weave-viewer-cli-windows-x64.zip" 'engine.zip' $lock.engineSha256
 Expand-Archive -LiteralPath $zip -DestinationPath "$installRoot/engine" -Force
 $downloaded=Get-ChildItem -LiteralPath "$installRoot/engine" -Recurse -File -Filter 'weave-viewer-cli.exe' | Select-Object -First 1
 if(-not $downloaded){throw 'Engine archive has no expected executable.'}
 $engine=Join-Path $downloaded.DirectoryName 'veed-engine-cli.exe'
 Copy-Item -LiteralPath $downloaded.FullName -Destination $engine
}
$whisper=First-Existing @($previous.WhisperX,"$AliasRoot/.tools/bin/whisperx.exe","$installRoot/whisperx/Scripts/whisperx.exe")
$python=First-Existing @($previous.Python,"$AliasRoot/.tools/python-tools/whisperx/Scripts/python.exe","$installRoot/whisperx/Scripts/python.exe")
if(-not $whisper -or -not $python){
 $uv=First-Existing @("$AliasRoot/.tools/uv-python/bin/uv.exe","$installRoot/uv/uv.exe")
 if(-not $uv){
  $zip=Get-Package "https://github.com/astral-sh/uv/releases/download/$($lock.uvVersion)/uv-x86_64-pc-windows-msvc.zip" 'uv.zip'
  Expand-Archive -LiteralPath $zip -DestinationPath "$installRoot/uv" -Force
  $uv=(Get-ChildItem -LiteralPath "$installRoot/uv" -Recurse -File -Filter uv.exe | Select-Object -First 1).FullName
 }
 $env:UV_PYTHON_INSTALL_DIR="$installRoot/python"
 if(-not(Test-Path -LiteralPath "$installRoot/whisperx/Scripts/python.exe")){
  Invoke-VideoLogged $uv @('venv','--python','3.12',"$installRoot/whisperx") "$DataRoot/logs/python.log"
 }
 $python="$installRoot/whisperx/Scripts/python.exe"
 Invoke-VideoLogged $uv @('pip','install','--python',$python,'-r',"$skillRoot/assets/whisperx-constraints.txt") "$DataRoot/logs/whisperx.log"
 $whisper="$installRoot/whisperx/Scripts/whisperx.exe"
}
$environment=[ordered]@{SchemaVersion=1;Workspace=$Workspace;AliasRoot=$AliasRoot;DataRoot=$DataRoot;Runtime=$runtime;Cli=$cli;Node=$nodePath;Engine=$engine;FFmpeg=$ffmpeg;FFprobe=(Join-Path (Split-Path $ffmpeg) 'ffprobe.exe');WhisperX=$whisper;Python=$python;PinnedOpenEdit=$lock.openeditCommit;Validation=$null}
Write-VideoJson $environment "$DataRoot/environment.json"
Write-VideoJson @{DataRoot=$DataRoot} $pointer
Use-VideoEnvironment ([pscustomobject]$environment)
$env:HF_HUB_OFFLINE='0';$env:TRANSFORMERS_OFFLINE='0'
Invoke-VideoLogged $python @("$PSScriptRoot/ensure-models.py","$skillRoot/assets/dependency-lock.json") "$DataRoot/logs/models.log"
$env:HF_HUB_OFFLINE='1';$env:TRANSFORMERS_OFFLINE='1'
if(-not(Test-Path -LiteralPath "$DataRoot/preferences.md")){Copy-Item -LiteralPath "$skillRoot/assets/preference-template.md" -Destination "$DataRoot/preferences.md"}
# Environment smoke is independent of personal taste, but a confirmed contract must
# still be structurally valid before installation can report success.
$storedPreferences=Read-VideoPreferences (Join-Path $DataRoot 'preferences.md')
if($storedPreferences.confirmed -eq $true){
 Invoke-VideoLogged $nodePath @($PSScriptRoot+'/preference-contract.mjs','validate',(Join-Path $DataRoot 'preferences.md'),$skillRoot) "$DataRoot/logs/preferences-contract.log"
}
Invoke-VideoLogged $nodePath @($cli,'transcribe','--record','whisperx','--model','medium') "$DataRoot/logs/provider.log"
$fingerprints=[ordered]@{}
foreach($path in @($nodePath,$cli,$engine,$ffmpeg,$python,"$runtime/pnpm-lock.yaml","$skillRoot/assets/dependency-lock.json","$skillRoot/assets/whisperx-constraints.txt","$skillRoot/assets/captions-clean.ts","$skillRoot/assets/captions-semantic-cards.ts","$skillRoot/assets/captions-semantic-cards.adapter.json","$PSScriptRoot/Invoke-VideoStage.ps1","$PSScriptRoot/Validate-VideoPreferences.ps1","$PSScriptRoot/Assert-VideoStyle.ps1","$PSScriptRoot/Update-VideoPreferences.ps1","$PSScriptRoot/Prepare-VideoTask.ps1","$PSScriptRoot/Run-VideoTask.ps1","$PSScriptRoot/preference-contract.mjs","$PSScriptRoot/editorial-plan.mjs","$PSScriptRoot/Apply-EditorialPlan.mjs","$PSScriptRoot/segment-transcript.mjs","$PSScriptRoot/Initialize-VideoAnnotations.mjs","$PSScriptRoot/ensure-models.py")){
 $fingerprints[$path]=(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash
}
$fingerprint=$fingerprints | ConvertTo-Json -Compress
if(-not $Verify -and $previous.Validation.Passed -and $previous.Validation.Fingerprint -eq $fingerprint){
 $environment.Validation=$previous.Validation
 Write-VideoJson $environment "$DataRoot/environment.json"
 Write-Output "Environment unchanged; previous smoke validation reused. Preferences preserved: $DataRoot/preferences.md"
 return
}
$smokeKey='skill-smoke-'+(Get-Date -Format 'yyyyMMdd-HHmmss')
$smokeDir=Join-Path $AliasRoot "diagnostics/$smokeKey"
$run=Join-Path $runtime "runs/$smokeKey"
New-Item -ItemType Directory -Force -Path $smokeDir,$run | Out-Null
$media="$smokeDir/$smokeKey.mp4"
$smokeDuration=(& $environment.FFprobe -v error -show_entries format=duration -of 'default=nw=1:nk=1' "$skillRoot/assets/smoke.wav").Trim()
Invoke-VideoLogged $ffmpeg @('-v','error','-f','lavfi','-i','color=c=0x283b42:s=720x1280:r=30','-i',"$skillRoot/assets/smoke.wav",'-t',$smokeDuration,'-c:v','libx264','-preset','fast','-pix_fmt','yuv420p','-c:a','aac','-y',$media) "$DataRoot/logs/smoke-source.log"
Copy-Item -LiteralPath "$skillRoot/assets/captions-clean.ts" -Destination "$smokeDir/captions.ts"
& "$PSScriptRoot/Invoke-VideoStage.ps1" -Stage Transcribe -RunDir $run -Media $media
& "$PSScriptRoot/Invoke-VideoStage.ps1" -Stage Prep -RunDir $run -Media $media
# Environment-only smoke: does not depend on unconfirmed user preferences and cannot certify style.
Invoke-VideoLogged $nodePath @($cli,'generate-recipe','--run',$run,'--module',"$smokeDir/captions.ts",'--record') "$DataRoot/logs/smoke-render.log"
Invoke-VideoLogged $nodePath @($cli,'mux-audio',$run) "$DataRoot/logs/smoke-mux.log"
& "$PSScriptRoot/Invoke-VideoStage.ps1" -Stage Check -RunDir $run
$environment.Validation=@{Passed=$true;At=(Get-Date).ToString('o');Fingerprint=$fingerprint;SmokeRun=$run;Scope='Adopted environment; Chinese ASR and 720x1280 caption render/mux/decode. Cold-machine install not validated.'}
$environment.ActualVersions=@{Node=(& $nodePath --version);FFmpeg=((& $ffmpeg -version | Select-Object -First 1));Engine=(& $engine --version)}
Write-VideoJson $environment "$DataRoot/environment.json"
Write-Output "Installed and smoke-tested. Preferences: $DataRoot/preferences.md; reference archive: $DataRoot/references"
