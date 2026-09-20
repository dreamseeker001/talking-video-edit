$ErrorActionPreference = 'Stop'
function Write-VideoJson($Value, [string]$Path) {
    $Value | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $Path -Encoding utf8
}
function Read-VideoPreferences([string]$Path) {
    $content=Get-Content -LiteralPath $Path -Raw
    $match=[regex]::Match($content,'(?s)```json\s*(.*?)\s*```')
    if(-not $match.Success){throw "Missing JSON settings in $Path"}
    return $match.Groups[1].Value | ConvertFrom-Json
}
function Get-VideoEnvironment {
    $pointer=Join-Path $PSScriptRoot 'local-settings.json'
    if(-not (Test-Path -LiteralPath $pointer)){throw 'Not initialized: run Install-VideoSkill.ps1 first.'}
    $settings=Get-Content -LiteralPath $pointer -Raw | ConvertFrom-Json
    $environment=Get-Content -LiteralPath (Join-Path $settings.DataRoot 'environment.json') -Raw | ConvertFrom-Json
    foreach($key in @('Node','Cli','Engine','FFmpeg','FFprobe','WhisperX','Python')){
        if(-not (Test-Path -LiteralPath $environment.$key)){throw "Missing $key at $($environment.$key). Run installer to repair."}
    }
    return $environment
}
function Use-VideoEnvironment($Environment) {
    $env:OPEN_EDIT_ROOT=$Environment.Runtime
    $env:VEED_ENGINE_BIN=$Environment.Engine
    $env:VEED_ENGINE_FFMPEG=$Environment.FFmpeg
    $env:VEED_ENGINE_FFPROBE=$Environment.FFprobe
    $env:WHISPERX_BIN=$Environment.WhisperX
    $env:WHISPERX_MODEL='medium'
    $env:OPEN_EDIT_WHISPERX_DEVICE='cpu'
    $env:OPEN_EDIT_WHISPERX_COMPUTE='int8'
    $env:PYTHONUTF8='1'; $env:PYTHONUNBUFFERED='1'
    $env:HF_HUB_OFFLINE='1'; $env:TRANSFORMERS_OFFLINE='1'
    $env:HF_HUB_DISABLE_SYMLINKS_WARNING='1'
    if(($env:NODE_OPTIONS -split '\s+') -notcontains '--preserve-symlinks-main'){
        $env:NODE_OPTIONS=($env:NODE_OPTIONS+' --preserve-symlinks-main').Trim()
    }
    foreach($dir in @((Split-Path $Environment.FFmpeg),(Split-Path $Environment.Node),(Split-Path $Environment.WhisperX))){
        if(($env:PATH -split ';') -notcontains $dir){$env:PATH="$dir;$env:PATH"}
    }
}
function Invoke-VideoLogged([string]$Exe,[string[]]$Arguments,[string]$Log) {
    & $Exe @Arguments *> $Log
    if($LASTEXITCODE -ne 0){
        Get-Content -LiteralPath $Log -Tail 25 | Write-Host
        throw "Command failed ($LASTEXITCODE); log: $Log"
    }
}
