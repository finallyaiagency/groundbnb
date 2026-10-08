[CmdletBinding()]
param([switch]$Prepare,[ValidateSet('local','preview')][string]$Kind)
$ErrorActionPreference='Stop'
$importRoot=Split-Path -Parent $PSScriptRoot
$importNode=(Get-Command node -ErrorAction Stop).Source
$importPrivatePath=Join-Path $importRoot '.env.m1-profile-transport.dpapi'
$importDir=Join-Path $importRoot '.tmp/evidence'
$importBytes=$null
$importChild=$null
$importPayload=$null
Add-Type -AssemblyName System.Security
try {
  [IO.Directory]::CreateDirectory($importDir) | Out-Null
  if ($Prepare) {
    if (Test-Path -LiteralPath $importPrivatePath) { Write-Host 'Existing encrypted transport retained.'; exit 0 }
    $importKeyJson=& $importNode --input-type=module -e "import {generateKeyPairSync} from 'node:crypto'; const k=generateKeyPairSync('rsa',{modulusLength:4096,publicKeyEncoding:{type:'spki',format:'pem'},privateKeyEncoding:{type:'pkcs8',format:'pem'}});process.stdout.write(JSON.stringify(k));"
    if ($LASTEXITCODE -ne 0) { throw 'Transport setup failed' }
    $importKeys=$importKeyJson | ConvertFrom-Json
    $importBytes=[Text.Encoding]::UTF8.GetBytes($importKeys.privateKey)
    [IO.File]::WriteAllBytes($importPrivatePath,[Security.Cryptography.ProtectedData]::Protect($importBytes,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser))
    [IO.File]::WriteAllText((Join-Path $importDir 'm1-profile-transport.pem'),$importKeys.publicKey)
    Write-Host 'Public transport prepared; private key saved only as CurrentUser DPAPI ciphertext.'
  } else {
    if (-not $Kind) { throw 'Kind required' }
    $importBytes=[Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($importPrivatePath),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
    $importPayload=@{ kind=$Kind; privateKey=[Text.Encoding]::UTF8.GetString($importBytes) } | ConvertTo-Json -Compress
    $importStart=New-Object Diagnostics.ProcessStartInfo
    $importStart.FileName=$importNode
    $importStart.Arguments='"'+(Join-Path $PSScriptRoot 'import-m1-existing-connection.mjs')+'"'
    $importStart.WorkingDirectory=$importRoot
    $importStart.UseShellExecute=$false
    $importStart.CreateNoWindow=$true
    $importStart.RedirectStandardInput=$true
    $importStart.RedirectStandardOutput=$true
    $importStart.RedirectStandardError=$true
    $importChild=[Diagnostics.Process]::Start($importStart)
    $importChild.StandardInput.Write($importPayload)
    $importChild.StandardInput.Close()
    $importPayload=$null
    if (-not $importChild.WaitForExit(35000)) { $importChild.Kill(); throw 'Timeout' }
    $importResult=$importChild.StandardOutput.ReadToEnd() | ConvertFrom-Json
    $importOk=$importChild.ExitCode -eq 0 -and $importResult.ok -eq $true
    if ($importOk) {
      [Array]::Clear($importBytes,0,$importBytes.Length)
      $importBytes=[Text.Encoding]::UTF8.GetBytes($importResult.url)
      [IO.File]::WriteAllBytes((Join-Path $importRoot ".env.m1-profile-$Kind.dpapi"),[Security.Cryptography.ProtectedData]::Protect($importBytes,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser))
    }
    $importRevision=& git -c "safe.directory=$($importRoot.Replace('\','/'))" -C $importRoot rev-parse HEAD
    $importEvidence=[pscustomobject]@{ checkedAt=[DateTime]::UtcNow.ToString('o'); revision=$importRevision; kind=$Kind; ok=[bool]$importOk;
      phase=$(if ($importOk) { 'complete' } elseif ($importResult.phase -in @('input','connection','result','worker')) { $importResult.phase } else { 'unknown' });
      category=$(if ($importOk) { 'passed' } elseif ($importResult.category -in @('auth','permission','timeout','network','catalog','input','unknown')) { $importResult.category } else { 'unknown' }) }
    $importEvidence | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $importDir "m1-profile-$Kind-import.json")
    Write-Host ($Kind+': '+$(if ($importOk) { 'PASS (direct login and catalog; encrypted binding saved)' } else { 'FAIL ('+$importEvidence.phase+'/'+$importEvidence.category+')' }))
    if (-not $importOk) { exit 1 }
  }
} catch { Write-Host 'Private import unavailable; details suppressed.'; exit 1 }
finally {
  if ($importBytes) { [Array]::Clear($importBytes,0,$importBytes.Length) }
  $importPayload=$null; $importKeyJson=$null; $importKeys=$null; $importResult=$null
  if ($importChild) { $importChild.Dispose() }
}
