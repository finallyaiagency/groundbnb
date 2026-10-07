[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$profileRoot = Split-Path -Parent $PSScriptRoot
$profileNode = (Get-Command node -ErrorAction Stop).Source
$profileWorker = Join-Path $PSScriptRoot 'verify-m1-profile-credential.mjs'
$profileResults = @()
Write-Host 'M1 restricted application checks only. Enter each newly activated app role password.'
Write-Host 'Passwords go privately to the pinned synthetic Neon database; no password or URL is displayed/saved.'
foreach ($profileKind in @('local','preview')) {
  $profileSecret = Read-Host "$profileKind application role password" -AsSecureString
  $profilePointer = [IntPtr]::Zero
  $profileChild = $null
  $profilePayload = $null
  try {
    $profilePointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($profileSecret)
    $profilePayload = @{ kind=$profileKind; password=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($profilePointer) } | ConvertTo-Json -Compress
    $profileStart = New-Object Diagnostics.ProcessStartInfo
    $profileStart.FileName = $profileNode
    $profileStart.Arguments = '"' + $profileWorker + '"'
    $profileStart.WorkingDirectory = $profileRoot
    $profileStart.UseShellExecute = $false
    $profileStart.CreateNoWindow = $true
    $profileStart.RedirectStandardInput = $true
    $profileStart.RedirectStandardOutput = $true
    $profileStart.RedirectStandardError = $true
    $profileChild = [Diagnostics.Process]::Start($profileStart)
    $profileChild.StandardInput.Write($profilePayload)
    $profileChild.StandardInput.Close()
    $profilePayload = $null
    if (-not $profileChild.WaitForExit(25000)) { $profileChild.Kill(); throw 'Timeout' }
    $profileOutput = $profileChild.StandardOutput.ReadToEnd() | ConvertFrom-Json
    $profilePass = $profileChild.ExitCode -eq 0 -and $profileOutput.ok -eq $true
    $profileResults += [pscustomobject]@{ kind=$profileKind; ok=[bool]$profilePass;
      checks=$(if ($profilePass) { 'direct_login_metadata_profile_acl' } else { 'failed' }) }
    Write-Host ($profileKind + ': ' + $(if ($profilePass) { 'PASS' } else { 'FAIL' }))
  } catch {
    $profileResults += [pscustomobject]@{ kind=$profileKind; ok=$false; checks='failed' }
    Write-Host ($profileKind + ': FAIL (details suppressed)')
  } finally {
    $profilePayload=$null
    if ($profilePointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($profilePointer) }
    if ($profileChild) { $profileChild.Dispose() }
    $profileSecret.Dispose()
  }
}
$profileEvidenceDir = Join-Path $profileRoot '.tmp/evidence'
[IO.Directory]::CreateDirectory($profileEvidenceDir) | Out-Null
$profileRevision = & git -c "safe.directory=$($profileRoot.Replace('\','/'))" -C $profileRoot rev-parse HEAD
[pscustomobject]@{ checkedAt=[DateTime]::UtcNow.ToString('o'); revision=$profileRevision; results=$profileResults } |
  ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $profileEvidenceDir 'm1-profile-credentials.json')
if (@($profileResults | Where-Object { -not $_.ok }).Count -gt 0) { exit 1 }
