# Contributing — DevSync (Team 065)

## Branches: these six, forever. Do not create new ones.

| Branch | Owner | Purpose |
|---|---|---|
| `main` | Vikas | Released, deployable code. Protected. |
| `develop` | Vikas | Integration. Everything lands here first. Protected. |
| `raja_backend` | Raja | Backend work |
| `abhay_frontend` | Abhay | Frontend work |
| `vikas_code_reviewer` | Vikas | Code review fixes |
| `tester` | Tester | Tests |

Rules:

- **Never run `git switch -c` or `git checkout -b`.** Every branch you need already exists.
- **Never push to `main` or `develop` directly.** They only change through a merged PR.
- You work on **your own branch only**. Do not commit on a teammate's branch.
- All PRs target `develop`. Never PR one person's branch into another's.
- `main` only ever receives a PR from `develop`.

```
raja_backend ─────┐
abhay_frontend ───┼──PR──> develop ──PR──> main
vikas_code_reviewer ┤
tester ───────────┘
```

Review is a role on a pull request, not a branch in a chain. Vikas reviews; Tester tests. Both approve on the PR itself.

---

## First time on a new machine

```bash
git clone https://github.com/23f3001800/MAY2026-Team-065.git
cd MAY2026-Team-065
git switch <your-branch>
```

Use `git switch <name>` — no `-c`. It finds the existing remote branch and sets up tracking automatically.

> **The trap that broke this repo:** never type `origin/` in a branch command.
> `git checkout -b origin/abhay_frontend` creates a *local* branch literally named
> `origin/abhay_frontend` that shadows the real remote ref, and git starts reporting
> `refname is ambiguous`. Correct command is always `git switch abhay_frontend`.

---

## Every working day

**1. Start: pull your branch, then pull in develop.**

```bash
git switch <your-branch>
git pull
git fetch origin
git merge origin/develop
```

If the merge reports conflicts, fix the listed files, then:

```bash
git add -A
git commit
```

**2. Work, then commit.**

```bash
git add -A
git commit -m "clear message about what changed"
```

**3. Before pushing, pull develop in again** (someone may have merged while you worked):

```bash
git fetch origin
git merge origin/develop
git push
```

**4. Open a PR into `develop`.**

```bash
gh pr create --base develop --head <your-branch> --title "..." --body "..."
```

Or use the GitHub web UI. Set base = `develop`.

**5. After your PR is merged, everyone resyncs.** This is the step that gets skipped and causes drift:

```bash
git switch <your-branch>
git fetch origin
git merge origin/develop
git push
```

---

## The rule that keeps permanent branches working

Because these branches live forever and are shared, **merge in, never rebase**.

```bash
git merge origin/develop     # correct
git rebase origin/develop    # NEVER — rewrites history others have pulled
```

Never use `git push --force` or `--force-with-lease` on any of these branches.

---

## Releasing to `main`

Only when `develop` is green and everyone has resynced:

```bash
gh pr create --base main --head develop --title "Release: <what>" --body "..."
```

---

## Quick reference

| Task | Command |
|---|---|
| Go to your branch | `git switch <your-branch>` |
| See where you are | `git status` |
| See all branches + sync state | `git branch -vv` |
| How far behind develop am I? | `git fetch origin && git rev-list --count HEAD..origin/develop` |
| Pull in latest develop | `git fetch origin && git merge origin/develop` |
| Undo a merge you haven't pushed | `git merge --abort` (during conflicts) or `git reset --hard @{u}` |
| Discard local uncommitted changes | `git restore .` |

## If you see `refname 'origin/x' is ambiguous`

You have a bad local branch shadowing a remote ref. Fix:

```bash
git branch -D origin/<name>      # deletes the bad LOCAL branch only
git switch <name>                # get the real one
```

Confirm the remote branch is untouched with `git branch -vv` — every branch should
show a `[origin/...]` tracking marker and no `origin/` prefix in its own name.
