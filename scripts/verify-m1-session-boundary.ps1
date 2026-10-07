[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$m1Root = Split-Path -Parent $PSScriptRoot
$m1EvidencePath = Join-Path $m1Root '.tmp/evidence/m1-01b-session-check.json'
$m1AttemptPath = Join-Path $m1Root '.tmp/evidence/m1-01b-session-attempt.json'
$m1Child = $null
$m1Accounts = @()
$m1Payload = $null
$m1StartedAt = [DateTime]::UtcNow
Add-Type -AssemblyName System.Security
try {
    if (Test-Path -LiteralPath $m1AttemptPath) { throw 'An attempt already exists; do not repeat automatically.' }
    $m1Revision = (& git -c "safe.directory=$($m1Root.Replace('\','/'))" -C $m1Root rev-parse HEAD)
    if ($LASTEXITCODE -ne 0 -or $m1Revision -notmatch '^[0-9a-f]{40}$') { throw 'Revision unavailable' }
    # Fail before mail is sent if either saved capture credential is unavailable.
    foreach ($m1Kind in @('preview', 'local')) {
        $m1Bytes = [Security.Cryptography.ProtectedData]::Unprotect(
            [IO.File]::ReadAllBytes((Join-Path $m1Root ".env.m0-smtp-$m1Kind.dpapi")), $null,
            [Security.Cryptography.DataProtectionScope]::CurrentUser)
        try { $m1Accounts += ([Text.Encoding]::UTF8.GetString($m1Bytes) | ConvertFrom-Json) }
        finally { [Array]::Clear($m1Bytes, 0, $m1Bytes.Length) }
    }
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $m1AttemptPath) | Out-Null
    # CreateNew makes simultaneous/repeated attempts fail before provider contact.
    $m1AttemptStream = [IO.File]::Open($m1AttemptPath, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write)
    try {
        $m1Attempt = @{ revision = $m1Revision; startedAtUtc = $m1StartedAt.ToString('o');
            expiresAtUtc = $m1StartedAt.AddMinutes(10).ToString('o'); maxSyntheticOtpRequests = 2; meteredDispatch = 'off' }
        $m1AttemptBytes = [Text.Encoding]::UTF8.GetBytes(($m1Attempt | ConvertTo-Json -Compress))
        $m1AttemptStream.Write($m1AttemptBytes, 0, $m1AttemptBytes.Length)
    } finally { $m1AttemptStream.Dispose() }
    $m1Payload = @{ accounts = $m1Accounts; startedAtUtc = $m1StartedAt.ToString('o') } | ConvertTo-Json -Depth 4 -Compress
    $m1Start = New-Object Diagnostics.ProcessStartInfo
    $m1Start.FileName = (Get-Command node -ErrorAction Stop).Source
    $m1Start.Arguments = '"' + (Join-Path $PSScriptRoot 'verify-m1-session-boundary.mjs') + '"'
    $m1Start.WorkingDirectory = $m1Root
    $m1Start.UseShellExecute = $false
    $m1Start.CreateNoWindow = $true
    $m1Start.RedirectStandardInput = $true
    $m1Start.RedirectStandardOutput = $true
    $m1Start.RedirectStandardError = $true
    $m1Child = [Diagnostics.Process]::Start($m1Start)
    $m1Child.StandardInput.Write($m1Payload)
    $m1Child.StandardInput.Close()
    $m1Payload = $null
    $m1Accounts = $null
    if (-not $m1Child.WaitForExit(150000)) { $m1Child.Kill(); throw 'Timeout; verify synthetic session cleanup before another attempt.' }
    $m1Output = $m1Child.StandardOutput.ReadToEnd() | ConvertFrom-Json
    $m1Evidence = @{ revision = $m1Revision; checkedAtUtc = [DateTime]::UtcNow.ToString('o');
        ok = $m1Child.ExitCode -eq 0 -and $m1Output.ok -eq $true; browserFlowVerified = $false;
        results = @($m1Output.results | Where-Object { $_.kind -in @('preview','local') } | ForEach-Object {
            [pscustomobject]@{ kind = $_.kind; ok = [bool]$_.ok; sdkOwnSessionVerified = [bool]$_.sdkOwnSessionVerified;
                sdkForeignRejected = [bool]$_.sdkForeignRejected; sdkSignOutVerified = [bool]$_.sdkSignOutVerified }
        }) }
    if ($m1Output.phase -match '^[a-z_]+$') { $m1Evidence.phase = $m1Output.phase }
    if ($null -ne $m1Output.status) { $m1Evidence.status = [int]$m1Output.status }
    $m1Evidence | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $m1EvidencePath -Encoding UTF8
    Write-Host ('M1 managed session boundary: ' + $(if ($m1Evidence.ok) { 'PASS' } else { 'FAIL' }))
    if (-not $m1Evidence.ok) { exit 1 }
} catch {
    Write-Host 'M1 live check unavailable or failed. No credentials, codes, cookies or email contents displayed. Preserve attempt/evidence files; do not retry automatically.'
    exit 1
} finally {
    $m1Accounts = $null
    $m1Payload = $null
    if ($m1Child) { $m1Child.Dispose() }
}
