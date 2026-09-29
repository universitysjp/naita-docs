# Final report template

`docs/final-report-template.pdf` is the shape a NAITA industrial training report is expected to take. It is a sample, not evidence of anyone's work.

Everything invented in it is a placeholder:

- **Acme Inc (Pvt) Limited** does not exist. Its name, address, staff, business mix, goals, and numbers are invented to show the level of detail expected.
- **The photographs** come from a public placeholder service. They show ordinary scenes and depict nothing about any establishment, product, or person.
- **The student** on the cover is a placeholder for the real one.

Use it to answer three questions: what belongs in each section, how deep the numbering goes, and what a good sentence about your own work looks like. Do not copy its content.

## What is in the file

The template is 36 pages. The sample report in `docs/sample-report.pdf` is 52 pages, and a real report will be somewhere between them: the depth comes from the work, not from padding.

### Front matter, 8 pages

| Page | Content | What to write |
| --- | --- | --- |
| 1 | Cover | NAITA heading, report title, establishment, university, then name, student number, course, field, category, NAITA registration, and training period |
| 2 | Acknowledgement | Thank the authority, the department, the establishment's management, the supervisor, and the people who helped, in that order |
| 3 | Preface | What an internship is for, the department requirement it satisfies, the NAITA scheme, the establishment and dates, and how the three chapters are arranged |
| 4-5 | Table of contents | Generated from the heading tree, with real page numbers |
| 6 | List of figures | Generated, with real page numbers |
| 7 | List of tables | Generated, with real page numbers |
| 8 | Abbreviations | Every acronym used in the body, expanded once, in alphabetical order |

The front matter carries no page numbers of its own. The body starts at page 9 and is numbered continuously to the end, as the sample does.

### Chapter 1, Training Organization, pages 9-16

| Section | Content |
| --- | --- |
| 1.0 Introduction | What this chapter covers and why the context is needed |
| 1.1 About the establishment | Key-value facts, each with its public source |
| 1.1.1 Nature of the Business | What the company does, who it does it for, how the business earns |
| 1.1.2 Work carried out by the teams | The engineering effort split, as a chart |
| 1.1.3 Organisation structure | The org chart, drawn to scale so it fits the page |
| 1.2 Corporate plan | Vision, mission, goals, and objectives, each sourced |
| 1.2.1 Strategic planning | The few choices that shape the work |
| 1.3 Management practices | How the establishment actually runs |
| 1.3.1 Recruitment and onboarding | How people join, including interns |
| 1.3.2 Development and review practice | The delivery flow and the layer diagram |
| 1.3.3 Technical practices and standards | Layer responsibilities in a table |
| 1.3.4 Leave, attendance, and working hours | The trainee's own record; official totals stay with the university |
| 1.3.5 Health, safety, and security | The rules that applied during the placement |

### Chapter 2, Training Experience, pages 17-29

| Section | Content |
| --- | --- |
| 2.0 Introduction | How the diary weeks became work streams, and the placement timeline |
| 2.1 Introduction to the placement | Interview, start, induction, first change, supervisor |
| 2.2 Learning period | What was learned before any feature was assigned |
| 2.2.1 How work is planned and reviewed | The cycle, and what it means for a review comment |
| 2.2.2 Architecture of the platform | Layers, and the path of a single request, as a table |
| 2.2.3 Tools used during the training | One subsection per tool, saying what it was used for here |
| 2.3 Assigned tasks | The work, grouped by stream rather than by week |
| 2.3.1 to 2.3.6 | Task list and search, permissions, documents and export, recruitment pipeline, dashboards, release and handover |
| 2.4 Problems and solutions | The problem, cause, and solution table |
| 2.5 Achievements | Completed work only, that can be pointed at |
| 2.6 Events involved | Meetings, code reading, safety briefings, intern day |
| 2.7 Learning and improvements | Not-yet-applied learning, kept separate from achievements |

