# Magic Link Sign-In

A user submits their email, receives a magic link, clicks it, and is authenticated with a session JWT set in an HttpOnly cookie. Covers first-time sign-in (user created on upsert) and returning sign-in. Single-use token enforcement is atomic.
