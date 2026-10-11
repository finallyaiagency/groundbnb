[CmdletBinding()]
param(
  [switch]$SavePrivateBinding,
  [switch]$OwnerMetadataConfirmed
)

$ErrorActionPreference = 'Stop'
$factorRoot = Split-Path -Parent $PSScriptRoot
$factorNode = (Get-Command node -ErrorAction Stop).Source
$factorWorker = Join-Path $PSScriptRoot 'verify-m1-factor-credential.mjs'
$factorTargets = @{
  local = @{ host='ep-calm-sound-b8s8ckur-pooler.c-14.us-east-1.aws.neon.tech'; branch='br-rough-flower-b8lerkcf'; role='groundbnb_local_factor_service' }
  preview = @{ host='ep-red-night-b8pf2mdl-pooler.c-14.us-east-1.aws.neon.tech'; branch='br-bitter-hall-b8ibnrfy'; role='groundbnb_preview_factor_service' }
}
$factorResults = @()
$factorProtectedBindings = @{}
$factorWrittenPaths = @()
$factorPreviousPassword = $null
Add-Type -AssemblyName System.Security

if ($SavePrivateBinding -and -not $OwnerMetadataConfirmed) {
  throw 'A separate owner-side environment and migration metadata check must pass before saving bindings.'
}
if ($SavePrivateBinding) {
  [IO.Directory]::CreateDirectory((Join-Path $factorRoot '.tmp')) | Out-Null
  foreach ($factorKind in @('local','preview')) {
    $factorPath = Join-Path $factorRoot ('.tmp/.env.m1-factor-' + $factorKind + '.dpapi')
    if ([IO.File]::Exists($factorPath)) {
      throw 'A private factor binding already exists; this helper will not replace it.'
    }
  }
}

Write-Host 'Pinned factor-role credential checks only. Enter the separately activated local and preview factor-role passwords.'
Write-Host 'This checker cannot verify migration receipts/environment metadata; use the independent owner metadata check.'
Write-Host 'Password and connection data are sent only to the pinned checker child over stdin; no raw value is displayed.'

