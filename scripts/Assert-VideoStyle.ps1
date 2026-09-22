param([Parameter(Mandatory)][string]$RunDir,[Parameter(Mandatory)][string]$Module)
. "$PSScriptRoot/Video-Common.ps1"
$environment=Get-VideoEnvironment
& $environment.Node "$PSScriptRoot/preference-contract.mjs" preflight $RunDir $Module (Split-Path $PSScriptRoot -Parent)
if($LASTEXITCODE -ne 0){throw 'Style preflight failed; no rendering was started.'}
