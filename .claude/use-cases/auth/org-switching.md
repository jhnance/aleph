# Org Switching

An authenticated user switches their active organization. The server verifies membership in the target org, re-issues the JWT with the updated `active_organization_id`, and replaces the cookie. No re-authentication required.