### Chapter 3, Conclusion, pages 30-32

| Section | Content |
| --- | --- |
| 3.0 Introduction | What this chapter does |
| 3.1 Conclusion of the report | Three or four short paragraphs: what the training produced, which habit mattered most, what the work says about the level reached |
| 3.2 Personal SWOT analysis | Strengths, weaknesses, opportunities, threats, one list each |
| 3.3 Suggestions for improvement | Directed at the work, plus the trainee's own suggestions |

### Back matter, pages 33-36

| Page | Content |
| --- | --- |
| 33 | References, one citation style throughout, with URLs and access dates |
| 34-35 | Appendices, only where they make the report clearer and are approved for sharing |
| 36 | Supervisor certification: declaration, name, designation, date, signature line |

## Rules the writing must follow

These are the same rules the diary enforces, and they are what a supervisor checks by eye.

1. **Write the work, not the change.** "Added a search box so users can find tasks by title." not "Add: search." Describe what a user or the team can now do.
2. **No repository language.** No Git, commit, branch, pull request, merge, or file paths in the report.
3. **A problem needs a cause.** A table row of problem, cause, and solution teaches something. Problem and solution alone does not.
4. **A cause needs a fix that can be repeated.** "Reset the filter when the search is cleared" is repeatable. "Fixed the bug" is not.
5. **No invented verification.** No "all tests pass", no "resolved in production", no invented user feedback, no approvals, no named attendees at invented meetings.
6. **A figure must show what its caption says.** Never claim a screenshot shows something you have not looked at.
7. **Plain professional English, past tense, no first person.** Short sentences, no em dashes or semicolons, ASCII only.
8. **Never fill the official areas.** Trainee signature, engineer remarks, certification, inspection report, supervisor comments, and official leave totals stay for the people entitled to complete them.

## The writing standard, shown

The template exists partly to show the difference between a weak sentence and a strong one. Compare:

> Added search functionality to the task list.

> Added a search box to the task list so a user can find a task by its title without reading the whole list, and added a clear control that brings the full list back.

The second one says what changed, for whom, and what problem it solves. The first one could describe any change to any screen.

A third example, for a problem:

> There were several bugs in the export.

> The printed export lost the footer because the preview and the export each had their own layout description. Both now read one shared description of the document, so a rule can only be wrong in one place.

The second version names the cause, so a reader learns something they could apply elsewhere, and it describes the fix in terms of why it holds.

## Figures, tables, and charts

The template shows the three kinds of visual the report supports, and the point is where each one goes.

- **Photographs** show the establishment, the workspace, a screen, or an event. They are placed in the section that discusses the thing they show.
- **Diagrams** explain something the reader cannot picture from text: the org chart, the delivery flow, the platform layers, the placement timeline. They are drawn to the page, so a wide chart shrinks rather than running off the margin.
- **Charts** show a number over time or a split of a total: effort by month, work by stream, the pipeline by stage. Only chart a number you can actually source. A chart of invented numbers is worse than no chart.
- **Tables** carry the pairs that are hard to read as prose: problem and cause, goal and measure, layer and responsibility.

Every visual carries a numbered caption underneath, and the list of figures and list of tables at the front are generated from those captions, so their page numbers are always correct.

Photographs must be approved for sharing and free of customer names, personal data, credentials, and anything under a confidentiality agreement. When a photograph is not available, remove the figure rather than leaving a placeholder.

## Numbering

Numbering is derived from the heading tree, so a heading can be moved or inserted without renumbering anything by hand.

- Chapters are `1`, `2`, `3`, and their own opening section is `1.0`.
- The first level under a chapter is `1.1`, the next `1.1.1`, and the template goes to four levels, `2.2.3.1`.
- Figures and tables are numbered in the order the reader meets them, which is why they live inside a section instead of a list at the end.
- Referencing your own work, as the template does, is the check that the numbering is right: "section 2.4" should be the assigned-tasks section.

