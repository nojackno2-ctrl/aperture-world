# Collaboration Rules

- Read `AGENTS.md` and `AI_HANDOFF.md` before changing the project.
- Inspect the current repository state and preserve unrelated work.
- Treat `AI_HANDOFF.md` as the live record of objectives, evidence, attempts, and next steps.
- Update the handoff immediately after meaningful code changes, discoveries, or validation results.
- Never claim a build or behavior works without verifying it.
- Do not push, merge, rebase, reset, or delete branches unless the user explicitly asks.

## Automatic commits (user authorization, 2026-10-05)

- The user has authorized automatic local commits for all projects. After completing a task and appropriate verification, commit the task changes without asking for confirmation again; do not create empty commits.
- Review the diff and preserve existing work. Include unrelated pre-existing changes only when the user explicitly requests committing them. Never commit secrets, credentials, or personal runtime data.
- This standing authorization covers local commits only. Push, release, merge, rebase, reset, force-push, branch deletion, and destructive operations still require explicit authorization.
- Record what was verified and any unverified behavior in `AI_HANDOFF.md`; never present a commit as proof that functionality works.
