param(
 [Parameter(Mandatory)][string]$Media,
 [Parameter(Mandatory)][ValidatePattern('^[a-z0-9][a-z0-9_-]+$')][string]$RunKey,
 [ValidateSet('Prepare','Cut','Finish')][string]$Phase='Prepare',
 [string]$PlanFile,
 [switch]$Render=$true,
 [int]$Crossfade=40
)
. "$PSScriptRoot/Video-Common.ps1"
$environment=Get-VideoEnvironment
Use-VideoEnvironment $environment
$run=Join-Path $environment.Runtime "runs/$RunKey"
function Invoke-Helper([string]$Name,[string[]]$Arguments){
 & $environment.Node "$PSScriptRoot/$Name" @Arguments
 if($LASTEXITCODE -ne 0){throw "Helper failed: $Name"}
}
try {
 if($Phase -eq 'Prepare'){
  $prepared=((& "$PSScriptRoot/Prepare-VideoTask.ps1" -Media $Media -RunKey $RunKey) -join "`n") | ConvertFrom-Json
  & "$PSScriptRoot/Invoke-VideoStage.ps1" -Stage Transcribe -Media $prepared.Media -RunDir $run
  & "$PSScriptRoot/Invoke-VideoStage.ps1" -Stage Prep -Media $prepared.Media -RunDir $run
  if(-not(Test-Path "$run/editorial-plan.json")){Invoke-Helper 'editorial-plan.mjs' @('initialize',$run)}
  [ordered]@{Status='agent-action-required';Owner='agent';Action='Review full film and finalize source plan, including meaningful caption boundaries';RunDir=$run} | ConvertTo-Json
  return
 }
 if($PlanFile -and [IO.Path]::GetFullPath($PlanFile) -ne [IO.Path]::GetFullPath("$run/editorial-plan.json")){
  throw 'Use the reviewed plan in this run; explicitly rebind external plans before execution.'
 }
 if($Phase -eq 'Cut'){
  Invoke-Helper 'editorial-plan.mjs' @('validate',$run)
  Invoke-Helper 'Apply-EditorialPlan.mjs' @('apply',$run)
  $cutRun=Join-Path $environment.Runtime "runs/$RunKey-cut"
  $cut=Join-Path $environment.AliasRoot "cuts/$RunKey-cut.mp4"
  if(Test-Path $cut){throw 'Existing cut preserved. Inspect its logs and resume downstream; do not repeat Cut.'}
  New-Item -ItemType Directory -Force -Path $cutRun,(Split-Path $cut) | Out-Null
  Copy-Item "$run/editorial-plan.edl.json" "$cutRun/editorial-plan.edl.json"
  & "$PSScriptRoot/Invoke-VideoStage.ps1" -Stage Cut -Edl "$run/editorial-plan.edl.json" -Output $cut -RunDir $cutRun -Crossfade $Crossfade
  Invoke-Helper 'Apply-EditorialPlan.mjs' @('project-after-cut',$run,$cutRun)
  [ordered]@{Status='agent-action-required';Owner='agent';Action='Grade/compose base, inherit frozen preferences, bind final caption chunks and execution plan, then Finish';RunDir=$cutRun;Media=$cut} | ConvertTo-Json
  return
 }
 # Finish consumes an Agent-prepared native run. It does not overwrite a transcript,
 # reinterpret semantics, refreeze current global preferences or pretend to grade footage.
 if(-not(Test-Path "$run/preferences.snapshot.md")){throw 'Bind the source frozen preference contract before Finish.'}
 if([IO.Path]::GetFileNameWithoutExtension($Media) -ne $RunKey){throw 'Media basename must match the native run key.'}
 Invoke-Helper 'editorial-plan.mjs' @('validate',$run)
 & "$PSScriptRoot/Invoke-VideoStage.ps1" -Stage Prep -Media $Media -RunDir $run
 if(-not(Test-Path "$run/presentation.json") -and -not(Test-Path "$run/policy-review.json")){
  Invoke-Helper 'Initialize-VideoAnnotations.mjs' @($run)
 }
 & "$PSScriptRoot/Assert-VideoStyle.ps1" -RunDir $run -Module "$run/style/module.ts"
 if(-not $Render){[ordered]@{Status='render-ready';RunDir=$run} | ConvertTo-Json;return}
 if(Test-Path "$run/final/out.mp4"){throw 'Existing render preserved. Use Check for validation or create an explicit render revision.'}
 & "$PSScriptRoot/Invoke-VideoStage.ps1" -Stage Render -RunDir $run -Module "$run/style/module.ts"
 & "$PSScriptRoot/Invoke-VideoStage.ps1" -Stage Check -RunDir $run
 [ordered]@{Status='technical-check-passed';Owner='agent';Action='Inspect actual output and report fallback actions before delivery';RunDir=$run;Final="$run/final/out.mp4"} | ConvertTo-Json
} catch {
 [ordered]@{Status='agent-recovery-required';Owner='agent';Phase=$Phase;RunDir=$run;Error=$_.Exception.Message;Action='Inspect stage logs; repair within scope and resume nearest valid stage; record recovery in task.md'} | ConvertTo-Json | Write-Output
 throw
}
