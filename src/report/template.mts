/**
 * Builds `docs/final-report-template.pdf`.
 *
 * The sample report shipped in `docs/sample-report.pdf` is a 52-page NAITA
 * industrial training report. This template follows the same shape, so a
 * student and a supervisor recognise the document, but every fact is invented
 * for a fictional company and the wording is written to show the standard the
 * report expects rather than to be submitted as evidence of real work.
 *
 * Acme Inc, its people, its numbers, and its photographs are all placeholders.
 * The photographs come from a public placeholder service and describe nothing
 * real; they exist to show where a photo of the office, a screen, or an event
 * belongs.
 */

import path from "node:path";

import { fetchImages } from "./assets.mts";
import { renderReportDocument } from "./render.mts";

const PIC = (seed, width = 1200, height = 800) =>
  `https://picsum.photos/seed/${seed}/${width}/${height}`;

/**
 * The photographs are placeholders from a public image service. They show
 * ordinary scenes and describe nothing about any real establishment; a student
 * replaces each one with an approved photograph of their own placement.
 */
const IMAGES = [
  {
    caption: "Reception area of the training establishment",
    file: "placeholder-reception.jpg",
    seed: "naita-reception",
  },
  {
    caption: "Open workspace of the training establishment",
    file: "placeholder-workspace.jpg",
    seed: "naita-workspace",
  },
  {
    caption: "Head office building of the training establishment",
    file: "placeholder-building.jpg",
    seed: "naita-building",
  },
  {
    caption: "Meeting room used for the weekly review",
    file: "placeholder-meeting.jpg",
    seed: "naita-meeting",
  },
  {
    caption: "Development workstation used during the placement",
    file: "placeholder-workstation.jpg",
    seed: "naita-workstation",
  },
  {
    caption: "Server room of the training establishment",
    file: "placeholder-server.jpg",
    seed: "naita-server",
  },
  {
    caption: "Design review wall used during the placement",
    file: "placeholder-whiteboard.jpg",
    seed: "naita-whiteboard",
  },
  {
    caption: "Engineering team of the training establishment",
    file: "placeholder-team.jpg",
    seed: "naita-team",
  },
  {
    caption: "Intern day presentations",
    file: "placeholder-event.jpg",
    seed: "naita-event",
  },
  {
    caption: "Check results for the release build",
    file: "placeholder-dashboard.jpg",
    seed: "naita-dashboard",
  },
  {
    caption: "Document export preview used to compare the printed layout",
    file: "placeholder-export.jpg",
    seed: "naita-export",
  },
  {
    caption: "Recruitment pipeline board used in the weekly review",
    file: "placeholder-pipeline.jpg",
    seed: "naita-pipeline",
  },
].map((image) => ({ ...image, url: PIC(image.seed) }));

const MONTHS = ["February", "March", "April", "May", "June", "July"];
const MONTH_SHORT = ["Feb", "Mar", "Apr", "May", "Jun", "Jul"];

const chartOf = (drawing, caption) => ({ caption, drawing, kind: "drawing" });

