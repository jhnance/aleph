# Logout

An authenticated user logs out. The JWT cookie is deleted client-side. No server-side token revocation — the token remains technically valid until `exp` but the client no longer holds it. A future `revoked_tokens` table can add forced revocation for exceptional cases.
