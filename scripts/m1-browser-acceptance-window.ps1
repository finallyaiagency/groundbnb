[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)]
  [ValidateSet('Prepare','AdmitSend','Capture','Close')]
  [string]$Mode,
  [string]$RunId
)

$ErrorActionPreference='Stop'
$browserRoot=Split-Path -Parent $PSScriptRoot
$browserEnv=Join-Path $browserRoot '.env.development.local'
$localBinding=Join-Path $browserRoot '.env.m1-profile-local.dpapi'
$captureBinding=Join-Path $browserRoot '.env.m0-smtp-local.dpapi'
$runRoot=Join-Path $browserRoot '.tmp/evidence/m1-browser-runs'
$publicKeySource=Join-Path $browserRoot '.tmp/evidence/m1-browser-public.pem'
$browserOriginal=$null
$browserBindingBytes=$null
$browserCaptureBytes=$null
$browserSecretBytes=$null
$browserRunDir=$null
$browserEnvWriteStarted=$false
$captureFailureCategory='setup_failed'
$captureStartedThisInvocation=$false
Add-Type -AssemblyName System.Security

function Write-ExclusiveUtf8([string]$Path,[string]$Value) {
  $bytes=(New-Object Text.UTF8Encoding($false)).GetBytes($Value)
  $stream=[IO.File]::Open($Path,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
  try { $stream.Write($bytes,0,$bytes.Length); $stream.Flush($true) } finally { $stream.Dispose(); [Array]::Clear($bytes,0,$bytes.Length) }
}

function Read-RunRecord([string]$Path,[string]$ExpectedRunId) {
  $rawBytes=[IO.File]::ReadAllBytes($Path)
  $raw=[Text.Encoding]::UTF8.GetString($rawBytes)
  $hashProvider=[Security.Cryptography.SHA256]::Create()
  try { $actualHash=$hashProvider.ComputeHash($rawBytes) } finally { $hashProvider.Dispose() }
  $integrityPath=Join-Path (Split-Path -Parent $Path) 'run-integrity.dpapi'
  if (-not (Test-Path -LiteralPath $integrityPath -PathType Leaf)) { throw 'Run integrity record is unavailable' }
  $protectedHash=[Security.Cryptography.ProtectedData]::Unprotect(
    [IO.File]::ReadAllBytes($integrityPath),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
  try {
    $hashDifference=$actualHash.Length -bxor $protectedHash.Length
    $hashLength=[Math]::Min($actualHash.Length,$protectedHash.Length)
    for ($hashIndex=0;$hashIndex -lt $hashLength;$hashIndex++) {
      $hashDifference=$hashDifference -bor ($actualHash[$hashIndex] -bxor $protectedHash[$hashIndex])
    }
    if ($hashDifference -ne 0) { throw 'Run integrity check failed' }
  } finally { [Array]::Clear($actualHash,0,$actualHash.Length); [Array]::Clear($protectedHash,0,$protectedHash.Length); [Array]::Clear($rawBytes,0,$rawBytes.Length) }
  $record=$raw | ConvertFrom-Json
  $hasRecordsMode=$null -ne $record.PSObject.Properties['recordsMode']
  $hasTransferMode=$null -ne $record.PSObject.Properties['transferMode']
  $legacyModes=(-not $hasRecordsMode -and -not $hasTransferMode)
  $expandedModes=($record.recordsMode -eq 'manual-v1' -and $record.transferMode -eq 'reviewed-v1')
  if ($record.runId -ne $ExpectedRunId -or $record.fixture -ne 'local-01@example.test' -or
      $record.profileMode -ne 'enabled' -or $record.profileDomainMode -ne 'full-v1' -or
      (-not ($legacyModes -or $expandedModes)) -or
      $record.maxOtpRequests -ne 1) { throw 'Run record mismatch' }
  $started=[DateTimeOffset]::Parse($record.startedAtUtc).UtcDateTime
  $until=[DateTimeOffset]::Parse($record.expiresAtUtc).UtcDateTime
  if ($until -le $started -or $until.Subtract($started).TotalMinutes -gt 30) { throw 'Run window invalid' }
  return $record
}

function Get-RunDirectory([string]$ExpectedRunId) {
  if ($ExpectedRunId -notmatch '^[0-9a-f]{32}$') { throw 'Run ID invalid' }
  $path=Join-Path $runRoot $ExpectedRunId
  $resolved=[IO.Path]::GetFullPath($path)
  $expectedRoot=[IO.Path]::GetFullPath($runRoot)+[IO.Path]::DirectorySeparatorChar
  if (-not $resolved.StartsWith($expectedRoot,[StringComparison]::OrdinalIgnoreCase)) { throw 'Run path invalid' }
  return $resolved
}

try {
  if ($Mode -eq 'Prepare') {
    if ($RunId) { throw 'Prepare generates a fresh run ID' }
    if (-not (Test-Path -LiteralPath $browserEnv -PathType Leaf) -or
        -not (Test-Path -LiteralPath $localBinding -PathType Leaf) -or
        -not (Test-Path -LiteralPath $publicKeySource -PathType Leaf) -or
        -not (Test-Path -LiteralPath $captureBinding -PathType Leaf)) { throw 'Required private local bindings are unavailable' }
    $browserStart=[DateTime]::UtcNow
    $browserUntil=$browserStart.AddMinutes(30)
    $browserRun=[Guid]::NewGuid().ToString('N')
    $browserRunDir=Get-RunDirectory $browserRun
    [void][IO.Directory]::CreateDirectory($runRoot)
    [void][IO.Directory]::CreateDirectory($browserRunDir)
    $browserBackup=Join-Path $browserRunDir 'env-before.dpapi'
    $browserRecordPath=Join-Path $browserRunDir 'run.json'
    $browserIntegrityPath=Join-Path $browserRunDir 'run-integrity.dpapi'
    $browserEvent=Join-Path $browserRunDir 'prepared.json'

    $browserOriginal=[IO.File]::ReadAllBytes($browserEnv)
    $browserBindingBytes=[Security.Cryptography.ProtectedData]::Unprotect(
      [IO.File]::ReadAllBytes($localBinding),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
    $browserUrl=[Text.Encoding]::UTF8.GetString($browserBindingBytes)
    $browserUri=[Uri]$browserUrl
    if ($browserUri.Scheme -ne 'postgresql' -or
        $browserUri.Host -ne 'ep-calm-sound-b8s8ckur-pooler.c-14.us-east-1.aws.neon.tech' -or
        $browserUri.AbsolutePath -ne '/groundbnb' -or $browserUri.UserInfo -notmatch '^groundbnb_local_app:') {
      throw 'Pinned local database binding check failed'
    }
    $existingLines=[IO.File]::ReadAllLines($browserEnv)
    if ($existingLines | Where-Object { $_ -match '^\s*GROUND_BROWSER_AUTH_(MODE|RUN_ID|START|UNTIL)\s*=' }) {
      throw 'An existing browser window must be closed before a new run'
    }
    $browserProtected=[Security.Cryptography.ProtectedData]::Protect(
      $browserOriginal,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
    [IO.File]::WriteAllBytes($browserBackup,$browserProtected)
    [Array]::Clear($browserProtected,0,$browserProtected.Length)
    $publicKeyInfo=Get-Item -LiteralPath $publicKeySource
    if ($publicKeyInfo.Length -lt 1 -or $publicKeyInfo.Length -gt 8192) { throw 'Public key file size invalid' }
    [IO.File]::Copy($publicKeySource,(Join-Path $browserRunDir 'public.pem'),$false)

    $browserRevision=(& git -c "safe.directory=$($browserRoot.Replace('\','/'))" -C $browserRoot rev-parse HEAD)
    if ($LASTEXITCODE -ne 0 -or $browserRevision -notmatch '^[0-9a-f]{40}$') { throw 'Revision unavailable' }
    $browserRecord=@{
      revision=$browserRevision; runId=$browserRun; startedAtUtc=$browserStart.ToString('o')
      expiresAtUtc=$browserUntil.ToString('o'); maxOtpRequests=1; fixture='local-01@example.test'
      profileMode='enabled'; profileDomainMode='full-v1'; recordsMode='manual-v1'; transferMode='reviewed-v1'
      responseLossReplay='planned'; closeRequired=$true
    } | ConvertTo-Json -Compress
    Write-ExclusiveUtf8 $browserRecordPath $browserRecord
    $recordBytes=(New-Object Text.UTF8Encoding($false)).GetBytes($browserRecord)
    $hashProvider=[Security.Cryptography.SHA256]::Create()
    try { $recordHash=$hashProvider.ComputeHash($recordBytes) } finally { $hashProvider.Dispose(); [Array]::Clear($recordBytes,0,$recordBytes.Length) }
    $protectedRecordHash=[Security.Cryptography.ProtectedData]::Protect(
      $recordHash,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
    try { [IO.File]::WriteAllBytes($browserIntegrityPath,$protectedRecordHash) }
    finally { [Array]::Clear($recordHash,0,$recordHash.Length); [Array]::Clear($protectedRecordHash,0,$protectedRecordHash.Length) }
    Write-ExclusiveUtf8 $browserEvent (@{event='prepared';atUtc=$browserStart.ToString('o')} | ConvertTo-Json -Compress)

    $browserSecretBytes=New-Object byte[] 48
    $browserRng=[Security.Cryptography.RandomNumberGenerator]::Create()
    try { $browserRng.GetBytes($browserSecretBytes) } finally { $browserRng.Dispose() }
    $browserSecret=[Convert]::ToBase64String($browserSecretBytes)
    $browserValues=@{
      GROUND_ENV='local'; GROUND_PROFILE_MODE='enabled'; GROUND_LOGIN_MODE='session-check'
      GROUND_PROFILE_DOMAIN_MODE='full-v1'; GROUND_PROFILE_RECORDS_MODE='manual-v1'; GROUND_PROFILE_TRANSFER_MODE='reviewed-v1'
      GROUND_PROFILE_DATABASE_URL=$browserUrl; GROUND_DATABASE_HOST=$browserUri.Host
      GROUND_DATABASE_BRANCH_ID='br-rough-flower-b8lerkcf'
      GROUND_AUTH_ISSUER='https://ep-calm-sound-b8s8ckur.neonauth.c-14.us-east-1.aws.neon.tech/groundbnb/auth'
      GROUND_AUTH_COOKIE_NAME='groundbnb_local_session'; GROUND_AUTH_COOKIE_SECRET=$browserSecret
      GROUND_PUBLIC_ORIGIN='http://localhost:3000'
      GROUND_PRODUCTION_ORIGIN='https://groundbnb-ten.vercel.app'
      GROUND_PRODUCTION_AUTH_ISSUER='https://ep-snowy-morning-b8ax7lm3.neonauth.c-14.us-east-1.aws.neon.tech/groundbnb/auth'
      GROUND_EMAIL_MODE='capture'; GROUND_SCHEDULED_WORK='off'; GROUND_METERED_DISPATCH='off'
      GROUND_SEED_MODE='synthetic'; GROUND_BROWSER_AUTH_MODE='synthetic'; GROUND_BROWSER_AUTH_RUN_ID=$browserRun
      GROUND_BROWSER_AUTH_START=$browserStart.ToString('o'); GROUND_BROWSER_AUTH_UNTIL=$browserUntil.ToString('o')
    }
    $browserLines=@($existingLines | Where-Object {
      $_ -notmatch '^\s*([A-Z_]+)\s*=' -or -not $browserValues.ContainsKey($matches[1])
    })
    foreach ($browserKey in $browserValues.Keys) { $browserLines+=($browserKey+'="'+$browserValues[$browserKey]+'"') }
    $browserEnvWriteStarted=$true
    [IO.File]::WriteAllLines($browserEnv,$browserLines,(New-Object Text.UTF8Encoding($false)))
    Write-Host ('Local synthetic window prepared; run '+$browserRun+'; expires '+$browserUntil.ToString('o')+'; no OTP sent.')
  } elseif ($Mode -eq 'Close') {
    if (-not $RunId) { throw 'Close requires the exact run ID' }
    $browserRunDir=Get-RunDirectory $RunId
    $browserRecordPath=Join-Path $browserRunDir 'run.json'
    $browserBackup=Join-Path $browserRunDir 'env-before.dpapi'
    if (-not (Test-Path -LiteralPath $browserRecordPath -PathType Leaf) -or
        -not (Test-Path -LiteralPath $browserBackup -PathType Leaf) -or
        (Test-Path -LiteralPath (Join-Path $browserRunDir 'closed.json'))) { throw 'Run is not open or restore backup is missing' }
    $null=Read-RunRecord $browserRecordPath $RunId
    $currentEnvironment=[IO.File]::ReadAllLines($browserEnv)
    if (-not ($currentEnvironment | Where-Object { $_ -match ('^\s*GROUND_BROWSER_AUTH_MODE\s*=\s*"synthetic"\s*$') }) -or
        -not ($currentEnvironment | Where-Object { $_ -match ('^\s*GROUND_BROWSER_AUTH_RUN_ID\s*=\s*"'+[regex]::Escape($RunId)+'"\s*$') })) {
      throw 'The local environment does not match this run ID'
    }
    $browserOriginal=[Security.Cryptography.ProtectedData]::Unprotect(
      [IO.File]::ReadAllBytes($browserBackup),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
    [IO.File]::WriteAllBytes($browserEnv,$browserOriginal)
    Write-ExclusiveUtf8 (Join-Path $browserRunDir 'closed.json') (@{event='closed';atUtc=[DateTime]::UtcNow.ToString('o')} | ConvertTo-Json -Compress)
    Remove-Item -LiteralPath $browserBackup
    Write-Host ('Original local environment restored for run '+$RunId+'; attempt history retained.')
  } else {
    if (-not $RunId) { throw 'This mode requires the exact run ID' }
    $browserRunDir=Get-RunDirectory $RunId
    $browserRecordPath=Join-Path $browserRunDir 'run.json'
    if (-not (Test-Path -LiteralPath $browserRecordPath -PathType Leaf)) { throw 'Run record is unavailable' }
    $browserRecord=Read-RunRecord $browserRecordPath $RunId
    if ([DateTime]::UtcNow -ge [DateTimeOffset]::Parse($browserRecord.expiresAtUtc).UtcDateTime -or
        (Test-Path -LiteralPath (Join-Path $browserRunDir 'closed.json'))) { throw 'Run is expired or closed' }
    if ($Mode -eq 'AdmitSend') {
      if ((Test-Path -LiteralPath (Join-Path $browserRunDir 'send-admitted.json')) -or
          (Test-Path -LiteralPath (Join-Path $browserRunDir 'capture-started.json'))) { throw 'The one send admission was already used' }
      $sendEvent=@{event='single_send_admitted';atUtc=[DateTime]::UtcNow.ToString('o')} | ConvertTo-Json -Compress
      Write-ExclusiveUtf8 -Path (Join-Path $browserRunDir 'send-admitted.json') -Value $sendEvent
      Write-Host 'One local synthetic OTP send action admitted. The helper did not send a request.'
    } elseif ($Mode -eq 'Capture') {
      $sendPath=Join-Path $browserRunDir 'send-admitted.json'
      $captureStart=Join-Path $browserRunDir 'capture-started.json'
      if (-not (Test-Path -LiteralPath $sendPath -PathType Leaf) -or
          (Test-Path -LiteralPath $captureStart) -or -not (Test-Path -LiteralPath (Join-Path $browserRunDir 'public.pem') -PathType Leaf) -or
          (Test-Path -LiteralPath (Join-Path $browserRunDir 'code.encrypted')) -or
          (Test-Path -LiteralPath (Join-Path $browserRunDir 'closed.json'))) { throw 'Capture is not admissible' }
      $sendRecord=[IO.File]::ReadAllText($sendPath) | ConvertFrom-Json
      Write-ExclusiveUtf8 $captureStart (@{event='capture_started';atUtc=[DateTime]::UtcNow.ToString('o')} | ConvertTo-Json -Compress)
      $captureStartedThisInvocation=$true
      $captureFailureCategory='binding_unavailable'
      $browserCaptureBytes=[Security.Cryptography.ProtectedData]::Unprotect(
        [IO.File]::ReadAllBytes($captureBinding),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
      $browserAccount=[Text.Encoding]::UTF8.GetString($browserCaptureBytes) | ConvertFrom-Json
      $captureFailureCategory='binding_invalid'
      if ($browserAccount.kind -ne 'local' -or $browserAccount.host -ne 'smtp.ethereal.email' -or
          $browserAccount.port -ne 587 -or -not $browserAccount.user.EndsWith('@ethereal.email')) {
        throw 'Pinned local capture binding check failed'
      }
      $browserPublicKeyPath=Join-Path $browserRunDir 'public.pem'
      $browserCodeTarget=Join-Path $browserRunDir 'code.encrypted'
      $browserInput=@{account=$browserAccount;sentAt=$sendRecord.atUtc;publicKey=[IO.File]::ReadAllText($browserPublicKeyPath)
        runId=$RunId;outputPath=(Join-Path '.tmp/evidence/m1-browser-runs' (Join-Path $RunId 'code.encrypted'))} | ConvertTo-Json -Compress
      $browserInfo=New-Object Diagnostics.ProcessStartInfo
      $browserInfo.FileName=(Get-Command node).Source
      $browserInfo.Arguments='"'+(Join-Path $PSScriptRoot 'capture-m1-browser-otp.mjs')+'"'
      $browserInfo.WorkingDirectory=$browserRoot; $browserInfo.UseShellExecute=$false; $browserInfo.CreateNoWindow=$true
      $browserInfo.RedirectStandardInput=$true; $browserInfo.RedirectStandardOutput=$true; $browserInfo.RedirectStandardError=$true
      $captureFailureCategory='runtime_start_failed'
      $browserChild=[Diagnostics.Process]::Start($browserInfo)
      try {
        $browserChild.StandardInput.Write($browserInput); $browserChild.StandardInput.Close()
        $captureFailureCategory='child_failure'
        if (-not $browserChild.WaitForExit(25000)) {
          $captureFailureCategory='timeout'
          $browserChild.Kill(); $browserChild.WaitForExit()
          throw 'Capture timeout'
        }
        $browserChildOutput=$browserChild.StandardOutput.ReadToEnd().Trim()
        $browserChildError=$browserChild.StandardError.ReadToEnd().Trim()
        if ($browserChild.ExitCode -ne 0) {
          $childCategories=@{
            'CAPTURE_FAILURE:invalid_request'='invalid_request'
            'CAPTURE_FAILURE:output_path_invalid'='output_path_invalid'
            'CAPTURE_FAILURE:transport_unavailable'='transport_unavailable'
            'CAPTURE_FAILURE:mailbox_unavailable'='mailbox_unavailable'
            'CAPTURE_FAILURE:message_lookup_failed'='message_lookup_failed'
            'CAPTURE_FAILURE:message_not_unique'='message_not_unique'
            'CAPTURE_FAILURE:encryption_failed'='encryption_failed'
            'CAPTURE_FAILURE:output_write_failed'='output_write_failed'
            'CAPTURE_FAILURE:timeout'='timeout'
          }
          if ($childCategories.ContainsKey($browserChildError)) { $captureFailureCategory=$childCategories[$browserChildError] }
          throw 'Capture failed'
        }
        if ($browserChildOutput -ne 'Captured') {
          $captureFailureCategory='child_protocol_invalid'
          throw 'Capture failed'
        }
      } finally { $browserChild.Dispose() }
      $captureFailureCategory='output_missing'
      $outputFile=Join-Path $browserRunDir 'code.encrypted'
      if (-not (Test-Path -LiteralPath $outputFile -PathType Leaf) -or (Get-Item -LiteralPath $outputFile).Length -le 0) {
        throw 'Capture output unavailable'
      }
      $captureFailureCategory='completion_marker_failed'
      $captureEvent=@{event='capture_completed';atUtc=[DateTime]::UtcNow.ToString('o');artifact='code.encrypted'} | ConvertTo-Json -Compress
      Write-ExclusiveUtf8 -Path (Join-Path $browserRunDir 'capture-completed.json') -Value $captureEvent
      Write-Host 'Synthetic OTP captured to a per-run encrypted file; code value suppressed.'
    }
  }
} catch {
  if ($Mode -eq 'Prepare' -and $browserEnvWriteStarted -and $browserOriginal -and $browserRunDir) {
    try {
      [IO.File]::WriteAllBytes($browserEnv,$browserOriginal)
      $failedMarker=Join-Path $browserRunDir 'prepare-failed.json'
      if (-not (Test-Path -LiteralPath $failedMarker)) {
        Write-ExclusiveUtf8 $failedMarker (@{event='prepare_failed_restored';atUtc=[DateTime]::UtcNow.ToString('o')} | ConvertTo-Json -Compress)
      }
    } catch { Write-Host 'Automatic restore failed; use the per-run DPAPI backup before continuing.' }
  }
  if ($Mode -eq 'Capture' -and $captureStartedThisInvocation -and $browserRunDir -and
      (Test-Path -LiteralPath (Join-Path $browserRunDir 'capture-started.json') -PathType Leaf) -and
      -not (Test-Path -LiteralPath (Join-Path $browserRunDir 'capture-completed.json') -PathType Leaf) -and
      -not (Test-Path -LiteralPath (Join-Path $browserRunDir 'capture-failed.json') -PathType Leaf)) {
    $allowedCaptureCategories=@('setup_failed','binding_unavailable','binding_invalid','runtime_start_failed','child_failure',
      'timeout','invalid_request','output_path_invalid','transport_unavailable','mailbox_unavailable',
      'message_lookup_failed','message_not_unique','encryption_failed','output_write_failed',
      'child_protocol_invalid','output_missing','completion_marker_failed')
    if ($captureFailureCategory -notin $allowedCaptureCategories) { $captureFailureCategory='capture_failed' }
    try {
      $failureEvent=@{event='capture_failed';atUtc=[DateTime]::UtcNow.ToString('o');category=$captureFailureCategory} | ConvertTo-Json -Compress
      Write-ExclusiveUtf8 -Path (Join-Path $browserRunDir 'capture-failed.json') -Value $failureEvent
    } catch { }
  }
  if ($Mode -eq 'Capture' -and $captureStartedThisInvocation -and $captureFailureCategory -in @('setup_failed','binding_unavailable','binding_invalid','runtime_start_failed','child_failure',
      'timeout','invalid_request','output_path_invalid','transport_unavailable','mailbox_unavailable','message_lookup_failed',
      'message_not_unique','encryption_failed','output_write_failed','child_protocol_invalid','output_missing','completion_marker_failed','capture_failed')) {
    Write-Host ('Browser window operation failed at Capture; category='+$captureFailureCategory+'; details suppressed. Preserve the run directory.')
  } else { Write-Host ('Browser window operation failed at '+$Mode+'; details suppressed. Preserve the run directory.') }
  exit 1
} finally {
  foreach ($browserBuffer in @($browserOriginal,$browserBindingBytes,$browserCaptureBytes,$browserSecretBytes)) {
    if ($browserBuffer -is [byte[]] -and $browserBuffer.Length -gt 0) { [Array]::Clear($browserBuffer,0,$browserBuffer.Length) }
  }
  $browserUrl=$null; $browserValues=$null; $browserLines=$null; $browserSecret=$null
  $browserAccount=$null; $browserInput=$null; $browserRecord=$null; $browserChildOutput=$null; $browserChildError=$null
}
