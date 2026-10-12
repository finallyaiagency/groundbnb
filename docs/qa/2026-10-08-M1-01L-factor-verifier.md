# M1 maintained factor verifier — local evidence

Parent implemented the adapter after Luna usage limits. Pinned otplib/Node crypto plugin 13.5.0 perform actual library verification against public RFC 6238 synthetic fixtures. Three tests pass: correct six-digit SHA-1 vector, bounded adjacent 30-second tolerance, stale/incorrect/malformed refusal and already-consumed time-step refusal. Results expose only validity/matched step. Known replay state is mandatory; null represents a trusted never-used enrollment.

Dependency audit reports no known vulnerabilities. No enrolled factor, enrollment/reset, secret generation, recovery code, audit or authentication activation occurred. Replay protection requires durable atomic consumption; stateless checks cannot prevent concurrent reuse. External-key encryption, hashed one-use recovery codes, rate limiting, epoch/session checks, route integration and live acceptance remain open. ACC-08 remains Not started as a whole.