## What the report reads from your workspace

Everything you write lives under `local/report/`. Nothing is hardcoded in the tool, and no file is required: a section with no file stays a visible question instead of a guess.

```text
local/report/
  content/
    work-streams.json                       optional: your own work-stream headings
    front-matter/acknowledgement.md         one paragraph per blank-line-separated block
    front-matter/preface.md
    front-matter/abbreviations.md           `TERM - expansion`, one per line
    back-matter/references.md               one citation per line
    chapters/01-organization/nature-of-business.md
    chapters/01-organization/organisation-structure.md
    chapters/01-organization/management-practices.md
    chapters/02-training-experience/placement-introduction.md
    chapters/02-training-experience/learning-period.md
    chapters/02-training-experience/events.md
    chapters/03-conclusion/conclusion.md
    chapters/03-conclusion/strengths.md
    chapters/03-conclusion/weaknesses.md
    chapters/03-conclusion/opportunities.md
    chapters/03-conclusion/threats.md
    chapters/03-conclusion/suggestions.md
  assets/
    organization/events/                    photographs referenced from events.md
    register.json                            optional: permission and redaction status
  logo.png                                  optional: cover logo (or --logo FILE)
```

In `events.md`, a `## Heading` starts a new item and `![caption](file.jpg)` under it prints that photograph from `assets/organization/events/`. A photograph that is referenced but not on disk is reported back rather than dropped silently.

### Grouping the work into streams

Accepted work points are grouped into streams so the report follows a piece of work rather than a calendar. The built-in list is deliberately general: _Planning, Setup, and Learning_, _Building the Work_, _Testing, Quality, and Release_, and _Documentation, Data, and Reporting_. A point matching none of them goes to _Other Recorded Work_, and nothing is ever dropped.

If your placement is shaped differently, write your own headings to `content/work-streams.json`:

```json
{
  "streams": [
    { "id": "field", "title": "Field Work", "anchors": ["harvest", "crop"] },
    { "id": "lab", "title": "Laboratory Work", "anchors": ["assay", "sample"] }
  ]
}
```

Anchors are matched as whole words, in the order given, and the first stream with the most matches wins. A missing or unreadable file falls back to the general list.

### Two things the report will not print

- **Repository language.** Git, commits, branches, pull requests, merges, and file paths are held back, because the report describes the work and who it was for. Held-back sentences are listed in the command result so you can reword the diary point; the rest of the point is kept.
- **Invented facts.** A fact with no public source behind it stays a question. A blank profile field prints as `[NOT RECORDED]` on the cover rather than disappearing.

## Building it yourself

```sh
bun run cli -- report --json
```

The report is built from the same local profile, weekly entries, cached evidence, and reviewed screenshots as the diary. Figures, tables, and charts sit inside the section that explains them, and the contents, list of figures, and list of tables carry real page numbers.

Company facts are researched from public sources and stored locally:

```sh
bun run cli -- company --name "Acme Inc" --agent codex
```

Every stored value carries the URL it came from. Anything that cannot be supported by a public source is left empty and reported as a question, and a saved company record is a draft for the report rather than a verified fact.

The template itself is generated, not hand-drawn, so it can be rebuilt after a layout change:

```sh
bun run cli -- report-template
```

## Working with the diary

The report and the diary cover the same six months and must agree. The diary runs first, because it is written day by day while the work is fresh, and the report is assembled afterwards from what was accepted.

- Work recorded in the diary is grouped into work streams for the report, so a reader follows a feature rather than a calendar.
- Leave and medical dates belong to the diary. In the report they appear only in the attendance table, as the trainee's own record.
- Anything beyond the six allocated months is a later extension or a permanent post and stays out of both documents. `allocation` cuts the period and archives the surplus.

`docs/DIARY-TEMPLATE.md` covers the daily document. `docs/AI-WORKFLOW.md` is the instruction set an agent follows to write both.
