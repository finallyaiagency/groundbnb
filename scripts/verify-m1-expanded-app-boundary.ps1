[CmdletBinding()]
param(
  [ValidateSet('12','13')]
  [string]$Baseline = '12'
)
$ErrorActionPreference = 'Stop'
$verifyRoot = Split-Path -Parent $PSScriptRoot
$verifyNode = (Get-Command node -ErrorAction Stop).Source
$verifyWorker = Join-Path $PSScriptRoot 'verify-m1-expanded-app-boundary.mjs'
$verifyTargets = @{
  local = @{ host='ep-calm-sound-b8s8ckur-pooler.c-14.us-east-1.aws.neon.tech'; role='groundbnb_local_app'; branch='br-rough-flower-b8lerkcf' }
  preview = @{ host='ep-red-night-b8pf2mdl-pooler.c-14.us-east-1.aws.neon.tech'; role='groundbnb_preview_app'; branch='br-bitter-hall-b8ibnrfy' }
}
$verifyResults = @()
Add-Type -AssemblyName System.Security

foreach ($verifyKind in @('local','preview')) {
  $verifyChild = $null
  $verifyCipherBytes = $null
  $verifyPlainBytes = $null
  $verifyConnectionText = $null
  $verifyPassword = $null
  $verifyPayload = $null
  $verifyOutputText = $null
  $verifyPhase = 'binding_read'
  $verifyCategory = 'binding'
  $verifyPass = $false
  $verifySafeSqlState = ''
  $verifySafeFailedChecks = ''
  try {
    $verifyBindingPath = Join-Path $verifyRoot ".env.m1-profile-$verifyKind.dpapi"
    $verifyCipherBytes = [IO.File]::ReadAllBytes($verifyBindingPath)
    $verifyPlainBytes = [Security.Cryptography.ProtectedData]::Unprotect(
      $verifyCipherBytes,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
    $verifyConnectionText = [Text.UTF8Encoding]::new($false,$true).GetString($verifyPlainBytes)
    $verifyUri = [Uri]::new($verifyConnectionText,[UriKind]::Absolute)
    $verifyExpected = $verifyTargets[$verifyKind]
    $verifyUserInfoParts = $verifyUri.UserInfo.Split(':',2)
    if ($verifyUri.Scheme -ne 'postgresql' -or $verifyUri.Host -ne $verifyExpected.host -or
        $verifyUri.AbsolutePath -ne '/groundbnb' -or $verifyUserInfoParts.Count -ne 2 -or
        [Uri]::UnescapeDataString($verifyUserInfoParts[0]) -ne $verifyExpected.role -or
        $verifyUri.Query -ne '?sslmode=require&channel_binding=require') { throw 'Pinned binding check failed' }
    $verifyPassword = [Uri]::UnescapeDataString($verifyUserInfoParts[1])
    if (-not $verifyPassword -or $verifyPassword.Length -gt 2048) { throw 'Pinned binding check failed' }

    $verifyPayload = @{ kind=$verifyKind; password=$verifyPassword; baseline=$Baseline } | ConvertTo-Json -Compress
    $verifyStart = [Diagnostics.ProcessStartInfo]::new()
    $verifyStart.FileName = $verifyNode
    $verifyStart.Arguments = '"' + $verifyWorker + '"'
    $verifyStart.WorkingDirectory = $verifyRoot
    $verifyStart.UseShellExecute = $false
    $verifyStart.CreateNoWindow = $true
    $verifyStart.WindowStyle = [Diagnostics.ProcessWindowStyle]::Hidden
    $verifyStart.RedirectStandardInput = $true
    $verifyStart.RedirectStandardOutput = $true
    $verifyStart.RedirectStandardError = $true
    $verifyPhase = 'worker_start'
    $verifyChild = [Diagnostics.Process]::new()
    $verifyChild.StartInfo = $verifyStart
    if (-not $verifyChild.Start()) { throw 'Worker start failed' }
    $verifyStderrTask = $verifyChild.StandardError.ReadToEndAsync()
    $verifyChild.StandardInput.Write($verifyPayload)
    $verifyChild.StandardInput.Close()
    $verifyPayload = $null
    $verifyPassword = $null
    $verifyPhase = 'worker_timeout'
    if (-not $verifyChild.WaitForExit(25000)) {
      $verifyChild.Kill()
      throw 'Worker timeout'
    }
    $null = $verifyStderrTask.GetAwaiter().GetResult()
    $verifyPhase = 'worker_response'
    $verifyOutputText = $verifyChild.StandardOutput.ReadToEnd()
    try { $verifyOutput = $verifyOutputText | ConvertFrom-Json -ErrorAction Stop }
    catch { throw 'Worker response invalid' }
    $verifySafeSqlState = if ($verifyOutput.sqlState -in @('25006','42883','42703','42P01','42601','42702','42809','42704')) {
      ' SQLSTATE '+$verifyOutput.sqlState
    } else { '' }
    $verifySafeFailedChecks = @($verifyOutput.failedChecks | Where-Object {
      $_ -in @('target_pin','receipt_count','attributes_safe','metadata_select_only','private_tables_denied',
        'sequences_denied','six_functions_allowed','no_extra_functions','create_denied','unmapped_subject_denied',
        'factor_receipt','factor_principal_present','factor_principal_absent','factor_principal_attributes',
        'factor_principal_unmembered','factor_five_functions','factor_no_extra_functions','factor_no_data_privileges')
    }) -join ','
    $verifyPass = $verifyChild.ExitCode -eq 0 -and $verifyOutput.ok -eq $true -and
      $verifyOutput.kind -eq $verifyKind -and $verifyOutput.branchId -eq $verifyExpected.branch -and
      $verifyOutput.role -eq $verifyExpected.role -and $verifyOutput.baseline -eq $Baseline -and
      $verifyOutput.checks -eq 'nonmutating_app_acl_catalog_membership_probe'
    if (-not $verifyPass) {
      $verifyPhase = if ($verifyOutput.phase -in @('input','connection','catalog')) { $verifyOutput.phase } else { 'worker_response' }
      $verifyCategory = if ($verifyOutput.category -in @('auth','permission','timeout','network','query','boundary','input','unknown')) {
        $verifyOutput.category
      } else { 'unknown' }
    }
  } catch {
    if ($verifyPhase -eq 'binding_read') { $verifyCategory='binding' }
    elseif ($verifyPhase -eq 'worker_start') { $verifyCategory='worker' }
    elseif ($verifyPhase -eq 'worker_timeout') { $verifyCategory='timeout' }
    elseif ($verifyPhase -eq 'worker_response') { $verifyCategory='response' }
    else { $verifyCategory='helper' }
  } finally {
    $verifyPayload = $null
    $verifyOutput = $null
    $verifyOutputText = $null
    $verifyConnectionText = $null
    $verifyPassword = $null
    if ($verifyPlainBytes) { [Array]::Clear($verifyPlainBytes,0,$verifyPlainBytes.Length) }
    if ($verifyCipherBytes) { [Array]::Clear($verifyCipherBytes,0,$verifyCipherBytes.Length) }
    if ($verifyChild) { $verifyChild.Dispose() }
  }
  $verifyResults += [pscustomobject]@{ kind=$verifyKind; branch=$verifyTargets[$verifyKind].branch;
    ok=[bool]$verifyPass; phase=$(if ($verifyPass) { 'complete' } else { $verifyPhase });
    category=$(if ($verifyPass) { 'none' } else { $verifyCategory }) }
  Write-Host ($verifyKind + ' baseline ' + $Baseline + ': ' + $(if ($verifyPass) { 'PASS' } else { 'FAIL ('+$verifyPhase+'/'+$verifyCategory+')'+$verifySafeSqlState+' '+$verifySafeFailedChecks }))
}

if (@($verifyResults | Where-Object { -not $_.ok }).Count -gt 0) { exit 1 }
