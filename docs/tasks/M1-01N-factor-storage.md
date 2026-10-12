# M1-01N — Server factor secret storage primitives

Read STATE, M1-01I/L, views 00/07/12/15 and frozen privileged lifecycle Section 11.22. Prepare local server-only storage primitives with Node's maintained standard authenticated-encryption/hash APIs; do not implement an OTP or encryption algorithm.

Encrypt bounded Base32 factor secrets with AES-256-GCM, random 96-bit nonce, 128-bit authentication tag and authenticated context binding environment/account/factor/security epoch/key ID. A supplied external 256-bit key is environment-specific and distinct from auth-cookie/database/recovery credentials. Closed versioned envelope contains ciphertext/nonce/tag/key ID only; no plaintext/code/key storage or logging. Wrong key/context/modified envelope fails privately. Key provisioning/portable secure backup and durable storage remain separate acceptance gates.

Recovery codes are random high-entropy one-use secrets; persistence stores only domain-separated salted hashes tied to account/factor/epoch. Code generation/display is a future explicit enrollment action; this packet uses synthetic test fixtures only. Unknown context or malformed code refuses; comparison uses the maintained constant-time API. A matching digest remains a candidate until a durable transaction consumes the row, applies rate/epoch/session controls and audits outcome.

No real key/secret/code generation, enrollment/reset, provider or database call, app activation, permission grant or recovery bypass. Focused synthetic round-trip/tamper/context-isolation/hash tests prove primitives only, not live factor storage or MFA.
