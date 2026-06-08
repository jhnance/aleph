# Publish Workflow

The CLI (`npx aleph publish`) publishes a new point version. Authenticates against the Aleph backend, detects exports and use cases from the codebase, computes connections, resolves forward-propagation, assigns `version_monotonic`, and commits the version. Hotfix forward-propagation behavior is an open question.
