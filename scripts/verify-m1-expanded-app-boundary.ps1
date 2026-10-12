[CmdletBinding()]
param(
  [ValidateSet('12','13','14','15')]
  [string]$Baseline = '12',
  [ValidateSet('verify','constraint_metadata')]
  [string]$Mode = 'verify'
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
  $verifySafeMetadataJson = ''
  try {
    if ($Mode -eq 'constraint_metadata' -and $Baseline -notin @('14','15')) { throw 'Unsupported metadata baseline' }
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

    $verifyPayload = @{ kind=$verifyKind; password=$verifyPassword; baseline=$Baseline; mode=$Mode } | ConvertTo-Json -Compress
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
      $_ -in @('target_pin','receipt_count','factor_catalog','attributes_safe','metadata_select_only','private_tables_denied',
        'sequences_denied','six_functions_allowed','no_extra_functions','create_denied','unmapped_subject_denied',
        'synthetic_seed_trigger_exact','enrollment_base_constraints','enrollment_functions_private','enrollment_resume_constraints',
        'factor_receipt','factor_principal_present','factor_principal_absent','factor_principal_attributes',
        'ordinary_app_creator_membership_exact','factor_creator_membership_exact','factor_five_functions',
        'factor_no_extra_functions','factor_no_data_privileges')
    }) -join ','
    $verifyExpectedChecks = if ($Mode -eq 'constraint_metadata') { 'constraint_catalog_metadata_only' } else { 'nonmutating_app_acl_catalog_membership_probe' }
    $verifyPass = $verifyChild.ExitCode -eq 0 -and $verifyOutput.ok -eq $true -and
      $verifyOutput.kind -eq $verifyKind -and $verifyOutput.branchId -eq $verifyExpected.branch -and
      $verifyOutput.role -eq $verifyExpected.role -and $verifyOutput.baseline -eq $Baseline -and
      $verifyOutput.mode -eq $Mode -and $verifyOutput.checks -eq $verifyExpectedChecks
    if ($Mode -eq 'constraint_metadata' -and $verifyPass) {
      $verifySafeMetadata = @($verifyOutput.definitions | Where-Object {
        $_.table -notin @('groundbnb.factor_enrollment_operations','groundbnb.privileged_factor_audit') -or
        $_.name -notmatch '^factor_enrollment_operations_[a-z0-9_]+$|^privileged_factor_audit_[a-z0-9_]+$' -or
        $_.definition -notmatch '^[a-zA-Z0-9_ ()<>=,''\[\]:]+$'
      }).Count -eq 0
      $verifyPass = $verifySafeMetadata -and @($verifyOutput.definitions).Count -gt 0 -and
        $verifyOutput.metadataReadOnly -eq $true -and $verifyOutput.database -eq 'groundbnb' -and
        $verifyOutput.metadataObservationOnly -eq $true -and
        $verifyOutput.factorCatalog.roleName -eq ('groundbnb_'+$verifyKind+'_factor_service') -and
        $verifyOutput.factorCatalog.connectedRole -eq $verifyExpected.role -and
        $verifyOutput.factorCatalog.roleAttributesSafe -eq $true -and
        $verifyOutput.factorCatalog.creatorMembershipExact -eq $true -and
        $verifyOutput.factorCatalog.databaseSchemaBoundary -eq $true -and
        $verifyOutput.factorCatalog.effectiveFunctionSetExact -eq $true -and
        $verifyOutput.factorCatalog.functionAclExact -eq $true -and
        $verifyOutput.factorCatalog.syntheticSeedTriggerExact -eq $true -and
        $verifyOutput.factorCatalog.noDirectTablePrivileges -eq $true -and
        $verifyOutput.factorCatalog.noSequencePrivileges -eq $true
      if ($verifyPass) { $verifySafeMetadataJson = ConvertTo-Json -InputObject @($verifyOutput.definitions) -Compress -Depth 4 }
    }
    if (-not $verifyPass) {
      $verifyPhase = if ($verifyOutput.phase -in @('input','connection','catalog','schema_metadata','factor_catalog')) { $verifyOutput.phase } else { 'worker_response' }
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
  if ($Mode -eq 'constraint_metadata') {
    if ($verifyPass) {
      Write-Host ($verifyKind + ' baseline ' + $Baseline + ': READ-ONLY CONSTRAINT METADATA (not a boundary verification)')
      Write-Host $verifySafeMetadataJson
    } else {
      Write-Host ($verifyKind + ' baseline ' + $Baseline + ': FAIL ('+$verifyPhase+'/'+$verifyCategory+')'+$verifySafeSqlState)
      Write-Host 'Constraint metadata withheld because pinned catalog checks did not pass.'
    }
  } else {
    Write-Host ($verifyKind + ' baseline ' + $Baseline + ': ' + $(if ($verifyPass) { 'PASS' } else { 'FAIL ('+$verifyPhase+'/'+$verifyCategory+')'+$verifySafeSqlState+' '+$verifySafeFailedChecks }))
  }
}

if (@($verifyResults | Where-Object { -not $_.ok }).Count -gt 0) { exit 1 }
