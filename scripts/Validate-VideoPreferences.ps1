param([Parameter(Mandatory)][string]$PreferencesPath,[Parameter(Mandatory)][string]$SkillRoot)
. "$PSScriptRoot/Video-Common.ps1"
$environment=Get-VideoEnvironment
& $environment.Node "$PSScriptRoot/preference-contract.mjs" validate $PreferencesPath $SkillRoot
if($LASTEXITCODE -ne 0){throw 'Preference contract validation failed.'}
