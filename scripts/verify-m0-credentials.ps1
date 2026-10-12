[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$m0Root = Split-Path -Parent $PSScriptRoot
$m0Node = (Get-Command node -ErrorAction Stop).Source
$m0Script = Join-Path $PSScriptRoot 'verify-m0-credential.mjs'
$m0Results = @()

Write-Host 'Read-only M0 checks: local, production, recovery. Enter each existing role password.'
Write-Host 'Passwords are hidden, sent only to the pinned Neon host, and never saved.'
foreach ($m0Kind in @('local', 'production', 'recovery')) {
    $m0Role = switch ($m0Kind) {
        'local' { 'groundbnb_local_probe' }
        'production' { 'groundbnb_production_probe' }
        'recovery' { 'groundbnb_recovery_reader' }
    }
    $m0Secret = Read-Host "$m0Kind / $m0Role password" -AsSecureString
    $m0Pointer = [IntPtr]::Zero
    $m0Child = $null
    $m0Payload = $null
    try {
        $m0Pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($m0Secret)
        $m0Payload = @{ kind = $m0Kind; password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($m0Pointer) } | ConvertTo-Json -Compress
        $m0Start = New-Object Diagnostics.ProcessStartInfo
        $m0Start.FileName = $m0Node
        $m0Start.Arguments = '"' + $m0Script + '"'
        $m0Start.WorkingDirectory = $m0Root
        $m0Start.UseShellExecute = $false
        $m0Start.CreateNoWindow = $true
        $m0Start.RedirectStandardInput = $true
        $m0Start.RedirectStandardOutput = $true
        $m0Start.RedirectStandardError = $true
        $m0Child = [Diagnostics.Process]::Start($m0Start)
        $m0Child.StandardInput.Write($m0Payload)
        $m0Child.StandardInput.Close()
        $m0Payload = $null
        if (-not $m0Child.WaitForExit(25000)) { $m0Child.Kill(); throw 'Timeout' }
        $m0Output = $m0Child.StandardOutput.ReadToEnd() | ConvertFrom-Json
        $m0Pass = $m0Child.ExitCode -eq 0 -and $m0Output.ok -eq $true
        # Whitelist the persisted fields even if a child ever returns unexpected output.
        $m0Results += [pscustomobject]@{ kind = $m0Kind; role = $m0Role; ok = [bool]$m0Pass;
            checks = if ($m0Pass -and $m0Kind -eq 'recovery') { 'direct_login_metadata_identity_baseline_catalog_recovery_grants' } elseif ($m0Pass) { 'direct_login_metadata_identity_baseline_catalog' } else { 'failed' } }
        Write-Host ($m0Kind + ': ' + $(if ($m0Pass) { 'PASS' } else { 'FAIL' }))
    } catch {
        $m0Results += [pscustomobject]@{ kind = $m0Kind; role = $m0Role; ok = $false; checks = 'failed' }
        Write-Host ($m0Kind + ': FAIL (no credential details displayed)')
    } finally {
        $m0Payload = $null
        if ($m0Pointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($m0Pointer) }
        $m0Secret.Dispose()
        if ($m0Child) { $m0Child.Dispose() }
    }
}
$m0EvidenceDir = Join-Path $m0Root '.tmp/evidence'
New-Item -ItemType Directory -Path $m0EvidenceDir -Force | Out-Null
$m0Revision = (& git -c "safe.directory=$($m0Root.Replace('\','/'))" -C $m0Root rev-parse HEAD)
$m0Evidence = @{ checkedAtUtc = [DateTime]::UtcNow.ToString('o'); revision = $m0Revision; results = $m0Results }
$m0Evidence | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $m0EvidenceDir 'm0-direct-roles.json') -Encoding UTF8
Write-Host 'Saved credential-free results. Tell Codex: role checks done.'