export const buildTemplateDocument = (images) => {
  const figure = (file) => {
    const image = images.find((item) => item.file === file);
    if (!image) {
      throw new Error(`Template image is missing: ${file}`);
    }
    return image;
  };
  const photo = (file, caption) => ({
    caption,
    image: figure(file),
    kind: "figure",
  });
  return {
    abbreviations: [
      { expansion: "Application Programming Interface", term: "API" },
      {
        expansion: "Continuous Integration and Continuous Delivery",
        term: "CI/CD",
      },
      { expansion: "Cross-Site Request Forgery", term: "CSRF" },
      { expansion: "Hypertext Markup Language", term: "HTML" },
      { expansion: "Hypertext Transfer Protocol", term: "HTTP" },
      { expansion: "Information and Communication Technology", term: "ICT" },
      { expansion: "JavaScript Object Notation", term: "JSON" },
      { expansion: "Key Performance Indicator", term: "KPI" },
      {
        expansion: "National Apprenticeship and Industrial Training Authority",
        term: "NAITA",
      },
      { expansion: "Personal Identifiable Information", term: "PII" },
      { expansion: "Quality Assurance", term: "QA" },
      { expansion: "Representational State Transfer", term: "REST" },
      { expansion: "Secure Sockets Layer", term: "SSL" },
      { expansion: "Software Development Life Cycle", term: "SDLC" },
      { expansion: "Structured Query Language", term: "SQL" },
      { expansion: "User Acceptance Testing", term: "UAT" },
      { expansion: "User Interface", term: "UI" },
      { expansion: "User Interface and User Experience", term: "UX" },
    ],
    acknowledgement: [
      "I would like to express my sincere gratitude to the National Apprenticeship and Industrial Training Authority for organising the Industrial Training Scheme, and to the Department of Information and Communication Technology of the University of Colombo for making the placement part of the degree programme.",
      "I am thankful to the management of Acme Inc for accepting my application and for providing a place in the engineering team. I am especially grateful to my supervisor, who took time to explain the systems I would be working with, reviewed my work each week, and answered questions patiently during the whole six months.",
      "I also thank the members of the platform team, the quality team, and the human resources team for their help, and the other trainees who made the daily work easier. This experience has shaped the way I now approach software problems, and I will carry that with me.",
    ],
    appendices: [
      {
        blocks: [
          {
            items: [
              "Requests, filters, and the code that serves them",
              "Database tables touched by the task service",
              "Screens touched in the interface",
              "Checks written for each change",
            ],
            kind: "bullets",
            marker: "arrow",
          },
          {
            caption: "Weekly delivery and quality record",
            columns: [
              { header: "Week", weight: 1 },
              { header: "Area", weight: 2 },
              { align: "right", header: "Checks added", weight: 1 },
              { align: "right", header: "Notes raised", weight: 1 },
            ],
            kind: "table",
            rows: [
              ["1", "Environment setup and access", "4", "0"],
              ["2", "Repository and review practice", "6", "2"],
              ["3", "Task list and search", "11", "3"],
              ["4", "Task detail and permissions", "9", "4"],
              ["5", "Responsive layout", "8", "2"],
              ["6", "Document upload and preview", "12", "5"],
              ["7", "Document export", "10", "3"],
              ["8", "Notifications", "7", "2"],
              ["9", "Recruitment pipeline", "9", "4"],
              ["10", "Dashboard and reports", "11", "3"],
              ["11", "Performance and caching", "8", "3"],
              ["12", "Release preparation and handover", "6", "2"],
            ],
          },
          {
            caption: "Tools and versions used during the training period",
            columns: [
              { header: "Purpose", weight: 2 },
              { header: "Technology", weight: 2 },
              { header: "How it was used", weight: 3 },
            ],
            kind: "table",
            rows: [
              [
                "Interface",
                "React and TypeScript",
                "Built the task, document, and dashboard screens",
              ],
              [
                "Service",
                "Node.js and Express",
                "Served the API used by the screens",
              ],
              [
                "Data",
                "PostgreSQL",
                "Stored tasks, documents, users, and audit records",
              ],
              [
                "Files",
                "Object storage",
                "Held uploaded documents and generated exports",
              ],
              [
                "Checks",
                "Vitest and Playwright",
                "Covered service rules and screen behaviour",
              ],
              [
                "Delivery",
                "Git and GitHub Actions",
                "Reviewed changes and ran the checks on each update",
              ],
              [
                "Monitoring",
                "Structured logging",
                "Traced failures reported by users",
              ],
            ],
          },
        ],
        title: "Delivery and Quality Record",
      },
    ],
    certification: {
      declaration:
        "I hereby declare that I have checked this report on the industrial training, and that, to my knowledge, it contains only the activities carried out during the placement and is adequate in scope and quality for submission as partial fulfilment of the degree.",
      fields: [
        { label: "Name", value: "" },
        { label: "Designation", value: "" },
        { label: "Date", value: "" },
      ],
      title: "Supervisor Certification",
    },
    chapters: [
      {
        blocks: [
          {
            kind: "paragraph",
            text: "This chapter introduces the training establishment, its place in the software industry, the way it is organised, and the working practices that shaped the placement. The details are written from the public information of the establishment and from what was directly observable during the placement, so a reader who was not part of the team can still follow the account in Chapter 2.",
          },
          photo(
            "placeholder-reception.jpg",
            "Reception area of the training establishment"
          ),
          {
            kind: "paragraph",
            text: "Understanding the establishment mattered for the placement itself. The work assigned to a trainee only makes sense once the shape of the product, the team that owns it, and the way the company measures quality are clear. The sections below set that context out before the training experience is described.",
          },
        ],
        children: [
          {
            blocks: [
              {
                items: [
                  ["Company name", "Acme Inc (Pvt) Limited"],
                  ["Registered address", "No. 42, Library Road, Colombo 07"],
                  ["Training location", "Acme Inc head office, Colombo 07"],
                  ["Website", "https://www.acme.example"],
                  ["Industry", "Enterprise software and managed services"],
                  ["Founded", "2009"],
                  ["Employees", "Approximately 240"],
                  ["Headquarters", "Colombo, Sri Lanka"],
                  ["Training role", "Software Engineering Intern"],
                  ["Supervisor", "Team Leader, Platform Engineering"],
                ],
                kind: "keyValue",
              },
              photo(
                "placeholder-building.jpg",
                "Head office building of the training establishment"
              ),
              {
                kind: "paragraph",
                text: "Acme Inc builds and maintains software for organisations that run their operations on documented, repeatable processes. Its customers are mid-sized companies in finance, logistics, and education, and its work falls into three broad areas: product development for its own platform, integration work that connects customer systems to that platform, and long-running maintenance of the software it has already delivered.",
              },
            ],
            children: [
              {
                blocks: [
                  {
                    kind: "paragraph",
                    text: "The business works best understood through its three revenue lines, because the placement sat inside the first of them while supporting the other two.",
                  },
                  {
                    items: [
                      "Product development: building the task, document, and reporting features of the Acme platform that customers use every day.",
                      "Integration services: connecting customer systems, such as accounting and payroll tools, to the platform so data moves without manual copying.",
                      "Managed maintenance: fixing defects, upgrading dependencies, and adapting delivered software as customer requirements change over the years.",
                    ],
                    kind: "list",
                    ordered: true,
                  },
                  chartOf(
                    {
                      categories: ["Product", "Integration", "Maintenance"],
                      kind: "pie",
                      slices: [
                        {
                          color: 0x2f_4f_6f,
                          label: "Product development",
                          value: 55,
                        },
                        {
                          color: 0x5c_7a_8a,
                          label: "Integration services",
                          value: 25,
                        },
                        {
                          color: 0x8a_9a_5c,
                          label: "Managed maintenance",
                          value: 20,
                        },
                      ],
                      title: "Acme Inc revenue mix",
                    },
                    "Acme Inc business areas by share of delivery effort"
                  ),
                ],
                title: "Nature of the Business",
              },
              {
                blocks: [
                  {
                    kind: "paragraph",
                    text: "The placement was in the platform engineering group, which owns the shared parts of the product rather than any single customer's screens. The chart shows how the engineering effort was distributed during the training period.",
                  },
                  chartOf(
                    {
                      categories: MONTH_SHORT,
                      kind: "bar",
                      series: [
                        {
                          color: 0x2f_4f_6f,
                          name: "Product features",
                          values: [3, 5, 7, 6, 8, 5],
                        },
                        {
                          color: 0x8a_9a_5c,
                          name: "Maintenance",
                          values: [4, 3, 3, 4, 3, 6],
                        },
                        {
                          color: 0x7a_5c_8a,
                          name: "Integration",
                          values: [1, 2, 2, 3, 2, 3],
                        },
                      ],
                      title: "Acme Inc work by month",
                    },
                    "Engineering effort by business area during the placement"
                  ),
                ],
                title: "Work Carried Out by the Engineering Teams",
              },
              {
                blocks: [
                  {
                    kind: "paragraph",
                    text: "The engineering organisation is divided into a product group and two support groups. A trainee is attached to one group and reports to that group's leader, who in turn reports to the head of engineering.",
                  },
                  chartOf(
                    {
                      kind: "orgTree",
                      title: "Acme Inc structure",
                      tree: {
                        children: [
                          {
                            children: [
                              {
                                children: [
                                  { children: [], label: "Task service" },
                                  { children: [], label: "Document service" },
                                ],
                                label: "Platform group",
                                role: "Engineering",
                              },
                              {
                                children: [
                                  { children: [], label: "Interface" },
                                  { children: [], label: "Reporting" },
                                ],
                                label: "Product group",
                                role: "Engineering",
                              },
                            ],
                            label: "Engineering",
                            role: "Head of Engineering",
                          },
                          {
                            children: [
                              { children: [], label: "Test automation" },
                              { children: [], label: "Release management" },
                            ],
                            label: "Quality assurance",
                            role: "Head of Quality",
                          },
                        ],
                        label: "Acme Inc",
                        role: "Chief Executive Officer",
                      },
                    },
                    "Engineering organisation at Acme Inc"
                  ),
                  photo(
                    "placeholder-team.jpg",
                    "Engineering team of the training establishment"
                  ),
                ],
                title: "Organisation Structure",
              },
            ],
            title: "About Acme Inc",
          },
          {
            blocks: [
              {
                kind: "paragraph",
                text: "The company works from a written plan that is reviewed each quarter. The parts of that plan that were visible during the placement are recorded here, and the rest is left out because a trainee cannot confirm it.",
              },
              {
                items: [
                  "Vision: to make documented operations simple enough that a small team can run them safely.",
                  "Mission: to build software that customers can rely on for years, not months, and to be honest when a limit is reached.",
                  "Goal: keep defect escape rate below two per thousand releases and keep each customer's average resolution time under one working day.",
                  "Objective: every customer change passes review and automated checks before it reaches production.",
                  "Objective: no customer data leaves the platform region without a written agreement.",
                ],
                kind: "bullets",
                marker: "dot",
              },
              {
                caption: "Company goals and how they are measured",
                columns: [
                  { header: "Goal", weight: 3 },
                  { header: "Measure", weight: 2 },
                  { header: "Frequency", weight: 1 },
                ],
                kind: "table",
                rows: [
                  [
                    "Fewer defects reach customers",
                    "Defects per thousand releases",
                    "Each release",
                  ],
                  ["Faster resolution", "Median days to resolve", "Weekly"],
                  [
                    "Safer changes",
                    "Share of changes with review and checks",
                    "Each change",
                  ],
                  [
                    "Data stays in region",
                    "Region boundary violations",
                    "Monthly",
                  ],
                ],
              },
            ],
            children: [
              {
                blocks: [
                  {
                    kind: "paragraph",
                    text: "Strategy at Acme Inc is expressed as a small number of choices rather than a long list. During the placement, three of them were visible in day-to-day work.",
                  },
                  {
                    items: [
                      "Invest in shared platform components instead of building the same feature separately for each customer.",
                      "Treat automation as part of the definition of done, so a change that cannot be checked automatically is not finished.",
                      "Keep the number of technologies small, because every new tool adds support cost for the whole company.",
                    ],
                    kind: "list",
                    ordered: true,
                  },
                ],
                title: "Strategic Planning",
              },
            ],
            title: "Corporate Plan",
          },
          {
            blocks: [
              {
                kind: "paragraph",
                text: "This section records how the company runs its people, because the placement depended on these practices as much as on the software did.",
              },
            ],
            children: [
              {
                blocks: [
                  {
                    kind: "paragraph",
                    text: "The company recruits engineers through a written process: a role description, a technical conversation about past work, a practical exercise drawn from real problems, and a final conversation with the hiring manager. Interns and new graduates follow the same exercise as experienced candidates, which is why the placement started with a small feature rather than observation.",
                  },
                  {
                    items: [
                      "Role description published with the vacancy",
                      "Screening conversation about past work",
                      "Practical exercise reviewed by two engineers",
                      "Manager conversation covering expectations and support",
                      "Offer with a written six-month plan for interns",
                    ],
                    kind: "list",
                    ordered: true,
                  },
                  {
                    items: [
                      "Two weeks, with the first week reserved for equipment, access, and reading.",
                      "A named supervisor for the whole placement, not only for the first month.",
                      "Weekly one-to-one meetings, kept even when there is nothing to report.",
                      "Access to the same review practice as permanent engineers, from the first change.",
                    ],
                    kind: "bullets",
                    marker: "arrow",
                  },
                ],
                title: "Recruitment and Onboarding",
              },
              {
                blocks: [
                  {
                    kind: "paragraph",
                    text: "The delivery process the placement followed is shown below. Each stage has an owner and an output, which is what makes a delay visible rather than personal.",
                  },
                  chartOf(
                    {
                      kind: "flow",
                      steps: [
                        {
                          detail: "Story written with the product owner",
                          label: "Requirement",
                        },
                        {
                          detail: "Screen sketch and data shape agreed",
                          label: "Design",
                        },
                        {
                          detail: "Service and interface written together",
                          label: "Build",
                        },
                        {
                          detail: "Review, checks, and manual pass",
                          label: "Verify",
                        },
                        {
                          detail: "Merge, deploy, and watch the logs",
                          label: "Release",
                        },
                      ],
                      title: "Delivery flow",
                    },
                    "Delivery flow followed at Acme Inc"
                  ),
                  chartOf(
                    {
                      kind: "layers",
                      layers: [
                        {
                          items: [
                            "Task screens",
                            "Document screens",
                            "Report screens",
                          ],
                          name: "Interface",
                        },
                        {
                          items: [
                            "Task service",
                            "Document service",
                            "Report service",
                          ],
                          name: "Services",
                        },
                        {
                          items: ["PostgreSQL", "Object storage", "Audit log"],
                          name: "Data",
                        },
                      ],
                      title: "Acme Inc layers",
                    },
                    "Layers of the Acme platform as encountered during the placement"
                  ),
                  {
                    kind: "paragraph",
                    text: "Work moved through short cycles of about two weeks. At the start of each cycle the team agreed what would be built; at the end, the change was demonstrated and the checklist results were shared. A change that could not be demonstrated was carried into the next cycle rather than rushed.",
                  },
                ],
                title: "Development and Review Practice",
              },
              {
                blocks: [
                  {
                    kind: "paragraph",
                    text: "The platform is organised in three layers, and a defect usually belongs to the boundary between two of them. Knowing the layers made most of the problems in Chapter 2 easier to locate.",
                  },
                  {
                    caption: "Layer responsibilities",
                    columns: [
                      { header: "Layer", weight: 1 },
                      { header: "Owns", weight: 3 },
                      { header: "Does not own", weight: 2 },
                    ],
                    kind: "table",
                    rows: [
                      [
                        "Interface",
                        "Rendering, input handling, accessibility",
                        "Business rules",
                      ],
                      [
                        "Services",
                        "Business rules, validation, permissions",
                        "Visual layout",
                      ],
                      [
                        "Data",
                        "Storage, indexes, migrations",
                        "User-facing behaviour",
                      ],
                    ],
                  },
                ],
                title: "Technical Practices and Standards",
              },
              {
                blocks: [
                  {
                    kind: "paragraph",
                    text: "The attendance and leave rules that applied during the placement are recorded here as they were explained to trainees. The totals in this table are the trainee's own record; the official totals remain with the university and the authority.",
                  },
                  {
                    caption: "Leave and attendance during the placement",
                    columns: [
                      { header: "Type", weight: 2 },
                      { header: "Entitlement", weight: 2 },
                      { header: "Taken", weight: 1 },
                    ],
                    kind: "table",
                    rows: [
                      ["Annual leave", "14 days per year", "4 days"],
                      ["Casual leave", "Up to 2 days at a time", "2 days"],
                      [
                        "Medical leave",
                        "From the second day, with a certificate",
                        "0 days",
                      ],
                      [
                        "Sick leave",
                        "From the first day, with a certificate",
                        "3 days",
                      ],
                      [
                        "Training days",
                        "As scheduled by the university",
                        "6 days",
                      ],
                    ],
                  },
                  {
                    kind: "paragraph",
                    text: "Leave is requested in advance through the internal system and approved by the supervisor. A medical certificate is required from the second day of absence, and the record is filed with human resources rather than with the team.",
                  },
                ],
                title: "Leave, Attendance, and Working Hours",
              },
              {
                blocks: [
                  {
                    items: [
                      "Health and safety: a first-aid trained officer is present on every floor, accidents and near misses are reported the same day, and each floor has a posted evacuation plan.",
                      "Identity and access: an identity card is worn at all times in the building, and access to systems is granted per person and reviewed every quarter.",
                      "Information handling: customer data stays inside approved systems, credentials are never shared, and printed customer lists are collected after use.",
                      "Equipment: laptops are provided and remain company property, and loss must be reported on the day it is noticed.",
                      "Conduct: colleagues are expected to treat each other with respect, and concerns can be raised with a manager, with human resources, or through the confidential line.",
                    ],
                    kind: "bullets",
                    marker: "dot",
                  },
                ],
                title: "Health, Safety, and Security",
              },
            ],
            title: "Management Practices",
          },
        ],
        introTitle: "Introduction",
        title: "Training Organization",
      },
      {
        blocks: [
          {
            kind: "paragraph",
            text: "This chapter describes the training itself: how the placement was arranged, what was learned before any feature was assigned, the work that was carried out over the six months, the problems that arose and how they were solved, what was achieved, and the events that formed part of the placement. Each work stream in section 2.4 is written to explain what changed and why it mattered, not to list changes one after another.",
          },
          chartOf(
            {
              kind: "timeline",
              milestones: [
                {
                  label: "Access, environment, and reading",
                  period: MONTHS[0],
                },
                { label: "Task list and search", period: MONTHS[1] },
                { label: "Permissions and layout", period: MONTHS[2] },
                { label: "Documents and export", period: MONTHS[3] },
                { label: "Recruitment and dashboards", period: MONTHS[4] },
                { label: "Handover", period: MONTHS[5] },
              ],
              title: "Placement timeline",
            },
            "How the six months of training were organised"
          ),
        ],
        children: [
          {
            blocks: [
              {
                kind: "paragraph",
                text: "The placement began with an interview in January and started on 16 February 2026. The first two weeks were deliberately quiet: equipment, access, and reading the existing service and interface before writing anything. The supervisor explained which parts of the platform were owned by which team and where the test coverage was thin, and the trainee was asked to reproduce three known behaviours of the task list before changing any of them.",
              },
              {
                items: [
                  "Week 1: equipment, accounts, repository access, and a first run of the local environment.",
                  "Week 2: reading the task service and the task screens, and reproducing three known behaviours.",
                  "Week 3: first small change, taken through the full review process.",
                  "Week 4 onwards: a work stream of increasing size, each one reviewed and demonstrated.",
                ],
                kind: "bullets",
                marker: "arrow",
              },
              photo(
                "placeholder-workspace.jpg",
                "Open workspace where the trainee was based"
              ),
              {
                kind: "paragraph",
                text: "The first change was deliberately small: showing the due date on the task list in a form that matched the rest of the interface. It was small enough to be finished in two days, which made the review process itself the thing to learn.",
              },
            ],
            title: "Introduction to the Placement",
          },
          {
            blocks: [
              {
                kind: "paragraph",
                text: "Before being given a work stream, the trainee was expected to explain how the existing system worked. Four areas were covered, and each is described here with the specific question it answered.",
              },
            ],
            children: [
              {
                blocks: [
                  {
                    kind: "paragraph",
                    text: "Acme Inc runs work in cycles of about two weeks. At the start of a cycle the team agrees the goal and the list of work; during the cycle the goal stays fixed while the list may change; at the end the change is demonstrated and the result is recorded. The reason it matters for a trainee is that a review comment is about the change in front of the reviewer, not about the person who wrote it.",
                  },
                  {
                    items: [
                      "A cycle goal that is small enough to finish, stated in one sentence.",
                      "Work added to a cycle only if the goal is still reachable.",
                      "A demonstration at the end, with the checklist results shown.",
                      "A short written note on what went wrong, kept with the change.",
                    ],
                    kind: "bullets",
                    marker: "dot",
                  },
                ],
                title: "How Work Is Planned and Reviewed",
              },
              {
                blocks: [
                  {
                    kind: "paragraph",
                    text: "The platform is a set of services behind a single interface. A request from a screen reaches one service, which may read from the database, may write a file to object storage, and may record an entry in the audit log. Understanding which service owns which decision was the single most useful thing learned in the first month.",
                  },
                  {
                    caption: "Request path for a saved task",
                    columns: [
                      { header: "Step", weight: 1 },
                      { header: "Component", weight: 2 },
                      { header: "Responsibility", weight: 3 },
                    ],
                    kind: "table",
                    rows: [
                      [
                        "1",
                        "Task screen",
                        "Validate the form and show progress",
                      ],
                      [
                        "2",
                        "Task service",
                        "Apply the business rule and check permission",
                      ],
                      ["3", "Database", "Store the task and its history"],
                      ["4", "Object storage", "Store attachments when present"],
                      ["5", "Audit log", "Record who changed what and when"],
                    ],
                  },
                ],
                title: "Architecture of the Acme Platform",
              },
              {
                blocks: [
                  {
                    kind: "paragraph",
                    text: "Several tools appear repeatedly in the work described in section 2.4. They are listed here with what each one was actually used for, rather than with a general description of the tool.",
                  },
                ],
                children: [
                  {
                    blocks: [
                      {
                        kind: "paragraph",
                        text: "TypeScript was used on both sides of the wire. The value was not the type system in the abstract but the shared shapes: a screen and the service that answered it agreed on the same definition, so a renamed field became a compile error instead of a blank value at runtime. During the placement, four defects in section 2.4 were found this way, because a renamed field stopped the build rather than reaching a customer.",
                      },
                    ],
                    title: "TypeScript and Shared Types",
                  },
                  {
                    blocks: [
                      {
                        kind: "paragraph",
                        text: "Vitest covered the service rules and Playwright covered the screen behaviour. The split mattered because the failures they catch are different: a service test fails when a rule is wrong, and a screen test fails when the interface does something the user cannot see. Writing both for the same feature was the habit that made the release checklist in section 2.4.6 short.",
                      },
                    ],
                    title: "Automated Checking",
                  },
                  {
                    blocks: [
                      {
                        kind: "paragraph",
                        text: "Changes were proposed through a pull request with a description that said what changed and why. The reviewer checked the description first, then the code, and asked for a demonstration when the change altered behaviour a user could notice. A change that could not be explained in three sentences was usually a change that was doing too much, and it was split.",
                      },
                    ],
                    title: "Version Control and Review",
                  },
                ],
                title: "Tools Used During the Training",
              },
            ],
            title: "Learning Period",
          },
          {
            blocks: [
              {
                kind: "paragraph",
                text: "The work described in this section is grouped into six streams rather than listed week by week, because a week-by-week list reads as an activity log and says nothing about the shape of the work. Each stream explains the goal, what was built, how it was checked, and what it changed for the people using the product. The figures inside a stream sit next to the text that explains them.",
              },
              chartOf(
                {
                  categories: MONTH_SHORT,
                  kind: "stackedBar",
                  series: [
                    {
                      color: 0x2f_4f_6f,
                      name: "Interface",
                      values: [2, 4, 5, 3, 6, 3],
                    },
                    {
                      color: 0x5c_7a_8a,
                      name: "Service",
                      values: [3, 4, 3, 5, 4, 2],
                    },
                    {
                      color: 0x8a_9a_5c,
                      name: "Checks",
                      values: [1, 2, 3, 3, 2, 2],
                    },
                    {
                      color: 0x7a_5c_8a,
                      name: "Documentation",
                      values: [0, 1, 1, 2, 1, 2],
                    },
                  ],
                  title: "Work by stream",
                },
                "Share of the training period spent in each work stream"
              ),
            ],
            children: [
              {
                blocks: [
                  {
                    kind: "paragraph",
                    text: "The task list is the screen users open most often, and it was the first stream assigned because it is small in surface area and deep in behaviour. The goal was to let a user find a task without reading the whole list.",
                  },
                  {
                    items: [
                      "Search across the task title and reference with a single input.",
                      "A clear control that removes the search and restores the full list.",
                      "An empty result that says what was searched for and offers to clear it.",
                      "The filter preserved in the address so a filtered list can be shared.",
                    ],
                    kind: "bullets",
                    marker: "arrow",
                  },
                  {
                    kind: "paragraph",
                    text: "The empty result was the part that took longest. The first version showed the words no results found with no way forward, and the review comment was that a user who has typed something is looking for a way out, not for confirmation that nothing exists. The second version named the search and offered to clear it.",
                  },
                  photo(
                    "placeholder-workstation.jpg",
                    "Development workstation used during the placement"
                  ),
                  {
                    caption: "Search behaviour covered by the checks",
                    columns: [
                      { header: "Case", weight: 2 },
                      { header: "Expected result", weight: 3 },
                      { header: "Check", weight: 1 },
                    ],
                    kind: "table",
                    rows: [
                      [
                        "Title matches",
                        "Matching tasks listed",
                        "Service and screen",
                      ],
                      ["No match", "Empty result names the search", "Screen"],
                      [
                        "Search cleared",
                        "Full list returns",
                        "Service and screen",
                      ],
                      [
                        "Filter in address",
                        "List reopens filtered after reload",
                        "Screen",
                      ],
                    ],
                  },
                ],
                title: "Task List and Search",
              },
              {
                blocks: [
                  {
                    kind: "paragraph",
                    text: "Permissions had been checked in the service but not consistently in the interface, so a user without access to a project could still see its name in a dropdown. The stream made the check happen in one place and made the interface ask the service rather than guess.",
                  },
                  {
                    items: [
                      "A single service call that answers what the current user may do, used by every screen that needs it.",
                      "Dropdowns filtered by that answer instead of by a client-side guess.",
                      "A denied action explained in the interface instead of failing silently.",
                      "A screen check added for the case where permission is withdrawn while a page is open.",
                    ],
                    kind: "bullets",
                    marker: "arrow",
                  },
                  {
                    kind: "paragraph",
                    text: "The subtle case was a page left open after permission was withdrawn. The screen was rendered before the change, so the data was already in the browser. The fix was to re-check on the action rather than only on the page load, and it is recorded here because it changed how the rest of the team thought about cached permission data.",
                  },
                ],
                title: "Permissions and Role Boundaries",
              },
              {
                blocks: [
                  {
                    kind: "paragraph",
                    text: "The document stream was the largest single piece of work in the placement. Users could upload, preview, and finally export documents, and the export produced a different result from the preview in three separate ways, which made it the most reported problem of the period.",
                  },
                  {
                    items: [
                      "Upload with a size and type check before anything is stored.",
                      "Preview that matches the export byte for byte in the printed layout.",
                      "Export generated once and stored, so two users receive the same file.",
                      "A recorded entry in the audit log for every export, with the user and the time.",
                    ],
                    kind: "bullets",
                    marker: "arrow",
                  },
                  photo(
                    "placeholder-export.jpg",
                    "Document export preview compared against the printed layout"
                  ),
                  {
                    kind: "paragraph",
                    text: "The export was rebuilt around a single description of the document that both the preview and the printed file read from. Before the change each had its own layout rules, which is why a document could look correct on screen and print with a missing footer. After the change there was one place where a rule could be wrong, and it was covered by checks.",
                  },
                  {
                    caption:
                      "Differences found between the preview and the export",
                    columns: [
                      { header: "Difference", weight: 3 },
                      { header: "Cause", weight: 3 },
                      { header: "Status after the change", weight: 2 },
                    ],
                    kind: "table",
                    rows: [
                      [
                        "Missing footer on the printed file",
                        "Two separate layout descriptions",
                        "One shared description",
                      ],
                      [
                        "Page breaks in the wrong place",
                        "Table height measured in the preview only",
                        "Measured once for both",
                      ],
                      [
                        "Images scaled differently",
                        "Two different width limits",
                        "Single width limit",
                      ],
                    ],
                  },
                ],
                title: "Document Upload, Preview, and Export",
              },
              {
                blocks: [
                  {
                    kind: "paragraph",
                    text: "The recruitment pipeline was the first stream owned end to end, from the form a candidate arrives on to the board a recruiter reviews. It was chosen because it touches the interface, the service, the data, and permissions at once.",
                  },
                  {
                    items: [
                      "A candidate form that reports a problem on the field that caused it.",
                      "A pipeline board where a card shows the stage, the age in that stage, and the owner.",
                      "A stale-stage warning, because a card sitting in one stage for a month is usually a forgotten one.",
                      "An export for the weekly review meeting, generated from the same data as the board.",
                    ],
                    kind: "bullets",
                    marker: "arrow",
                  },
                  photo(
                    "placeholder-pipeline.jpg",
                    "Recruitment pipeline board used in the weekly review"
                  ),
                  chartOf(
                    {
                      categories: ["Applied", "Screen", "Interview", "Offer"],
                      kind: "bar",
                      series: [
                        {
                          color: 0x2f_4f_6f,
                          name: "This month",
                          values: [48, 22, 11, 4],
                        },
                        {
                          color: 0x8a_9a_5c,
                          name: "Previous month",
                          values: [39, 20, 9, 3],
                        },
                      ],
                      title: "Pipeline",
                    },
                    "Recruitment pipeline by stage for the placement period"
                  ),
                ],
                title: "Recruitment Pipeline",
              },
              {
                blocks: [
                  {
                    kind: "paragraph",
                    text: "The reporting work produced the dashboards used in the weekly review. The requirement was simple to state and awkward to satisfy: show the same numbers as the operational screens, and let a reader go from a total to the records behind it.",
                  },
                  {
                    items: [
                      "Every total computed from the same service that serves the operational screens.",
                      "A drill-down from a total to the records that produced it, not to a separate export.",
                      "A visible note on figures that are less than a day old.",
                      "A layout that works on a laptop and on a wall display.",
                    ],
                    kind: "bullets",
                    marker: "arrow",
                  },
                  photo(
                    "placeholder-dashboard.jpg",
                    "Reporting dashboard shown during the weekly review"
                  ),
                  {
                    kind: "paragraph",
                    text: "The mistake worth recording was building the dashboard from a separate reporting query for speed. It produced a total that disagreed with the operational screen by a small amount, and because the two were computed differently nobody could say which was right. Rebuilding it on the operational service removed the disagreement and made the dashboard slightly slower, which was the correct trade.",
                  },
                ],
                title: "Dashboards and Reporting",
              },
              {
                blocks: [
                  {
                    kind: "paragraph",
                    text: "The final stream was the release preparation and handover. The purpose was to leave the work in a state another engineer could pick up without asking questions, which is the practical test of whether the previous five streams were done properly.",
                  },
                  {
                    items: [
                      "A written note for each stream describing what it changed and what it deliberately did not.",
                      "Screen and service checks running together as one command.",
                      "A list of known gaps with the reason each one was still open.",
                      "A demonstration of the whole feature set to the team and the supervisor.",
                    ],
                    kind: "bullets",
                    marker: "arrow",
                  },
                  {
                    caption: "Known gaps left open at the end of the placement",
                    columns: [
                      { header: "Gap", weight: 3 },
                      { header: "Reason", weight: 3 },
                      { header: "Suggested owner", weight: 2 },
                    ],
                    kind: "table",
                    rows: [
                      [
                        "Bulk actions on the task list",
                        "Not needed by any current customer",
                        "Product team",
                      ],
                      [
                        "Export of the full audit log",
                        "Requires a retention decision",
                        "Operations",
                      ],
                      [
                        "Second chart type on the dashboard",
                        "Waiting on the reporting library upgrade",
                        "Reporting team",
                      ],
                    ],
                  },
                ],
                title: "Release Preparation and Handover",
              },
            ],
            title: "Assigned Tasks",
          },
          {
            blocks: [
              {
                kind: "paragraph",
                text: "The problems below are the ones that actually occurred, with the cause that was found and the change that fixed it. They are written as a pair: a problem without its cause teaches nothing, and a fix without its cause cannot be repeated.",
              },
            ],
            children: [
              {
                blocks: [
                  {
                    caption: "Problems encountered and how they were solved",
                    columns: [
                      { header: "Problem", weight: 3 },
                      { header: "Cause", weight: 3 },
                      { header: "Solution", weight: 3 },
                    ],
                    kind: "table",
                    rows: [
                      [
                        "Filtered task list stayed empty after the search was cleared",
                        "The filter was applied when the list loaded but not when it was removed",
                        "The clear action now reloads through the same path as the search",
                      ],
                      [
                        "A dropdown listed projects the user could not open",
                        "The list was filtered in the interface from data fetched before the check",
                        "The service now answers what the user may see and the interface uses that",
                      ],
                      [
                        "Printed documents lost the footer",
                        "Preview and export each had their own layout description",
                        "Both read one shared description of the document",
                      ],
                      [
                        "Dashboard totals disagreed with the operational screens",
                        "A separate reporting query computed them differently",
                        "The dashboard now reads the operational service",
                      ],
                      [
                        "A renamed field reached a screen as an empty value",
                        "The screen and the service did not share a type for that response",
                        "The response shape is now defined once and imported by both",
                      ],
                      [
                        "Two users received different exports of the same document",
                        "The file was generated per request instead of once per version",
                        "Exports are generated on change and stored",
                      ],
                    ],
                  },
                  {
                    kind: "paragraph",
                    text: "Every one of these six problems shared a shape: two places believed they owned the same decision. That is the single most useful thing the placement taught, and it is the reason the later work kept moving decisions to a single owner rather than adding a check in each place.",
                  },
                ],
                title: "Problems Encountered",
              },
            ],
            title: "Problems and Solutions",
          },
          {
            blocks: [
              {
                kind: "paragraph",
                text: "The achievements in this section are limited to work that was completed and can be pointed at. Learning that has not been applied yet belongs in section 2.7, not here.",
              },
              {
                items: [
                  "Search and filtering added to the task list, with the empty case designed rather than left to chance.",
                  "Permissions resolved in one place and used by every screen, closing a class of access mistakes rather than one instance.",
                  "The document preview and export brought into agreement, removing the most reported problem of the period.",
                  "A recruitment pipeline owned from the candidate form to the review board.",
                  "A reporting dashboard built on the same service as the operational screens, so the two cannot disagree.",
                  "Screen and service checks running as one command, making the release checklist short enough to always be run.",
                  "A written handover for each stream, with the open gaps and their reasons.",
                ],
                kind: "bullets",
                marker: "dot",
              },
              chartOf(
                {
                  categories: [
                    "Search",
                    "Permissions",
                    "Documents",
                    "Pipeline",
                    "Reporting",
                    "Handover",
                  ],
                  kind: "bar",
                  series: [
                    {
                      color: 0x2f_4f_6f,
                      name: "Checks added",
                      values: [11, 9, 22, 9, 11, 6],
                    },
                    {
                      color: 0x8a_5c_5c,
                      name: "Problems closed",
                      values: [3, 4, 5, 3, 3, 2],
                    },
                  ],
                  title: "Achievements",
                },
                "Checks and closed problems per work stream"
              ),
            ],
            title: "Achievements",
          },
          {
            blocks: [
              {
                kind: "paragraph",
                text: "The placement included non-technical experience that formed part of the working environment. These are recorded as they happened.",
              },
              {
                items: [
                  "A weekly engineering meeting in which each team reports progress and blockers, which is where a blocked change is noticed early.",
                  "A code reading session held by the supervisor on a change written by another engineer, chosen because it solved a problem in a way the trainee had not considered.",
                  "A health and safety briefing and a fire drill, both attended as part of joining the floor.",
                  "An intern day in the last month, in which each trainee presented the work they had done to the engineering group and answered questions.",
                ],
                kind: "bullets",
                marker: "arrow",
              },
              photo("placeholder-event.jpg", "Intern day presentations"),
            ],
            title: "Events Involved",
          },
          {
            blocks: [
              {
                kind: "paragraph",
                text: "This section records what was learned that has not yet been applied, and what would be done differently. It is deliberately separate from section 2.6, which lists completed work, because an intention recorded as an achievement is the easiest way for a report to become inaccurate.",
              },
              {
                items: [
                  "A change should be described in terms of the user before it is described in terms of the code, because the description is what the reviewer reads first.",
                  "Edge cases belong in the check list at the moment the change is written, not at the end when the context has been lost.",
                  "Ownership of a decision should be settled when the feature is designed; two teams that both believe they own a rule will disagree in production.",
                  "Small changes are cheaper than large ones, including the review time, which is not obvious until several large changes are reviewed in one week.",
                  "Documentation written during the work is faster and more accurate than documentation written afterwards.",
                ],
                kind: "bullets",
                marker: "dot",
              },
            ],
            title: "Learning and Improvements for Future Work",
          },
        ],
        introTitle: "Introduction",
        title: "Training Experience at Acme Inc",
      },
      {
        blocks: [
          {
            kind: "paragraph",
            text: "This chapter closes the report. It summarises what the six months produced, sets out a self-assessment of the placement, and records what would be done differently or continued after the placement ends.",
          },
        ],
        children: [
          {
            blocks: [
              {
                kind: "paragraph",
                text: "The training began quietly, with two weeks of access, reading, and reproducing known behaviour, and that start turned out to matter more than expected. Almost every problem in section 2.5 was caused by a decision that two places believed they owned, and the first month was spent learning where those places were. Once that map existed, the later streams moved quickly.",
              },
              {
                kind: "paragraph",
                text: "The most useful habit formed during the placement was writing the user-facing description of a change before touching the code. It is a small discipline, and on several occasions it exposed that the change being made did not answer the question that had been asked.",
              },
              {
                kind: "paragraph",
                text: "The work delivered is listed in section 2.6 and is modest in size, but each item is complete: it is in the product, it is covered by checks, and it is written up well enough for someone else to continue. That completeness, rather than the number of features, is the part of the placement that transfers directly to future work.",
              },
            ],
            title: "Conclusion of the Report",
          },
          {
            blocks: [
              {
                kind: "paragraph",
                text: "This assessment is of the trainee's own position at the end of the placement, and it is written to be useful rather than flattering. A self-assessment that claims no weaknesses cannot be acted on.",
              },
            ],
            children: [
              {
                blocks: [
                  {
                    items: [
                      "Asking which part of a problem belongs to which team before starting, instead of after being stuck.",
                      "Finishing a small change properly rather than starting a large one.",
                      "Saying that something is unclear early, because a question in the first day costs less than a rewrite in the third week.",
                      "Writing down what was done while it is still fresh.",
                      "Treating review comments as information about the change, not as a verdict.",
                    ],
                    kind: "bullets",
                    marker: "dot",
                  },
                ],
                title: "Strengths",
              },
              {
                blocks: [
                  {
                    items: [
                      "Estimated time was optimistic in the first two streams, which pushed checks into the following week.",
                      "Edge cases were often added after the change rather than during it.",
                      "Asking for help came later than it should have, usually after an afternoon lost to a problem that a five-minute question would have solved.",
                      "Documentation was the first thing dropped when a stream grew.",
                      "Reading unfamiliar code was slow at the start, which made early estimates unreliable.",
                    ],
                    kind: "bullets",
                    marker: "dot",
                  },
                ],
                title: "Weaknesses",
              },
              {
                blocks: [
                  {
                    items: [
                      "Backend work with a real database and real query cost, rather than a schema designed around one use.",
                      "Deployment and monitoring in an environment shared with other engineers, where a bad change is visible immediately.",
                      "Deeper work on accessibility and on the parts of the interface that are hardest to test with a script.",
                      "Writing tests for code that was not written for testing, which is where understanding an unfamiliar system really shows.",
                    ],
                    kind: "bullets",
                    marker: "dot",
                  },
                ],
                title: "Opportunities",
              },
              {
                blocks: [
                  {
                    items: [
                      "A change spread across three layers can reach production even when each layer's own check passes.",
                      "Two teams can own one rule without noticing, and the disagreement appears as a defect rather than as a design question.",
                      "A preview and an export that look identical can behave differently, because they are two implementations of one description.",
                      "Optimistic estimates quietly move the checks to the end, and the checks are the part that gets dropped first.",
                    ],
                    kind: "bullets",
                    marker: "dot",
                  },
                ],
                title: "Threats to Development",
              },
            ],
            title: "Personal SWOT Analysis",
          },
          {
            blocks: [
              {
                kind: "paragraph",
                text: "The suggestions below are directed at the work rather than at the trainee, because most of what was learned is a property of how the system is built.",
              },
              {
                items: [
                  "Record the owner of each business rule in one place, so two teams cannot both believe they own it.",
                  "Keep edge cases in the same file as the check, so they are written with the change instead of after it.",
                  "Add an accessibility pass to the definition of done rather than treating it as a separate task.",
                  "Share a short weekly note on what is in progress, which reduces the time lost to duplicated effort.",
                  "Cover shared components with checks at the level of the interface, since that is the level a customer experiences.",
                ],
                kind: "list",
                ordered: true,
              },
              {
                kind: "paragraph",
                text: "For the trainee, the continuation is to keep backend and deployment practice, to write before coding, and to ask earlier. The placement covered six months of an industry that takes considerably longer to understand, and the useful outcome is a map and a set of habits rather than a finished body of knowledge.",
              },
            ],
            title: "Suggestions for Improvement",
          },
        ],
        introTitle: "Introduction",
        title: "Conclusion",
      },
    ],
    cover: {
      category: "Undergraduate",
      course: "Bachelor of Information Technology",
      establishment: "Acme Inc (Pvt) Limited",
      establishmentAddress: "No. 42, Library Road, Colombo 07",
      field: "Software Engineering",
      institute: "University of Colombo",
      naitaRegistration: "NAITA/SIT/EXAMPLE/2026",
      name: "A. N. Trainee",
      studentNumber: "IT/00/0000",
      trainingEnd: "2026-08-16",
      trainingLocation: "Colombo 07",
      trainingStart: "2026-02-16",
    },
    preface: [
      "An internship is a step between a degree and a working life. The purpose of the Industrial Training Report is to meet one of the requirements of the Department of Information and Communication Technology, Faculty of Computing, University of Colombo, and to record what was actually done during the placement rather than what was intended.",
      "The National Apprenticeship and Industrial Training Authority runs the Industrial Training Scheme, which places students with approved establishments for six months and monitors their development against a written plan. This report covers the placement at Acme Inc (Pvt) Limited from 16 February 2026 to 16 August 2026 as a Software Engineering Intern.",
      "The report is in three chapters. The first describes the training establishment, its business, its organisation, and its working practices, so that the work described later can be read in context. The second covers the training experience: the arrangement of the placement, what was learned before any feature was assigned, the six work streams that were carried out, the problems that arose and how they were solved, what was completed, and the events that formed part of the placement. The third closes the report with a summary, a self-assessment, and suggestions.",
      "This document is a sample. Acme Inc (Pvt) Limited is a fictional establishment, and its staff, addresses, numbers, and work are invented to show the shape of a report and the standard of writing expected in one. The photographs are unrelated placeholder images that show where a photograph of the establishment, a screen, or an event belongs. A student replaces every one of them with an approved photograph of their own placement, and replaces every invented fact with a verified one, or the report is not ready to submit.",
    ],
    references: [
      {
        author: "Acme Inc",
        detail: "Corporate information, Colombo.",
        title: "About Acme Inc",
        url: "https://www.acme.example",
      },
      {
        author: "NAITA",
        detail: "Industrial Training Scheme, Colombo.",
        title: "Industrial Training Guidelines",
        url: "https://www.naita.gov.lk",
      },
      {
        author: "University of Colombo",
        detail: "Faculty of Computing, Department of ICT, curriculum document.",
        title: "Industrial Training Report Requirements",
        url: "https://www.cmt.ac.lk",
      },
      {
        author: "TypeScript Handbook",
        detail: "TypeScript documentation.",
        title: "Types and Interfaces",
        url: "https://www.typescriptlang.org/docs/",
      },
      {
        author: "Vitest",
        detail: "Vitest documentation.",
        title: "Unit Testing with Vitest",
        url: "https://vitest.dev",
      },
      {
        author: "Playwright",
        detail: "Playwright documentation.",
        title: "End-to-End Testing",
        url: "https://playwright.dev",
      },
      {
        author: "PostgreSQL",
        detail: "PostgreSQL documentation.",
        title: "Indexes and Query Planning",
        url: "https://www.postgresql.org/docs",
      },
    ],
    title: "Report on Industrial Training",
  };
};

export const templateImages = () => IMAGES;

export const buildTemplateReport = async (outputPath, options = {}) => {
  const cacheFolder = options.cacheFolder
    ? path.resolve(options.cacheFolder)
    : path.resolve("local/report/cache/images");
  const images = await fetchImages(cacheFolder, IMAGES);
  const document = buildTemplateDocument(images);
  return await renderReportDocument(document, outputPath, options);
};
