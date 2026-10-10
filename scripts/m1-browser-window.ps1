[CmdletBinding()]
param([Parameter(Mandatory=$true)][ValidateSet('Prepare','MarkSend','MarkDiagnostic','Capture','Close')][string]$Mode)
$ErrorActionPreference='Stop'
$browserRoot=Split-Path -Parent $PSScriptRoot
$browserEnv=Join-Path $browserRoot '.env.development.local'
$browserBackup=Join-Path $browserRoot '.env.m1-browser-backup.dpapi'
$browserAttempt=Join-Path $browserRoot '.tmp/evidence/m1-01e-browser-attempt.json'
$browserBytes=$null
Add-Type -AssemblyName System.Security
try {
  if ($Mode -eq 'Prepare') {
    if ((Test-Path -LiteralPath $browserAttempt) -or (Test-Path -LiteralPath $browserBackup)) { throw 'Existing attempt' }
    $browserBytes=[Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes((Join-Path $browserRoot '.env.m1-profile-local.dpapi')),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
    $browserUrl=[Text.Encoding]::UTF8.GetString($browserBytes)
    $browserUri=[Uri]$browserUrl
    if ($browserUri.Host -ne 'ep-calm-sound-b8s8ckur-pooler.c-14.us-east-1.aws.neon.tech' -or $browserUri.AbsolutePath -ne '/groundbnb' -or $browserUri.UserInfo -notmatch '^groundbnb_local_app:') { throw 'Pin failed' }
    $browserOriginal=[IO.File]::ReadAllBytes($browserEnv)
    [IO.File]::WriteAllBytes($browserBackup,[Security.Cryptography.ProtectedData]::Protect($browserOriginal,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser))
    $browserStart=[DateTime]::UtcNow
    $browserRun=[Guid]::NewGuid().ToString()
    $browserSecretBytes=New-Object byte[] 48
    $browserRng=[Security.Cryptography.RandomNumberGenerator]::Create()
    try { $browserRng.GetBytes($browserSecretBytes) } finally { $browserRng.Dispose() }
    $browserSecret=[Convert]::ToBase64String($browserSecretBytes)
    $browserValues=@{
      GROUND_ENV='local'; GROUND_PROFILE_MODE='enabled'; GROUND_LOGIN_MODE='session-check';
      GROUND_PROFILE_DATABASE_URL=$browserUrl; GROUND_DATABASE_HOST=$browserUri.Host; GROUND_DATABASE_BRANCH_ID='br-rough-flower-b8lerkcf';
      GROUND_AUTH_ISSUER='https://ep-calm-sound-b8s8ckur.neonauth.c-14.us-east-1.aws.neon.tech/groundbnb/auth';
      GROUND_AUTH_COOKIE_NAME='groundbnb_local_session'; GROUND_AUTH_COOKIE_SECRET=$browserSecret;
      GROUND_PUBLIC_ORIGIN='http://localhost:3000'; GROUND_PRODUCTION_ORIGIN='https://groundbnb-ten.vercel.app';
      GROUND_PRODUCTION_AUTH_ISSUER='https://ep-snowy-morning-b8ax7lm3.neonauth.c-14.us-east-1.aws.neon.tech/groundbnb/auth';
      GROUND_EMAIL_MODE='capture'; GROUND_SCHEDULED_WORK='off'; GROUND_METERED_DISPATCH='off'; GROUND_SEED_MODE='synthetic';
      GROUND_BROWSER_AUTH_MODE='synthetic'; GROUND_BROWSER_AUTH_RUN_ID=$browserRun;
      GROUND_BROWSER_AUTH_START=$browserStart.ToString('o'); GROUND_BROWSER_AUTH_UNTIL=$browserStart.AddMinutes(30).ToString('o')
    }
    $browserLines=@([IO.File]::ReadAllLines($browserEnv) | Where-Object {
      $_ -notmatch '^\s*([A-Z_]+)\s*=' -or -not $browserValues.ContainsKey($matches[1])
    })
    foreach ($browserKey in $browserValues.Keys) { $browserLines+=($browserKey+'="'+$browserValues[$browserKey]+'"') }
    [IO.File]::WriteAllLines($browserEnv,$browserLines,(New-Object Text.UTF8Encoding($false)))
    $browserRevision=(& git -c "safe.directory=$($browserRoot.Replace('\','/'))" -C $browserRoot rev-parse HEAD)
    if ($LASTEXITCODE -ne 0 -or $browserRevision -notmatch '^[0-9a-f]{40}$') { throw 'Revision unavailable' }
    @{revision=$browserRevision;runId=$browserRun;startedAtUtc=$browserStart.ToString('o');expiresAtUtc=$browserStart.AddMinutes(30).ToString('o');maxOtpRequests=1;fixture='local-01@example.test';profileMode='enabled'} | ConvertTo-Json | Set-Content -LiteralPath $browserAttempt -Encoding UTF8
    Write-Host 'Local synthetic browser window prepared (30 minutes); no OTP sent.'
  } elseif ($Mode -eq 'Close') {
    if (-not (Test-Path -LiteralPath $browserBackup)) { throw 'No backup' }
    $browserBytes=[Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($browserBackup),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
    [IO.File]::WriteAllBytes($browserEnv,$browserBytes)
    Remove-Item -LiteralPath $browserBackup
    Write-Host 'Prior private local environment restored; browser activation closed.'
  } else {
    $browserRecord=Get-Content -LiteralPath $browserAttempt -Raw | ConvertFrom-Json
    if ([DateTime]::UtcNow -ge [DateTimeOffset]::Parse($browserRecord.expiresAtUtc).UtcDateTime) { throw 'Expired' }
    if ($Mode -eq 'MarkDiagnostic') {
      if (-not $browserRecord.sendStartedAtUtc -or ($browserRecord.PSObject.Properties.Name -contains 'diagnosticSentAtUtc')) { throw 'Diagnostic not admissible' }
      $browserDiagnosticMarker=[IO.File]::Open((Join-Path $browserRoot '.tmp/evidence/m1-01e-browser-diagnostic-admitted'),[IO.FileMode]::CreateNew,[IO.FileAccess]::Write)
      $browserDiagnosticMarker.Dispose()
      $browserRecord | Add-Member -NotePropertyName diagnosticSentAtUtc -NotePropertyValue ([DateTime]::UtcNow.ToString('o'))
      $browserRecord | Add-Member -NotePropertyName diagnosticReason -NotePropertyValue 'reproduced_sqlstate_25006_fixed_explicit_transaction'
      $browserRecord | Add-Member -NotePropertyName diagnosticRevision -NotePropertyValue (& git -c "safe.directory=$($browserRoot.Replace('\','/'))" -C $browserRoot rev-parse HEAD)
      $browserRecord.maxOtpRequests=2
      $browserRecord | ConvertTo-Json | Set-Content -LiteralPath $browserAttempt -Encoding UTF8
      Write-Host 'One controlled diagnostic admitted after reproduced defect; original expiry unchanged.'
    } elseif ($Mode -eq 'MarkSend') {
      if ($browserRecord.PSObject.Properties.Name -contains 'sendStartedAtUtc') { throw 'Already admitted' }
      $browserSendMarker=[IO.File]::Open((Join-Path $browserRoot '.tmp/evidence/m1-01e-browser-send-admitted'),[IO.FileMode]::CreateNew,[IO.FileAccess]::Write)
      $browserSendMarker.Dispose()
      $browserRecord | Add-Member -NotePropertyName sendStartedAtUtc -NotePropertyValue ([DateTime]::UtcNow.ToString('o'))
      $browserRecord | ConvertTo-Json | Set-Content -LiteralPath $browserAttempt -Encoding UTF8
      Write-Host 'Single synthetic browser OTP request admitted.'
    } else {
      if (-not $browserRecord.sendStartedAtUtc) { throw 'No request admitted' }
      $browserBytes=[Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes((Join-Path $browserRoot '.env.m0-smtp-local.dpapi')),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
      $browserAccount=[Text.Encoding]::UTF8.GetString($browserBytes) | ConvertFrom-Json
      $browserCaptureAt=if ($browserRecord.PSObject.Properties.Name -contains 'diagnosticSentAtUtc') { $browserRecord.diagnosticSentAtUtc } else { $browserRecord.sendStartedAtUtc }
      $browserInput=@{account=$browserAccount;sentAt=$browserCaptureAt;publicKey=[IO.File]::ReadAllText((Join-Path $browserRoot '.tmp/evidence/m1-browser-public.pem'))} | ConvertTo-Json -Compress
      $browserInfo=New-Object Diagnostics.ProcessStartInfo
      $browserInfo.FileName=(Get-Command node).Source
      $browserInfo.Arguments='"'+(Join-Path $PSScriptRoot 'capture-m1-browser-otp.mjs')+'"'
      $browserInfo.WorkingDirectory=$browserRoot; $browserInfo.UseShellExecute=$false; $browserInfo.CreateNoWindow=$true
      $browserInfo.RedirectStandardInput=$true; $browserInfo.RedirectStandardOutput=$true; $browserInfo.RedirectStandardError=$true
      $browserChild=[Diagnostics.Process]::Start($browserInfo)
      try {
        $browserChild.StandardInput.Write($browserInput); $browserChild.StandardInput.Close()
        if (-not $browserChild.WaitForExit(25000)) { $browserChild.Kill(); throw 'Capture timeout' }
        if ($browserChild.ExitCode -ne 0) { throw 'Capture failed' }
      } finally { $browserChild.Dispose() }
      Write-Host 'Synthetic code captured into encrypted browser transfer; value suppressed.'
    }
  }
} catch { Write-Host ('Browser preparation/check failed at '+$Mode+'; details suppressed. Preserve the attempt.'); exit 1 }
finally {
  if ($browserBytes) { [Array]::Clear($browserBytes,0,$browserBytes.Length) }
  $browserUrl=$null; $browserValues=$null; $browserLines=$null; $browserSecret=$null; $browserInput=$null; $browserAccount=$null
}
