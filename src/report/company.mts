/**
 * Researches a training establishment from public sources and stores the
 * result in the workspace, so the student does not have to type what is already
 * published.
 *
 * The command never invents a fact. Every field carries the URL it came from and
 * the date it was read, and a field that could not be confirmed from a public
 * source stays empty and is reported as a question for the student. The stored
 * record is a draft for the report, not a verified fact: the student and the
 * supervisor still check anything that will be submitted.
 *
 * The search runs through the same installed writing agent the diary uses, so
 * there is no extra service to configure and no network call from this module
 * other than through the agent the user chose.
 */

import path from "node:path";

import { runAgent } from "../ai/runner.mts";
import { readJson, writeJson } from "../diary/files.mts";
import { paths } from "../diary/paths.mts";

export const COMPANY_FIELDS = [
  { key: "name", label: "Registered company name" },
  { key: "tradingName", label: "Name used in day-to-day work" },
  { key: "industry", label: "Industry or sector" },
  { key: "business", label: "What the company actually does" },
  { key: "products", label: "Products, platforms, or services" },
  { key: "founded", label: "Year founded" },
  { key: "employees", label: "Approximate employee count" },
  { key: "headquarters", label: "Headquarters" },
  { key: "address", label: "Address of the training location" },
  { key: "phone", label: "Telephone" },
  { key: "email", label: "General contact email" },
  { key: "website", label: "Website" },
  { key: "linkedin", label: "LinkedIn or other public profile" },
  { key: "parentCompany", label: "Parent or group company" },
  { key: "registration", label: "Company registration number" },
  { key: "clients", label: "Types of customers served" },
  { key: "vision", label: "Published vision or mission" },
  { key: "values", label: "Published values" },
  { key: "departments", label: "Departments or teams, if published" },
  { key: "technologies", label: "Technologies the company states it uses" },
];

/** Only these keys are stored, so agent output cannot write arbitrary fields. */
const FIELD_KEYS = new Set(COMPANY_FIELDS.map((field) => field.key));

/**
 * Agent output is untyped JSON, so this is the one place that turns it into
 * strings. Everything downstream branches on the parsed domain value rather than
 * on its representation, which is why a finding is read exactly once here.
 */
const clean = (value) =>
  String(value ?? "")
    .replaceAll(/\s+/gu, " ")
    .trim();

/** Normalises one untyped finding into the three strings the checks need. */
const asFinding = (finding) => ({
  key: clean(finding?.key),
  url: clean(finding?.url),
  value: clean(finding?.value),
});

export const companyPath = (workspace) =>
  path.join(paths(workspace).local, "report", "company", "company.json");

const isPublicUrl = (value) => /^https?:\/\/[^\s]+$/iu.test(value);

/**
 * Keeps only entries whose field is known, whose value is a non-empty string,
 * and whose source is a real URL. An entry without a source is dropped rather
 * than kept with an empty citation, because an uncited claim cannot be checked
 * later.
 */
export const sanitizeFindings = (findings) => {
  const kept = [];
  const rejected = [];
  for (const finding of Array.isArray(findings) ? findings : []) {
    const { key, url, value } = asFinding(finding);
    if (!FIELD_KEYS.has(key)) {
      rejected.push(`${key || "(no key)"}: not a known field`);
      continue;
    }
    if (!value) {
      rejected.push(`${key}: empty value`);
      continue;
    }
    if (!isPublicUrl(url)) {
      rejected.push(`${key}: no public source URL`);
      continue;
    }
    kept.push({ key, url, value });
  }
  return { kept, rejected };
};

export const companyPrompt = (
  name,
  existing
) => `Research the company "${name}" using public sources and return JSON only:
{"findings":[{"key":"name","value":"...","url":"https://..."}]}

Field keys, one per finding, each used at most once:
${COMPANY_FIELDS.map((field) => `- ${field.key}: ${field.label}`).join("\n")}

Rules:
- Search the web. Prefer the company's own website, then its official public profiles, then a reputable business directory or news article.
- Every finding must carry the exact URL you read it from. A value you cannot cite is not a finding; leave it out.
- Report only what the source states. Do not infer employee counts, revenue, or department structure.
- Do not guess. A missing field is correct; an invented field is worse than an empty one.
- Keep each value to one short sentence or a few words. It will be printed in a report.
- Do not record personal data about named individuals. No names, no email addresses of individuals, no phone numbers of individuals.
- If the company is too small or too private to be documented publicly, return an empty findings array.
${existing ? `\nAlready recorded, do not repeat unless you found a better source:\n${JSON.stringify(existing, null, 2)}\n` : ""}
Company to research: ${name}`;

const toProfile = (findings) => {
  const record = {};
  for (const finding of findings) {
    record[finding.key] = { source: finding.url, value: finding.value };
  }
  return record;
};

const missingFields = (record) =>
  COMPANY_FIELDS.filter((field) => !record[field.key]?.value).map((field) => ({
    key: field.key,
    label: field.label,
  }));

export const loadCompany = (workspace) => {
  const file = companyPath(workspace);
  const stored = readJson(file, null);
  if (!stored) {
    return { file, name: "", record: {}, researchedAt: null, sources: [] };
  }
  return stored;
};

export const saveCompany = (workspace, name, findings) => {
  const file = companyPath(workspace);
  const { kept, rejected } = sanitizeFindings(findings);
  const record = toProfile(kept);
  const stored = {
    file,
    name: clean(name) || record.name?.value || "",
    record,
    rejected,
    researchedAt: new Date().toISOString(),
    sources: [...new Set(kept.map((finding) => finding.url))],
  };
  writeJson(file, stored);
  return stored;
};

export const describeCompany = (stored) => {
  const rows = COMPANY_FIELDS.filter(
    (field) => stored.record[field.key]?.value
  ).map((field) => ({
    key: field.key,
    label: field.label,
    source: stored.record[field.key].source,
    value: stored.record[field.key].value,
  }));
  return {
    fields: rows,
    missing: missingFields(stored.record),
    name: stored.name,
    path: stored.file,
    researchedAt: stored.researchedAt,
    sources: stored.sources,
  };
};

export const researchCompany = async (workspace, name, options = {}) => {
  const target = clean(name);
  if (!target) {
    throw new Error(
      "Give the company name to research, for example: company --name 'Acme Inc'."
    );
  }
  const stored = loadCompany(workspace);
  const known = Object.fromEntries(
    Object.entries(stored.record).map(([key, value]) => [key, value.value])
  );
  const response = await runAgent(
    options,
    companyPrompt(target, Object.keys(known).length ? known : null),
    workspace
  );
  const findings = Array.isArray(response?.findings) ? response.findings : [];
  return saveCompany(workspace, target, findings);
};

export const formatCompany = (result) => {
  const lines = [result.message];
  if (result.fields.length) {
    lines.push("", "Recorded from public sources:");
    for (const field of result.fields) {
      lines.push(
        `  ${field.label}: ${field.value}`,
        `    source: ${field.source}`
      );
    }
  }
  if (result.missing.length) {
    lines.push(
      "",
      "Ask the student for these, they were not found in a public source:"
    );
    for (const item of result.missing) {
      lines.push(`  - ${item.label}`);
    }
  }
  if (result.warnings?.length) {
    lines.push("", ...result.warnings);
  }
  lines.push(`Saved: ${result.path}`);
  return lines.join("\n");
};
