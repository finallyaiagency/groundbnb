[CmdletBinding()]
param([ValidateSet('Prepare', 'Show', 'Verify', 'VerifyAuth')][string]$Mode = 'Show')
$ErrorActionPreference = 'Stop'
$m0Root = Split-Path -Parent $PSScriptRoot
$m0Kinds = @('preview', 'local')
Add-Type -AssemblyName System.Security

if ($Mode -eq 'Prepare') {
    foreach ($m0Kind in $m0Kinds) {
        if (Test-Path -LiteralPath (Join-Path $m0Root ".env.m0-smtp-$m0Kind.dpapi")) {
            throw 'Capture credentials already exist; refusing to replace them.'
        }
    }
    $m0Child = $null
    $m0Payload = $null
    $m0Accounts = $null
    try {
        $m0Start = New-Object Diagnostics.ProcessStartInfo
        $m0Start.FileName = (Get-Command node -ErrorAction Stop).Source
        $m0Start.Arguments = '"' + (Join-Path $PSScriptRoot 'prepare-m0-smtp.mjs') + '"'
        $m0Start.WorkingDirectory = $m0Root
        $m0Start.UseShellExecute = $false
        $m0Start.CreateNoWindow = $true
        $m0Start.RedirectStandardOutput = $true
        $m0Start.RedirectStandardError = $true
        $m0Start.EnvironmentVariables['M0_PRIVATE_PIPE'] = '1'
        $m0Child = [Diagnostics.Process]::Start($m0Start)
        if (-not $m0Child.WaitForExit(50000)) { $m0Child.Kill(); throw 'Timeout' }
        $m0Payload = $m0Child.StandardOutput.ReadToEnd() | ConvertFrom-Json
        if ($m0Child.ExitCode -ne 0 -or $m0Payload.ok -ne $true -or $m0Payload.accounts.Count -ne 2) { throw 'Setup failed' }
        $m0Accounts = $m0Payload.accounts
        $m0Results = @()
        foreach ($m0Account in $m0Accounts) {
            if ($m0Account.kind -notin $m0Kinds -or $m0Account.host -ne 'smtp.ethereal.email') { throw 'Unexpected target' }
            $m0Bytes = [Text.Encoding]::UTF8.GetBytes(($m0Account | ConvertTo-Json -Compress))
            try {
                $m0Protected = [Security.Cryptography.ProtectedData]::Protect($m0Bytes, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
                [IO.File]::WriteAllBytes((Join-Path $m0Root ".env.m0-smtp-$($m0Account.kind).dpapi"), $m0Protected)
            } finally { [Array]::Clear($m0Bytes, 0, $m0Bytes.Length) }
            $m0Results += [pscustomobject]@{ kind = $m0Account.kind; ok = $true; checkedAtUtc = $m0Account.checkedAtUtc;
                checks = 'distinct_capture_account_tls_synthetic_smtp_accepted_dpapi_saved' }
        }
        $m0EvidenceDir = Join-Path $m0Root '.tmp/evidence'
        New-Item -ItemType Directory -Path $m0EvidenceDir -Force | Out-Null
        $m0Results | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath (Join-Path $m0EvidenceDir 'm0-smtp-capture.json') -Encoding UTF8
        Write-Host 'Preview/local capture accounts prepared and one synthetic SMTP message accepted per account.'
        Write-Host 'Credentials encrypted for this Windows user, ignored by Git. Neon SMTP is not yet configured.'
    } catch {
        Write-Host 'Capture setup failed. No credential details displayed; check partial encrypted files before retrying.'
        exit 1
    } finally {
        $m0Payload = $null
        $m0Accounts = $null
        if ($m0Child) { $m0Child.Dispose() }
    }
    exit 0
}

if ($Mode -in @('Verify', 'VerifyAuth')) {
    # Private fixed-target worker, never print decrypted credentials or message contents.
    $m0Accounts = @()
    $m0Payload = $null
    $m0Child = $null
    try {
        foreach ($m0Kind in $m0Kinds) {
            $m0Bytes = [Security.Cryptography.ProtectedData]::Unprotect(
                [IO.File]::ReadAllBytes((Join-Path $m0Root ".env.m0-smtp-$m0Kind.dpapi")), $null,
                [Security.Cryptography.DataProtectionScope]::CurrentUser)
            try { $m0Accounts += ([Text.Encoding]::UTF8.GetString($m0Bytes) | ConvertFrom-Json) }
            finally { [Array]::Clear($m0Bytes, 0, $m0Bytes.Length) }
        }
        $m0RunName = if ($Mode -eq 'VerifyAuth') { 'm0-auth-run.json' } else { 'm0-email-run.json' }
        $m0Run = Get-Content -LiteralPath (Join-Path $m0Root ".tmp/evidence/$m0RunName") -Raw | ConvertFrom-Json
        if ([DateTime]::UtcNow -gt [DateTime]::Parse($m0Run.expiresAtUtc).ToUniversalTime()) { throw 'Bounded run expired.' }
        if ($Mode -eq 'VerifyAuth' -and (Test-Path -LiteralPath (Join-Path $m0Root '.tmp/evidence/m0-auth-check.json'))) { throw 'Auth run already attempted; refusing automatic repetition.' }
        $m0Payload = @{ accounts = $m0Accounts; startedAtUtc = $m0Run.startedAtUtc } | ConvertTo-Json -Depth 4 -Compress
        $m0Start = New-Object Diagnostics.ProcessStartInfo
        $m0Start.FileName = (Get-Command node -ErrorAction Stop).Source
        $m0WorkerName = if ($Mode -eq 'VerifyAuth') { 'verify-m0-auth.mjs' } else { 'verify-m0-mailboxes.mjs' }
        $m0Start.Arguments = '"' + (Join-Path $PSScriptRoot $m0WorkerName) + '"'
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
        $m0Accounts = $null
        $m0Timeout = if ($Mode -eq 'VerifyAuth') { 150000 } else { 50000 }
        if (-not $m0Child.WaitForExit($m0Timeout)) { $m0Child.Kill(); throw 'Timeout' }
        $m0Output = $m0Child.StandardOutput.ReadToEnd() | ConvertFrom-Json
        if ($Mode -eq 'VerifyAuth') {
            $m0Evidence = @{ checkedAtUtc = [DateTime]::UtcNow.ToString('o'); runId = $m0Run.runId;
                revision = (& git -c "safe.directory=$($m0Root.Replace('\','/'))" -C $m0Root rev-parse HEAD);
                ok = $m0Child.ExitCode -eq 0 -and $m0Output.ok -eq $true;
                distinctPublicKeys = $(if ($null -eq $m0Output.distinctPublicKeys) { $null } else { [bool]$m0Output.distinctPublicKeys }) }
            if ($m0Output.phase -match '^[a-z_]+$') { $m0Evidence.phase = $m0Output.phase }
            if ($null -ne $m0Output.status) { $m0Evidence.status = [int]$m0Output.status }
            if ($null -ne $m0Output.loginShape) {
                $m0Evidence.loginShape = @{}
                foreach ($m0ShapeKey in @('cookiePresent','userPresent','wrappedUserPresent','tokenPresent','emailMatches','emailVerified','ordinaryRole')) {
                    $m0Evidence.loginShape[$m0ShapeKey] = [bool]$m0Output.loginShape.$m0ShapeKey
                }
            }
            $m0Evidence.results = @($m0Output.results | Where-Object { $null -ne $_ } | ForEach-Object {
                [pscustomobject]@{ kind = $_.kind; ok = [bool]$_.ok; ownSessionVerified = [bool]$_.ownSessionVerified;
                    otherSessionRejected = [bool]$_.otherSessionRejected; productionRejected = [bool]$_.productionRejected;
                    signOutVerified = [bool]$_.signOutVerified }
            })
            $m0Evidence | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $m0Root '.tmp/evidence/m0-auth-check.json') -Encoding UTF8
            Write-Host ('Synthetic Auth session checks: ' + $(if ($m0Evidence.ok) { 'PASS' } else { 'FAIL' }))
            if (-not $m0Evidence.ok) { exit 1 }
            exit 0
        }
        if (-not $m0Output.results -or $m0Output.results.Count -ne 2) { throw 'Check failed' }
        $m0Results = @($m0Output.results | ForEach-Object {
            [pscustomobject]@{ kind = $_.kind; ok = [bool]$_.ok; readOnly = [bool]$_.readOnly;
                smokeCount = [int]$_.smokeCount; neonCount = [int]$_.neonCount; foreignCount = [int]$_.foreignCount;
                authMessageCount = [int]$_.authMessageCount; linkShapes = @($_.linkShapes | ForEach-Object {
                    [pscustomobject]@{ sameAuthHost = [bool]$_.sameAuthHost; tokenInQuery = [bool]$_.tokenInQuery;
                        pathSegmentCount = [int]$_.pathSegmentCount;
                        knownPathSegments = @($_.knownPathSegments | Where-Object { $_ -in @('auth','api','groundbnb','verify-email','reset-password') }) }
                }) }
        })
        $m0Evidence = @{ checkedAtUtc = $m0Output.checkedAtUtc; runId = $m0Run.runId;
            revision = (& git -c "safe.directory=$($m0Root.Replace('\','/'))" -C $m0Root rev-parse HEAD);
            ok = $m0Child.ExitCode -eq 0 -and $m0Output.ok -eq $true; results = $m0Results }
        $m0Evidence | ConvertTo-Json -Depth 7 | Set-Content -LiteralPath (Join-Path $m0Root '.tmp/evidence/m0-email-capture-verified.json') -Encoding UTF8
        Write-Host ('Captured Neon messages: ' + $(if ($m0Evidence.ok) { 'PASS' } else { 'FAIL' }))
        if (-not $m0Evidence.ok) { exit 1 }
    } catch { Write-Host 'Mailbox check failed; no credential or message details displayed.'; exit 1 }
    finally { $m0Accounts = $null; $m0Payload = $null; if ($m0Child) { $m0Child.Dispose() } }
    exit 0
}

