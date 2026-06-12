---
status: To Do
---

# CLI Authentication

The CLI authenticates against the Aleph API before any operation that requires it. Supports token-based auth via environment variable or a user-level credentials file, and initiates a magic link flow in the terminal when no token is present.

## Acceptance Criteria

- The CLI checks for a token in the following order: `ALEPH_TOKEN` environment variable, then a user-level credentials file at `~/.aleph/credentials`
- If a token is found, it is used as a Bearer token on all API requests; a 401 response causes the CLI to exit non-zero with a message instructing the user to re-authenticate
- If no token is found and the process is attached to a TTY, the CLI initiates the magic link flow: prompts for the user's email, calls the magic link endpoint, and polls for the resulting JWT; on success, writes the token to `~/.aleph/credentials` and proceeds
- If no token is found and the process is NOT attached to a TTY (CI environment), the CLI exits non-zero with a clear message instructing the user to set `ALEPH_TOKEN`
- The credentials file is created with `chmod 600` permissions (owner read/write only)
- The org context comes from the locally declared `org` slug — API requests target `/api/orgs/:orgSlug/...` and the server verifies membership per request (2026-06-11; tokens carry no org claim). Whether `org` lives in `aleph.config.ts` or is CLI-populated into `aleph.lock` is pinned (see `aleph-config.md` open questions); if it is missing, the CLI exits non-zero pointing at where to declare it
