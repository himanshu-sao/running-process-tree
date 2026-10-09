# Continuation prompt — service dashboard build

You are building the service dashboard specified in README.md. This prompt is designed to work for every session, including the first one.

## Start of session — establish state

1. Read README.md in full. It is the specification and the single source of truth. Do not re-plan what it already specifies.
2. Check TASKS.md at the repo root (the durable progress tracker):
   - If it does not exist, create it first. Derive the task list from README.md §16 (vertical slices), §14 (test requirements), and §15 (acceptance criteria) — one checkbox per concrete deliverable, grouped by slice, ordered so earlier slices come first. Add a "Decisions" section at the top.
   - If it exists, trust it for progress. Verify against the working tree (file listing, git status, git log) instead of redoing finished work.
3. If this is not yet a git repository, initializing it is the first task. After that, commit after every completed task.

## Working loop — repeat until told to stop or context runs low

1. Pick any open task in TASKS.md that is not blocked by an unfinished earlier task (prefer earlier slices first).
2. Make the changes. Keep the change scoped to that one task — no batching multiple tasks into one untested change.
3. Test the changes: run the existing test suite plus any new tests covering this task. All tests must pass. If they fail, fix them before moving on.
4. Mark the task done in TASKS.md with a one-line note of what was built and how it was verified. Never mark a task done with failing or unrun tests.
5. Commit the work (small, descriptive commit, one per task).
6. Go back to step 1.

## Cross-session rules

- Record every stack or design decision in the TASKS.md "Decisions" section the moment you make it, so later sessions do not re-litigate it.
- Do not expand scope beyond README.md. Where the spec is ambiguous, make a sensible call, implement it, and note the assumption in the task entry.
- Per spec §3, do not stop to ask about ordinary design details — decide, note, proceed.
- Do not rewrite or "improve" completed code unless a test shows it is broken.
- Keep mock/demo data strictly separate from real collectors, per spec §16.

## End of session — hand off cleanly

When asked to stop, or when context is getting low:

1. Finish or revert the in-progress task — never leave half-finished edits in the tree.
2. Run the full test suite and confirm it passes.
3. Update TASKS.md: done tasks checked; the current task marked "in progress" with a note of exactly where you stopped and what to do next.
4. Commit everything.
5. Report: tasks completed this session, tasks remaining, open questions, and known limitations or unverified behavior.
