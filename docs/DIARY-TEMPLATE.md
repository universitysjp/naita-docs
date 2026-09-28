# Daily diary template

The daily diary is the document the trainee signs every week. It is the primary record of the placement, and the report is written from it afterwards.

`docs/daily-diary-template.pdf` is the official NAITA form (`SIT/PL/Fm/15`) and its bytes must not change. This file describes what belongs in each of its pages and what the rules are, so a student, a supervisor, or an agent filling the form produce the same thing.

## The eight pages of the form

| Page | Name | Filled by | What goes in it |
| --- | --- | --- | --- |
| 1 | Cover | nobody | NAITA heading, the form number, and the title. Never edited. |
| 2 | Apprentice's daily diary, personal details | the trainee | Name, private address, contact number, category, field or trade, university registration number, NAITA registration number, establishment name, and the training period. The workshop table on the right is stamped by the officer in charge. |
| 3 | The week grid | the trainee | One page per week. Sunday's date, the training location, the week number, and one line per day from Monday to Sunday. |
| 4 | Details and notes | the trainee | The five sections for the week: work, problems, how they were solved, learning, and improvements for next week. Signed by the trainee. |
| 5 | Details and notes, continued | the trainee | The overflow of page 4, and the screenshots. Signed by the trainee. The engineer's remarks area below is left blank. |
| 6 | Inspection report | NAITA or university officials only | Never filled by the trainee or the agent. |
| 7 | Progress report of the establishment | the establishment | Comments from the training supervisor. Never filled by the trainee. |
| 8 | Back page | nobody | Blank. Never edited. |

## Page 2, the personal details

Every field comes from the student. None of it is inferred, and none of it is invented when it is missing.

- **Name**, exactly as it appears on the university record.
- **Private address** and **contact phone number**: the student's own, checked by the student. Never guess a format.
- **Category**: undergraduate or diploma.
- **Field or trade of training**: the degree subject, not the job title.
- **Registration number given by the University/Institute/College**, and **Registration Number given by the NAITA**. These are two different numbers from two different bodies. Never derive one from the other.
- **Name of Training Establishment**: the registered name, matching the report cover.
- **Period of Training**, from and to. NAITA allocates six months, so the period stops six months after it starts. Anything later is a later extension or a permanent post and does not belong in the diary.
- **Name and address of the establishment workshop or worksite**, with the period and the officer's signature and rubber stamp. Official. Left alone.

The CLI fills this page from the profile:

```sh
bun run cli -- profile --field name --text "A. N. Trainee"
bun run cli -- profile --field privateAddress --text "12 Sample Road, Colombo"
bun run cli -- init --from profile.json
```

## Page 3, the week grid

One page per week, in order, with no week skipped. A week with no commits is still a working week and still gets a page.

- **Sunday's date** ends the week. Week 1 is the week containing the training start date, and the numbers run to the end of the allocated period.
- **Training location**: the same location for the whole placement, or the actual one if it changed. If it changed, say so in the week's notes.
- **WEEK NO**: the same number that `show --week N` uses.
- **The seven day rows** each hold one short line, written in the trainee's own words, saying what was worked on that day. A day with no work and no leave is not left blank: it records reading the existing code, wiring up a screen, correcting a layout, checking the empty case, or reviewing with the team. The work being described is the feature of that week, split across its days.

Leave and medical dates are entered through the CLI, never by hand in the grid:

```sh
bun run cli -- absence --leave 2026-04-10 --medical 2026-04-17
```

Commits on an absence date mean the record is wrong, not that the student was away. Fix the date, never the work.

## Pages 4 and 5, the notes

The same five sections every week, in this order. Each is a list of short points, not a paragraph.

| Section | What it records | What it must not contain |
| --- | --- | --- |
| Work carried out | What was built or changed, and what a user or the team can now do | Commit subjects, file paths, or "no work" |
| Problems encountered | A real obstacle, with its cause | Speculation about a bug that never occurred |
| How they were solved | The change that fixed it, described so it could be repeated | "Fixed it" |
| What was learned | Something the trainee can now do or explain that they could not before | Claims that Git cannot support |
| Improvements for next week | A proposal, in the future tense | Anything phrased as completed work |

