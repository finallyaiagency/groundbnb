[CmdletBinding()]
param([switch]$SavePrivateBinding)
$ErrorActionPreference = 'Stop'
$profileRoot = Split-Path -Parent $PSScriptRoot
$profileNode = (Get-Command node -ErrorAction Stop).Source
$profileWorker = Join-Path $PSScriptRoot 'verify-m1-profile-credential.mjs'
$profileResults = @()
$profilePreviousDigest = $null
Add-Type -AssemblyName System.Security
Write-Host 'M1 restricted application checks only. Enter each newly activated app role password.'
Write-Host 'Passwords go privately to the pinned synthetic Neon database; no password or URL is displayed/saved.'
foreach ($profileKind in @('local','preview')) {
  $profileSecret = Read-Host "$profileKind application role password" -AsSecureString
  $profilePointer = [IntPtr]::Zero
  $profileChild = $null
  $profilePayload = $null
  try {
    $profilePointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($profileSecret)
    if ($SavePrivateBinding) {
      $profilePassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($profilePointer)
      if ($profilePassword -notmatch '^[A-Za-z0-9]{24,}$') { throw 'Use a new random password of at least 24 letters/numbers' }
      $profilePasswordBytes = [Text.Encoding]::UTF8.GetBytes($profilePassword)
      $profileHasher = [Security.Cryptography.SHA256]::Create()
      try { $profileDigest = [Convert]::ToBase64String($profileHasher.ComputeHash($profilePasswordBytes)) }
      finally { $profileHasher.Dispose(); [Array]::Clear($profilePasswordBytes,0,$profilePasswordBytes.Length); $profilePassword=$null }
      if ($profileDigest -eq $profilePreviousDigest) { throw 'Passwords must differ between environments' }
      $profilePreviousDigest=$profileDigest
    }
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
    if ($profilePass -and $SavePrivateBinding) {
      $profileHost = if ($profileKind -eq 'local') { 'ep-calm-sound-b8s8ckur-pooler.c-14.us-east-1.aws.neon.tech' } else { 'ep-red-night-b8pf2mdl-pooler.c-14.us-east-1.aws.neon.tech' }
      $profilePassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($profilePointer)
      $profileUrl = 'postgresql://groundbnb_' + $profileKind + '_app:' + [Uri]::EscapeDataString($profilePassword) + '@' + $profileHost + '/groundbnb?sslmode=require&channel_binding=require'
      $profileBytes = [Text.Encoding]::UTF8.GetBytes($profileUrl)
      try {
        $profileProtected = [Security.Cryptography.ProtectedData]::Protect($profileBytes,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
        [IO.File]::WriteAllBytes((Join-Path $profileRoot ".env.m1-profile-$profileKind.dpapi"),$profileProtected)
      } finally {
        [Array]::Clear($profileBytes,0,$profileBytes.Length)
        $profilePassword=$null; $profileUrl=$null; $profileProtected=$null
      }
    }
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
