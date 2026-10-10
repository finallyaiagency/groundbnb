[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Security
$m0Root = Split-Path -Parent $PSScriptRoot
$m0KeyPath = Join-Path $m0Root '.env.m0-recovery-hmac.dpapi'
if (Test-Path -LiteralPath $m0KeyPath) { throw 'Recovery key already exists; refusing replacement.' }
$m0Key = New-Object byte[] 32
$m0Rng = [Security.Cryptography.RandomNumberGenerator]::Create()
try {
    $m0Rng.GetBytes($m0Key)
    $m0Protected = [Security.Cryptography.ProtectedData]::Protect($m0Key, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
    [IO.File]::WriteAllBytes($m0KeyPath, $m0Protected)
    $m0EvidenceDir = Join-Path $m0Root '.tmp/evidence'
    New-Item -ItemType Directory -Path $m0EvidenceDir -Force | Out-Null
    @{ createdAtUtc = [DateTime]::UtcNow.ToString('o'); keyId = [Guid]::NewGuid().ToString();
       keyBytes = 32; storage = 'Windows DPAPI CurrentUser'; outsideProductionSnapshots = $true;
       applicationBinding = 'not_configured'; portableRecoveryBackup = 'not_configured' } |
       ConvertTo-Json | Set-Content -LiteralPath (Join-Path $m0EvidenceDir 'm0-recovery-key.json') -Encoding UTF8
    Write-Host 'Recovery HMAC key prepared: 32 random bytes, DPAPI encrypted, outside database snapshots and Git.'
    Write-Host 'Application binding and a portable recovery backup remain separate launch work.'
} finally { [Array]::Clear($m0Key, 0, $m0Key.Length); $m0Rng.Dispose() }