# Client-only display. Codex must never run Show or expose decrypted values.
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$m0Form = New-Object Windows.Forms.Form
$m0Form.Text = 'Groundbnb M0 - copy each branch SMTP setting into Neon'
$m0Form.Size = New-Object Drawing.Size(720, 430)
$m0Form.StartPosition = 'CenterScreen'
$m0Tabs = New-Object Windows.Forms.TabControl
$m0Tabs.Dock = 'Fill'
$m0Form.Controls.Add($m0Tabs)
foreach ($m0Kind in $m0Kinds) {
    $m0Bytes = [Security.Cryptography.ProtectedData]::Unprotect(
        [IO.File]::ReadAllBytes((Join-Path $m0Root ".env.m0-smtp-$m0Kind.dpapi")), $null,
        [Security.Cryptography.DataProtectionScope]::CurrentUser)
    try { $m0Account = [Text.Encoding]::UTF8.GetString($m0Bytes) | ConvertFrom-Json }
    finally { [Array]::Clear($m0Bytes, 0, $m0Bytes.Length) }
    $m0Page = New-Object Windows.Forms.TabPage
    $m0Page.Text = $m0Kind
    $m0Tabs.TabPages.Add($m0Page)
    $m0Fields = [ordered]@{ 'Host' = $m0Account.host; 'Port' = '587'; 'Security' = 'STARTTLS';
        'Username' = $m0Account.user; 'Password' = $m0Account.pass;
        'Sender email' = $m0Account.senderEmail; 'Sender name' = $m0Account.senderName }
    $m0Row = 0
    foreach ($m0Field in $m0Fields.GetEnumerator()) {
        $m0Label = New-Object Windows.Forms.Label
        $m0Label.Text = $m0Field.Key
        $m0Label.Location = New-Object Drawing.Point(15, (20 + 42 * $m0Row))
        $m0Label.Size = New-Object Drawing.Size(110, 25)
        $m0Box = New-Object Windows.Forms.TextBox
        $m0Box.Text = [string]$m0Field.Value
        $m0Box.ReadOnly = $true
        $m0Box.UseSystemPasswordChar = $m0Field.Key -eq 'Password'
        $m0Box.Location = New-Object Drawing.Point(130, (20 + 42 * $m0Row))
        $m0Box.Size = New-Object Drawing.Size(420, 25)
        $m0Copy = New-Object Windows.Forms.Button
        $m0Copy.Text = 'Copy'
        $m0Copy.Tag = [string]$m0Field.Value
        $m0Copy.Location = New-Object Drawing.Point(560, (18 + 42 * $m0Row))
        $m0Copy.Add_Click({ [Windows.Forms.Clipboard]::SetText([string]$this.Tag) })
        $m0Page.Controls.AddRange(@($m0Label, $m0Box, $m0Copy))
        $m0Row++
    }
    $m0Account = $null
    $m0Fields = $null
}
try { [void]$m0Form.ShowDialog() } finally { $m0Form.Dispose() }