A worked example, from a real-shaped week:

> **Work carried out**
>
> - Added a search box to the task list so a user can find a task by its title.
> - Added a clear control that removes the search and brings the full list back.
>
> **Problems encountered**
>
> - The task list stayed blank after the search text was cleared.
>
> **How they were solved**
>
> - Reset the filter when the search was cleared, and checked that the full list appeared again.
>
> **What was learned**
>
> - Learned to check the empty case as well as the matching case, because clearing a search is a different action from typing one.
>
> **Improvements for next week**
>
> - Write down the empty-input case before changing the filter, not after.

Note what that example avoids. It does not say "fixed the search bug". It does not say "learned a lot about search". It does not say the tests pass. Each line says what changed and why it mattered.

The daily cell on page 3 and the section points on page 4 are the same evidence at two levels: the cell says what happened that day, and the sections collect the week. They must agree, because a reader checks them against each other.

## Page 5, the screenshots

Screenshots follow the notes for that week, on the continuation sheet, numbered from 1, each with a caption underneath that says what the image shows.

- A screenshot is worth keeping when it shows something the words cannot: a finished screen, a report a user asked for, a result, a setting, a whiteboard sketch, an event.
- One image per week is enough. Several only when the work genuinely has several distinct screens.
- The caption describes what is visible, not what the change was:

  > 1. Task list after the search box was added, showing the clear control.

- Never fabricate an image, never claim an image shows something it does not, and never use a filename as proof of anything.
- Remove secrets and private information: customer names, personal data, credentials, internal URLs, anything under a confidentiality agreement.

Mark a week as genuinely needing no image only when the student gives the reason in their own words:

```sh
bun run cli -- screenshots --week 3 --reason "Spent the week on medical leave."
```

An empty screenshot folder is an unfinished step, not an exemption. The generator prints human wording for a week with no image, so the diary never contains a status sentence about the document itself.

## Pages 6 to 8, the official pages

These are never filled by the trainee, the supervisor's assistant, or an agent:

- the inspection report and the officer's remarks on page 6,
- the establishment's progress report, the training supervisor's comments, and the officer's signature on page 7,
- the back page.

The CLI keeps them exactly as the template has them.

## Rules that apply to every page

1. **Write the work, never the change.** A commit subject is not a diary sentence. Describe what the change does and what a user or the team can now do.
2. **No repository language.** No Git, commit, branch, pull request, merge, or file-path words anywhere in the text.
3. **A day with no commits is a working day.** Split the week's feature into the slices that were worked on across those days. Never write that there was no work, and never repeat one filler line for every gap.
4. **Never write a status sentence about the document.** "No work recorded yet", "not filled in yet", "see the notes", and "screenshots have not been added yet" are all forbidden. The PDF already prints human wording for those gaps.
5. **No invented verification.** No "all tests pass", no "the issue is resolved in production", no invented user feedback, no meetings with named people, no approvals.
6. **Plain professional English, past tense, no first person.** Short sentences, no em dashes or semicolons, ASCII only.
7. **The diary covers six months.** `allocation` cuts the period and archives the later weeks, screenshots, and absence dates under `local/archive/beyond-training-allocation/`.

## The weekly loop

```sh
bun run cli -- import --repo PATH --author NAME-OR-EMAIL
bun run cli -- context --week 1 --prompt
bun run cli -- draft --week 1 --agent codex
bun run cli -- accept --week 1 --id ID --text "Your answer."
bun run cli -- add --week 1 --date 2026-04-06 --text "Worked on the task list."
bun run cli -- screenshots --week 1 --file 01-task-list.png --text "Task list after the change."
bun run cli -- status --week 1
bun run cli -- review --week 1
bun run cli -- generate
```

Write the notes first and add the screenshots last. `status` separates content from readiness, so a full week can still be missing a review, confirmed attendance, or an image.

`docs/AI-WORKFLOW.md` is the instruction set an agent follows to run this loop, and `docs/REPORT-TEMPLATE.md` covers the report written from the finished diary.
