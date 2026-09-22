param([Parameter(Mandatory)][string]$Candidate,[Parameter(Mandatory)][string]$ExpectedHash,[Parameter(Mandatory)][string]$Evidence)
. "$PSScriptRoot/Video-Common.ps1"
$environment=Get-VideoEnvironment
& $environment.Node "$PSScriptRoot/preference-contract.mjs" update (Join-Path $environment.DataRoot 'preferences.md') $Candidate (Split-Path $PSScriptRoot -Parent) $ExpectedHash $Evidence
if($LASTEXITCODE -ne 0){throw 'Preference update stopped; inspect the error before retrying.'}
