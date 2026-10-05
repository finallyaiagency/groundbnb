[CmdletBinding()]
param()
# CLIENT ONLY: Codex must not open this form or inspect its contents.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$m0Root = Split-Path -Parent $PSScriptRoot
$m0EvidencePath = Join-Path $m0Root '.tmp/evidence/m0-production-session.json'
if (Test-Path -LiteralPath $m0EvidencePath) { throw 'Check already attempted. Review its result before any new bounded run.' }
function Invoke-M0PrivateWorker($m0Body) {
    $m0Start = New-Object Diagnostics.ProcessStartInfo
    $m0Start.FileName = (Get-Command node -ErrorAction Stop).Source
    $m0Start.Arguments = '"' + (Join-Path $PSScriptRoot 'verify-m0-production-session.mjs') + '"'
    $m0Start.WorkingDirectory = $m0Root
    $m0Start.UseShellExecute = $false
    $m0Start.CreateNoWindow = $true
    $m0Start.RedirectStandardInput = $true
    $m0Start.RedirectStandardOutput = $true
    $m0Start.RedirectStandardError = $true
    $m0Start.EnvironmentVariables['M0_CLIENT_PRIVATE_PIPE'] = '1'
    $m0Child = [Diagnostics.Process]::Start($m0Start)
    try {
        $m0Child.StandardInput.Write(($m0Body | ConvertTo-Json -Compress))
        $m0Child.StandardInput.Close()
        if (-not $m0Child.WaitForExit(65000)) { $m0Child.Kill(); throw 'Timeout' }
        return ($m0Child.StandardOutput.ReadToEnd() | ConvertFrom-Json)
    } finally { $m0Child.Dispose() }
}
$m0Form = New-Object Windows.Forms.Form
$m0Form.Text = 'Groundbnb M0 - private production session check'
$m0Form.Size = New-Object Drawing.Size(720, 410)
$m0Form.StartPosition = 'CenterScreen'
$m0Label = New-Object Windows.Forms.Label
$m0Label.Text = "First create your ordinary account on Neon's production Auth tab using your real email/name.`r`nEnter that email here. Send code sends ONE Neon sign-in email to your real inbox.`r`nThen enter its six-digit code privately. Verify checks production, tests rejection on the`r`nGroundbnb preview/local Auth services, and signs this session out. Your session cookie is`r`nsent only to those three pinned issuers. No email, code, or token is saved or shown to Codex."
$m0Label.Location = New-Object Drawing.Point(15, 15)
$m0Label.Size = New-Object Drawing.Size(680, 110)
$m0Email = New-Object Windows.Forms.TextBox
$m0Email.Location = New-Object Drawing.Point(15, 135)
$m0Email.Size = New-Object Drawing.Size(445, 25)
$m0Email.UseSystemPasswordChar = $true
$m0Send = New-Object Windows.Forms.Button
$m0Send.Text = 'Send one code'
$m0Send.Location = New-Object Drawing.Point(480, 132)
$m0Send.Size = New-Object Drawing.Size(170, 30)
$m0Otp = New-Object Windows.Forms.TextBox
$m0Otp.Location = New-Object Drawing.Point(15, 185)
$m0Otp.Size = New-Object Drawing.Size(445, 25)
$m0Otp.UseSystemPasswordChar = $true
$m0Otp.MaxLength = 6
$m0Otp.Enabled = $false
$m0Verify = New-Object Windows.Forms.Button
$m0Verify.Text = 'Verify and sign out'
$m0Verify.Location = New-Object Drawing.Point(480, 182)
$m0Verify.Size = New-Object Drawing.Size(170, 30)
$m0Verify.Enabled = $false
$m0Status = New-Object Windows.Forms.Label
$m0Status.Location = New-Object Drawing.Point(15, 240)
$m0Status.Size = New-Object Drawing.Size(670, 95)
$m0Status.Text = 'Email above; verification code below. Do not paste either into chat.'
$m0Send.Add_Click({
    $m0Send.Enabled = $false
    $m0Email.ReadOnly = $true
    try {
        $script:m0SentAt = [DateTime]::UtcNow
        New-Item -ItemType Directory -Path (Split-Path -Parent $m0EvidencePath) -Force | Out-Null
        @{ok=$false; phase='production_otp_attempted'; maxRealEmails=1; checkedAtUtc=$script:m0SentAt.ToString('o')} |
            ConvertTo-Json | Set-Content -LiteralPath $m0EvidencePath -Encoding UTF8
        $m0Sent = Invoke-M0PrivateWorker @{mode='send'; email=$m0Email.Text.Trim()}
        if (-not $m0Sent.ok) { throw 'Send failed' }
        $m0Otp.Enabled = $true
        $m0Verify.Enabled = $true
        $m0Status.Text = 'Code requested. Check your real inbox and enter it below within five minutes.'
    } catch { $m0Status.Text = 'Code request failed. No details exposed. Close and report this failure; do not repeatedly resend.' }
})
$m0Verify.Add_Click({
    $m0Verify.Enabled = $false
    try {
        if ([DateTime]::UtcNow -gt $script:m0SentAt.AddMinutes(5)) { throw 'Expired' }
        $m0Result = Invoke-M0PrivateWorker @{mode='verify'; email=$m0Email.Text.Trim(); otp=$m0Otp.Text.Trim()}
        $m0Record = @{revision=(& git -c "safe.directory=$($m0Root.Replace('\','/'))" -C $m0Root rev-parse HEAD);
            checkedAtUtc=[DateTime]::UtcNow.ToString('o'); ok=[bool]$m0Result.ok;
            productionOwnSessionVerified=[bool]$m0Result.productionOwnSessionVerified;
            previewRejected=[bool]$m0Result.previewRejected; localRejected=[bool]$m0Result.localRejected;
            signOutVerified=[bool]$m0Result.cleanupVerified; maxRealEmails=1}
        if ($m0Result.phase -match '^[a-z_]+$') { $m0Record.phase=$m0Result.phase }
        if ($null -ne $m0Result.status) { $m0Record.status=[int]$m0Result.status }
        New-Item -ItemType Directory -Path (Split-Path -Parent $m0EvidencePath) -Force | Out-Null
        $m0Record | ConvertTo-Json | Set-Content -LiteralPath $m0EvidencePath -Encoding UTF8
        $m0Status.Text = $(if ($m0Record.ok) { 'PASS. Private session ended; credential-free evidence saved. Close and reply done.' } else { 'FAIL. Credential-free evidence saved. Close and report failed; do not retry.' })
    } catch {
        @{ok=$false; phase='client_check_failed_or_expired'; maxRealEmails=1; signOutVerified=$null;
            checkedAtUtc=[DateTime]::UtcNow.ToString('o')} | ConvertTo-Json |
            Set-Content -LiteralPath $m0EvidencePath -Encoding UTF8
        $m0Status.Text = 'Check failed or code expired. No secret details exposed. Close and report failed.'
    }
    finally { $m0Otp.Clear(); $m0Email.Clear() }
})
$m0Form.Controls.AddRange(@($m0Label,$m0Email,$m0Send,$m0Otp,$m0Verify,$m0Status))
try { [void]$m0Form.ShowDialog() } finally { $m0Otp.Clear(); $m0Email.Clear(); $m0Form.Dispose() }
