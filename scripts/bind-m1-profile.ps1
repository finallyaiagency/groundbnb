[CmdletBinding()]
param([Parameter(Mandatory=$true)][ValidateSet('local','preview')][string]$Kind)
$ErrorActionPreference='Stop'
$bindingRoot=Split-Path -Parent $PSScriptRoot
$bindingBytes=$null
$bindingUrl=$null
$bindingChild=$null
$bindingPhase='encrypted_binding'
Add-Type -AssemblyName System.Security
try {
  $bindingBytes=[Security.Cryptography.ProtectedData]::Unprotect(
    [IO.File]::ReadAllBytes((Join-Path $bindingRoot ".env.m1-profile-$Kind.dpapi")),$null,
    [Security.Cryptography.DataProtectionScope]::CurrentUser)
  $bindingUrl=[Text.Encoding]::UTF8.GetString($bindingBytes)
  $bindingUri=[Uri]$bindingUrl
  $bindingHost=if ($Kind -eq 'local') { 'ep-calm-sound-b8s8ckur-pooler.c-14.us-east-1.aws.neon.tech' } else { 'ep-red-night-b8pf2mdl-pooler.c-14.us-east-1.aws.neon.tech' }
  if ($bindingUri.Scheme -ne 'postgresql' -or $bindingUri.Host -ne $bindingHost -or
      $bindingUri.AbsolutePath -ne '/groundbnb' -or $bindingUri.Query -ne '?sslmode=require&channel_binding=require' -or
      $bindingUri.UserInfo -notmatch ('^groundbnb_' + $Kind + '_app:[^:]+$') -or $bindingUri.Fragment) { throw 'Binding pin rejected' }
  if ($Kind -eq 'local') {
    $bindingPath=Join-Path $bindingRoot '.env.development.local'
    $bindingLines=if (Test-Path -LiteralPath $bindingPath) { [IO.File]::ReadAllLines($bindingPath) } else { @() }
    $bindingLines=@($bindingLines | Where-Object { $_ -notmatch '^\s*(GROUND_PROFILE_DATABASE_URL|GROUND_PROFILE_MODE)\s*=' })
    $bindingLines+=@('GROUND_PROFILE_MODE=off',('GROUND_PROFILE_DATABASE_URL="' + $bindingUrl + '"'))
    [IO.File]::WriteAllLines($bindingPath,$bindingLines,(New-Object Text.UTF8Encoding($false)))
    Write-Host 'Local private profile binding saved; profile mode remains off.'
  } else {
    $bindingProject=Get-Content -LiteralPath (Join-Path $bindingRoot '.vercel/project.json') -Raw | ConvertFrom-Json
    if ($bindingProject.projectId -ne 'prj_r5Vk1uNMNvS28qWX1UHo63t2S4ry' -or $bindingProject.orgId -ne 'team_1qtToGFf4pjRqNb8wL5ySGKP') { throw 'Project pin rejected' }
    $bindingPhase='cli_start'
    $bindingShim=(Get-Command vercel -ErrorAction Stop).Source
    $bindingCli=Join-Path (Split-Path -Parent $bindingShim) 'node_modules/vercel/dist/vc.js'
    if (-not (Test-Path -LiteralPath $bindingCli)) { throw 'Installed CLI entry unavailable' }
    $bindingStart=New-Object Diagnostics.ProcessStartInfo
    $bindingStart.FileName=(Get-Command node -ErrorAction Stop).Source
    $bindingStart.Arguments='"'+$bindingCli+'" env add GROUND_PROFILE_DATABASE_URL preview codex/m0-01-environment-contract --sensitive --yes --scope finally-ais-projects'
    $bindingStart.WorkingDirectory=$bindingRoot
    $bindingStart.UseShellExecute=$false
    $bindingStart.CreateNoWindow=$true
    $bindingStart.RedirectStandardInput=$true
    $bindingStart.RedirectStandardOutput=$true
    $bindingStart.RedirectStandardError=$true
    # Capture both streams privately: PowerShell treats native CLI stderr as errors
    # under Stop, including ordinary progress banners. No secret goes in arguments.
    $bindingChild=[Diagnostics.Process]::Start($bindingStart)
    $bindingChild.StandardInput.WriteLine($bindingUrl)
    $bindingChild.StandardInput.Close()
    $bindingPhase='cli_timeout'
    if (-not $bindingChild.WaitForExit(35000)) { $bindingChild.Kill(); throw 'Submission uncertain; inspect metadata' }
    $bindingPhase='cli_result'
    if ($bindingChild.ExitCode -ne 0) { throw 'Preview Secret submission failed; inspect metadata before retrying' }
    Write-Host 'Groundbnb preview branch Secret submitted; verify metadata before any activation.'
  }
} catch {
  Write-Host ('Binding failed ('+$bindingPhase+'). Details suppressed; inspect metadata before retrying.')
  exit 1
} finally {
  if ($bindingBytes) { [Array]::Clear($bindingBytes,0,$bindingBytes.Length) }
  $bindingUrl=$null; $bindingUri=$null; $bindingLines=$null
  if ($bindingChild) { $bindingChild.Dispose() }
}
