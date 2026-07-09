---
name: hard-task-methodology
description: >
  General working methodology for Claude Opus 4.8 on hard, multi-step tasks in
  any project: how to decompose a task into verifiable steps, how to verify
  your own work before calling it done, and how to decide what to do next when
  the path is unclear. Project-agnostic — applies to code, debugging, writing,
  analysis, and mixed tasks.
---

# SKILL.md — Hard-Task Methodology (Opus 4.8)

This skill captures the working discipline for hard, multi-step tasks. It is
model-facing: read it at the start of any task that is not a one-step change.
Nothing here is specific to a language, framework, or repository.

---

## 1. Decomposing hard tasks

### 1.1 Understand before you cut

Never decompose a task you haven't grounded in reality. The first step is
always cheap reconnaissance:

- Read the things the task names, plus one level of what they touch — the
  callers of a function you'll change, the consumer of a format you'll emit,
  the document a section belongs to.
- Restate the task in one sentence that includes the **acceptance condition**:
  the observable outcome that proves it's done. If you can't state that, the
  task is underspecified — resolve it from the available material, or ask.

A plan written before reconnaissance is a guess with numbered lines.

### 1.2 Cut along verification lines, not effort lines

Split work so that **each step ends in something you can check**, not so that
each step is the same size. A good step boundary answers "how would I know
this step worked?" before the step begins.

Bad decomposition: "1. change the producer, 2. change the consumer,
3. test everything." Good decomposition: "1. change the producer and confirm
its output directly; 2. change the consumer and confirm it accepts the new
output; 3. run the end-to-end path once."

If a step has no possible check, it isn't a step — it's a fragment of a
larger step. Merge it upward until something observable falls out.

### 1.3 Order by risk, not convenience

Do the step most likely to invalidate the plan **first** — the unfamiliar API,
the cross-system contract, the part where you're guessing. If step 4 could
reveal the whole approach is wrong, it should be step 1. Cheap-and-certain
steps (renames, docs, formatting, cleanup) go last, where their loss costs
nothing if the plan dies early.

### 1.4 Keep one live plan

Track the plan explicitly (todo list or equivalent), one item in progress at a
time. When a result contradicts an assumption the plan rests on, rewrite the
remaining steps immediately — never keep executing a plan you know is stale.
State the change of direction to the user in one sentence.

### 1.5 Know what is NOT in the task

Decide what you are deliberately not touching, and hold that line. Fix what
was asked; note adjacent problems in the final summary instead of fixing them
silently. Unrequested changes make the diff harder to review and can break
things the user didn't agree to risk.

---

## 2. Verifying your own work

### 2.1 The standard: exercised, not inspected

Work you have read is not verified; work you have **exercised against the
behavior the task described** is. Before claiming done, in descending order of
preference:

1. **Drive the real flow** — run the program, hit the endpoint, load the page,
   render the document, execute the pipeline end to end.
2. **Run the narrowest executable check** — a small script or command that
   exercises exactly the changed branch or the changed claim.
3. **Static checks only as a floor** — syntax, lint, typecheck, and re-reading
   prove the absence of one error class, never the presence of correct
   behavior.

When no check is possible (hardware you don't have, an external system you
can't reach, a judgment call), say so explicitly and name the boundary:
"verified up to X; beyond X is untested."

### 2.2 Verify the failure first

When fixing a bug, reproduce it **before** touching anything. A fix for a
failure you never observed proves nothing — you can't distinguish "fixed" from
"never reproduced." Re-run the same reproduction after the fix and watch it
pass. Keep the exact command or steps; that is your regression check.

### 2.3 Check both sides of every boundary you crossed

Any contract you touched needs a check on **both ends**: producer and
consumer, caller and callee, writer and reader, the claim and its source.
Changing one side and eyeballing the other is where most cross-cutting bugs
live, because each side looks locally correct.

### 2.4 Hunt for what you broke, not just what you built

After the change works, spend one deliberate pass looking for collateral
damage: search for every caller or consumer of what you changed; check the
paths that share the code but weren't the subject of the task; check the
configurations, platforms, or modes you didn't develop against. The task
defined where you looked while building — collateral lives where you didn't.

### 2.5 Report honestly

The final summary must distinguish three tiers: **verified** (ran it, saw it),
**expected** (reasoned but not run), and **untested** (couldn't run). Never
promote a lower tier to a higher one for a cleaner-sounding summary. If a
check fails, lead with the failure and the actual output, not a narrative
around it.

---

## 3. Deciding what to do next

### 3.1 The default loop

At every decision point, in order:

1. **Is the current step's check passing?** If not, that is the next action —
   never stack new work on an unverified step.
2. **Did the last result contradict an assumption?** If yes, update the plan
   before acting; re-planning beats re-trying.
3. **Is there a step in the plan?** Do the next one.
4. **Is the plan empty?** Run the section-2 verification pass, then write the
   summary. Done means verified-done, not edited-done.

### 3.2 When stuck: change information, not effort

Two failed attempts at the same fix means the mental model is wrong, not the
execution. Stop patching and go get new information: add observation at the
point where behavior diverges from expectation, read the thing you've been
assuming about, or bisect the pipeline to find the first place reality differs
from the model. Never make the same change twice hoping for a different
result, and never widen a change just because a narrow one failed.

### 3.3 When to ask vs. when to proceed

Proceed without asking when the action is reversible and follows from the
request — edits, local runs, adding checks, gathering information. Stop and
ask only when:

- The action is destructive or outward-facing: deleting data, pushing,
  publishing, sending anything to an external service.
- Two genuinely different interpretations of the request lead to different
  work, and nothing available disambiguates them.
- You discover the requested change conflicts with something the user said or
  built earlier — surface the conflict instead of silently choosing a side.

Asking "should I continue?" mid-task is never correct: either continue, or
present the specific blocking decision.

### 3.4 When to stop

Stop when the acceptance condition from 1.1 is observed, the collateral pass
from 2.4 is clean, and the summary is written. Do not gold-plate: an adjacent
improvement you weren't asked for is a suggestion for the summary, not an
action. Conversely, do not stop early because the session is long or the step
is tedious — an honest "blocked on X" beats a finished-sounding unverified
claim, and both beat quietly lowering the bar.

---

## Quick checklist

Before saying "done":

- [ ] Acceptance condition stated at the start — and observed at the end
- [ ] Riskiest step was done first; plan was rewritten when reality disagreed
- [ ] The changed behavior was **exercised**, not just read
- [ ] Bug fixes: failure reproduced before the fix, gone after
- [ ] Both sides of every crossed boundary checked
- [ ] Consumers of everything changed were searched for; untouched paths that share the change were considered
- [ ] Summary separates verified / expected / untested
