# Collaboration Rules

- Read `AGENTS.md` and `AI_HANDOFF.md` before changing the project.
- Inspect the current repository state and preserve unrelated work.
- Treat `AI_HANDOFF.md` as the live record of objectives, evidence, attempts, and next steps.
- Update the handoff immediately after meaningful code changes, discoveries, or validation results.
- Never claim a build or behavior works without verifying it.
- Do not force-push, merge, rebase, reset, or delete branches without explicit user approval; automatic commit and push to GitHub are authorized once verified (see below).

## Automatic commits and push to GitHub (user authorization, 2026-10-14)

- The user has authorized automatic local commits and automatic push to GitHub for all projects.
- After completing a task and appropriate verification, commit the task changes and push to GitHub (`origin`) without asking for confirmation again; do not create empty commits.
- Review the diff and preserve existing work. Include unrelated pre-existing changes only when the user explicitly requests committing them. Never commit secrets, credentials, or personal runtime data.
- This standing authorization covers local commits and pushing verified work to GitHub. Destructive operations (force-push, release, merge, rebase, reset, branch deletion) still require explicit authorization.
- A Git `post-commit` hook is configured in `.git/hooks/post-commit` to automatically push the current branch to `origin` upon commit.
- Record what was verified and any unverified behavior in `AI_HANDOFF.md`; never present a commit as proof that functionality works.