foreach ($factorKind in @('local','preview')) {
  $factorSecret = Read-Host ($factorKind + ' factor-service password') -AsSecureString
  $factorPointer = [IntPtr]::Zero
  $factorChild = $null
  $factorPayload = $null
  $factorPassword = $null
  $factorUrl = $null
  $factorUrlBytes = $null
  $factorBuilder = $null
  $factorProtected = $null
  $factorOutput = $null
  $factorPhase = 'password_input'
  $factorCategory = 'input'
  $factorPass = $false

  try {
    $factorPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($factorSecret)
    $factorPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($factorPointer)
    if ($factorPassword.Length -lt 24 -or $factorPassword.Length -gt 2048 -or $factorPassword -match '[\x00\r\n]') {
      throw 'Invalid password input'
    }
    if ($null -ne $factorPreviousPassword -and $factorPassword -ceq $factorPreviousPassword) {
      throw 'Local and preview passwords must differ'
    }
    if ($factorKind -eq 'local') { $factorPreviousPassword = $factorPassword }

    $factorPayload = @{ kind=$factorKind; password=$factorPassword } | ConvertTo-Json -Compress
    $factorStart = [Diagnostics.ProcessStartInfo]::new()
    $factorStart.FileName = $factorNode
    $factorStart.Arguments = '"' + $factorWorker + '"'
    $factorStart.WorkingDirectory = $factorRoot
    $factorStart.UseShellExecute = $false
    $factorStart.CreateNoWindow = $true
    $factorStart.WindowStyle = [Diagnostics.ProcessWindowStyle]::Hidden
    $factorStart.RedirectStandardInput = $true
    $factorStart.RedirectStandardOutput = $true
    $factorStart.RedirectStandardError = $true
    $factorPhase = 'worker_start'
    $factorChild = [Diagnostics.Process]::new()
    $factorChild.StartInfo = $factorStart
    if (-not $factorChild.Start()) { throw 'Worker start failed' }
    $factorStderrTask = $factorChild.StandardError.ReadToEndAsync()
    $factorChild.StandardInput.Write($factorPayload)
    $factorChild.StandardInput.Close()
    $factorPayload = $null
    $factorPassword = $null
    $factorPhase = 'worker_timeout'
    if (-not $factorChild.WaitForExit(25000)) {
      $factorChild.Kill()
      throw 'Worker timeout'
    }
    $null = $factorStderrTask.GetAwaiter().GetResult()
    $factorPhase = 'worker_response'
    try { $factorOutput = $factorChild.StandardOutput.ReadToEnd() | ConvertFrom-Json -ErrorAction Stop }
    catch { throw 'Worker response invalid' }
    $factorTarget = $factorTargets[$factorKind]
    $factorPass = $factorChild.ExitCode -eq 0 -and $factorOutput.ok -eq $true -and
      $factorOutput.kind -eq $factorKind -and $factorOutput.role -eq $factorTarget.role -and
      $factorOutput.branchId -eq $factorTarget.branch -and
      $factorOutput.checks -eq 'factor_credential_catalog_boundary' -and $factorOutput.phase -eq 'complete'

    if ($factorPass -and $SavePrivateBinding) {
      $factorPhase = 'encrypted_binding'
      $factorBuilder = [UriBuilder]::new('postgresql',$factorTarget.host)
      $factorBuilder.UserName = $factorTarget.role
      $factorBuilder.Password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($factorPointer)
      $factorBuilder.Path = '/groundbnb'
      $factorBuilder.Query = 'sslmode=require&channel_binding=require'
      $factorUrl = $factorBuilder.Uri.AbsoluteUri
      $factorUrlBytes = [Text.Encoding]::UTF8.GetBytes($factorUrl)
      $factorProtected = [Security.Cryptography.ProtectedData]::Protect(
        $factorUrlBytes,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
      $factorProtectedBindings[$factorKind] = $factorProtected
      $factorProtected = $null
      $factorPassword = $null
    }

    if (-not $factorPass) {
      $factorPhase = if ($factorOutput.phase -in @('input','connection','catalog','result')) { $factorOutput.phase } else { 'worker_response' }
      $factorCategory = if ($factorOutput.category -in @('auth','permission','timeout','network','catalog','input','unknown')) {
        $factorOutput.category
      } else { 'unknown' }
    } else { $factorCategory = 'none' }
  } catch {
    $factorPass = $false
    if ($factorPhase -eq 'password_input') { $factorCategory='input' }
    elseif ($factorPhase -eq 'worker_start') { $factorCategory='worker' }
    elseif ($factorPhase -eq 'worker_timeout') { $factorCategory='timeout' }
    elseif ($factorPhase -eq 'worker_response') { $factorCategory='response' }
    else { $factorCategory='helper' }
  } finally {
    $factorPayload = $null
    $factorPassword = $null
    $factorUrl = $null
    if ($factorBuilder) {
      try { $factorBuilder.Password = '' } catch { }
      try { $factorBuilder.UserName = '' } catch { }
    }
    $factorBuilder = $null
    $factorTarget = $null
    $factorStart = $null
    $factorStderrTask = $null
    $factorOutput = $null
    if ($factorUrlBytes) { [Array]::Clear($factorUrlBytes,0,$factorUrlBytes.Length) }
    $factorUrlBytes = $null
    if ($factorProtected) { [Array]::Clear($factorProtected,0,$factorProtected.Length) }
    $factorProtected = $null
    if ($factorPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($factorPointer) }
    $factorPointer = [IntPtr]::Zero
    if ($factorChild) { $factorChild.Dispose() }
    $factorChild = $null
    $factorSecret.Dispose()
    $factorSecret = $null
  }

  $factorResults += [pscustomobject]@{ kind=$factorKind; role=$factorTargets[$factorKind].role;
    branch=$factorTargets[$factorKind].branch; ok=[bool]$factorPass;
    phase=$(if ($factorPass) { 'complete' } else { $factorPhase }); category=$factorCategory }
  Write-Host ($factorKind + ': ' + $(if ($factorPass) { 'PASS' } else { 'FAIL ('+$factorPhase+'/'+$factorCategory+')' }))
}

$factorAllPassed = @($factorResults | Where-Object { -not $_.ok }).Count -eq 0
if ($factorAllPassed -and $SavePrivateBinding) {
  foreach ($factorKind in @('local','preview')) {
    $factorPath = Join-Path $factorRoot ('.tmp/.env.m1-factor-' + $factorKind + '.dpapi')
    $factorFile = $null
    $factorCreatedPath = $false
    try {
      $factorFile = [IO.File]::Open($factorPath,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
      $factorCreatedPath = $true
      $factorFile.Write($factorProtectedBindings[$factorKind],0,$factorProtectedBindings[$factorKind].Length)
      $factorFile.Flush($true)
      $factorWrittenPaths += $factorPath
    } catch {
      if ($factorFile) {
        try { $factorFile.Dispose() } catch { }
        $factorFile = $null
      }
      if ($factorCreatedPath -and [IO.File]::Exists($factorPath)) {
        try { [IO.File]::Delete($factorPath) } catch { }
      }
      foreach ($factorWrittenPath in $factorWrittenPaths) {
        if ([IO.File]::Exists($factorWrittenPath)) {
          try { [IO.File]::Delete($factorWrittenPath) } catch { }
        }
      }
      $factorAllPassed = $false
      Write-Host ($factorKind + ': FAIL (encrypted_binding/helper)')
      break
    } finally {
      if ($factorFile) { $factorFile.Dispose() }
    }
  }
}

foreach ($factorKind in @('local','preview')) {
  if ($factorProtectedBindings.ContainsKey($factorKind)) {
    [Array]::Clear($factorProtectedBindings[$factorKind],0,$factorProtectedBindings[$factorKind].Length)
  }
}
$factorPreviousPassword = $null

$factorEvidenceDir = Join-Path $factorRoot '.tmp/evidence'
[IO.Directory]::CreateDirectory($factorEvidenceDir) | Out-Null
$factorRevision = & git -c "safe.directory=$($factorRoot.Replace('\','/'))" -C $factorRoot rev-parse HEAD
[pscustomobject]@{ checkedAt=[DateTime]::UtcNow.ToString('o'); revision=$factorRevision;
  checks='factor_credential_catalog_boundary'; bindingSaved=[bool]($SavePrivateBinding -and $factorAllPassed);
  results=$factorResults } | ConvertTo-Json -Depth 4 |
  Set-Content -LiteralPath (Join-Path $factorEvidenceDir 'm1-factor-credentials.json')

if (-not $factorAllPassed) { exit 1 }
if ($SavePrivateBinding) { Write-Host 'Passed factor connection bindings saved as CurrentUser DPAPI ciphertext under .tmp.' }
