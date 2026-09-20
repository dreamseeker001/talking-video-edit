param([Parameter(Mandatory)][string]$Source,[Parameter(Mandatory)][ValidatePattern('^[a-z0-9][a-z0-9_-]+$')][string]$ReferenceId,[double[]]$Times=@(0))
. "$PSScriptRoot/Video-Common.ps1"
$environment=Get-VideoEnvironment
$original=Get-Item -LiteralPath $Source
$root=Join-Path $environment.DataRoot "references/$ReferenceId"
New-Item -ItemType Directory -Force -Path $root | Out-Null
$sha=(Get-FileHash -LiteralPath $Source -Algorithm SHA256).Hash
$archive='original'+$original.Extension.ToLowerInvariant()
$target=Join-Path $root $archive
if(Test-Path -LiteralPath $target){
 if((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash -ne $sha){throw 'Reference id already contains different media. Use a new id.'}
 if(Test-Path -LiteralPath "$root/reference.json"){Write-Output "Existing archive verified: $root"; return}
}else{Copy-Item -LiteralPath $Source -Destination $target}
if((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash -ne $sha){throw 'Reference copy checksum mismatch.'}
Invoke-VideoLogged $environment.FFprobe @('-v','error','-show_streams','-show_format','-of','json',$target) "$root/probe.json"
$frames=@()
foreach($second in $Times){
 $name='frame-'+$second.ToString('0.###',[Globalization.CultureInfo]::InvariantCulture)+'.jpg'
 Invoke-VideoLogged $environment.FFmpeg @('-v','error','-ss',$second.ToString([Globalization.CultureInfo]::InvariantCulture),'-i',$target,'-frames:v','1','-q:v','2','-y',"$root/$name") "$root/extract.log"
 if(-not(Test-Path -LiteralPath "$root/$name")){throw "Cannot extract frame at $second seconds."}
 $frames+=$name
}
Write-VideoJson ([ordered]@{Id=$ReferenceId;Source=$original.FullName;Archive=$archive;Sha256=$sha;Bytes=$original.Length;ArchivedAt=(Get-Date).ToString('o');Keyframes=$frames;Analysis='analysis.md'}) "$root/reference.json"
Write-Output "Archived independently and SHA256 verified: $root"
