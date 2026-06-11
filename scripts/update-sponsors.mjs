#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sponsorLogin =
  process.env.SPONSOR_LOGIN || process.env.GITHUB_REPOSITORY_OWNER || "NWYLZW";
const token = process.env.SPONSORS_TOKEN || process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const includePrivate = process.env.SPONSORS_INCLUDE_PRIVATE === "true";

if (!token) {
  throw new Error("Missing SPONSORS_TOKEN, GITHUB_TOKEN, or GH_TOKEN.");
}

const query = `
  query MaintainerSponsors($login: String!, $after: String, $activeOnly: Boolean!, $includePrivate: Boolean!) {
    user(login: $login) {
      sponsorshipsAsMaintainer(
        first: 100
        after: $after
        activeOnly: $activeOnly
        includePrivate: $includePrivate
      ) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          sponsorEntity {
            __typename
            ... on User {
              login
              name
              url
              avatarUrl(size: 96)
            }
            ... on Organization {
              login
              name
              url
              avatarUrl(size: 96)
            }
          }
        }
      }
    }
  }
`;

const readmes = [
  {
    file: "README.md",
    labels: {
      section: "Sponsors",
      current: "Current sponsors",
      past: "Past sponsors",
      cta: "Sponsor One Works / YiJie on GitHub",
      emptyCurrent: "No public current sponsors yet.",
      emptyPast: "No public past sponsors yet.",
      updated: "Updated daily by GitHub Actions.",
      insertBefore: "## Start Here",
    },
  },
  {
    file: "README.zh-Hans.md",
    labels: {
      section: "赞助者",
      current: "当前赞助者",
      past: "历史赞助者",
      cta: "在 GitHub Sponsors 支持 One Works / 一介",
      emptyCurrent: "暂无公开的当前赞助者。",
      emptyPast: "暂无公开的历史赞助者。",
      updated: "由 GitHub Actions 每天自动更新。",
      insertBefore: "## 从这里开始",
    },
  },
  {
    file: "README.ja.md",
    labels: {
      section: "スポンサー",
      current: "現在のスポンサー",
      past: "過去のスポンサー",
      cta: "GitHub Sponsors で One Works / YiJie を支援する",
      emptyCurrent: "公開されている現在のスポンサーはまだありません。",
      emptyPast: "公開されている過去のスポンサーはまだありません。",
      updated: "GitHub Actions により毎日自動更新されます。",
      insertBefore: "## はじめる",
    },
  },
];

const activeSponsors = await fetchSponsors(true);
const allSponsors = await fetchSponsors(false);
const currentSponsors = dedupeSponsors(activeSponsors);
const currentLogins = new Set(currentSponsors.map((sponsor) => sponsor.login.toLowerCase()));
const pastSponsors = dedupeSponsors(
  allSponsors.filter((sponsor) => !currentLogins.has(sponsor.login.toLowerCase())),
);

for (const readme of readmes) {
  const filePath = path.join(repoRoot, readme.file);
  const content = await readFile(filePath, "utf8");
  const nextContent = upsertSponsorsSection(content, readme.labels);
  if (nextContent !== content) {
    await writeFile(filePath, nextContent);
  }
}

console.log(
  `Updated sponsors for ${sponsorLogin}: ${currentSponsors.length} current, ${pastSponsors.length} past.`,
);

async function fetchSponsors(activeOnly) {
  const sponsors = [];
  let after = null;

  do {
    const data = await graphql(query, {
      login: sponsorLogin,
      after,
      activeOnly,
      includePrivate,
    });
    const connection = data.user?.sponsorshipsAsMaintainer;

    if (!connection) {
      throw new Error(`GitHub user not found or sponsors unavailable: ${sponsorLogin}`);
    }

    sponsors.push(...connection.nodes.map(normalizeSponsor).filter(Boolean));
    after = connection.pageInfo.hasNextPage ? connection.pageInfo.endCursor : null;
  } while (after);

  return sponsors;
}

async function graphql(source, variables) {
  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "user-agent": "nwylzw-profile-sponsors-updater",
    },
    body: JSON.stringify({ query: source, variables }),
  });
  const body = await response.json();

  if (!response.ok) {
    throw new Error(`GitHub GraphQL request failed: ${response.status} ${JSON.stringify(body)}`);
  }
  if (body.errors?.length) {
    throw new Error(`GitHub GraphQL errors: ${JSON.stringify(body.errors)}`);
  }

  return body.data;
}

function normalizeSponsor(node) {
  const entity = node.sponsorEntity;
  if (!entity?.login || !entity?.url || !entity?.avatarUrl) {
    return null;
  }

  return {
    login: entity.login,
    name: entity.name?.trim() || entity.login,
    url: entity.url,
    avatarUrl: entity.avatarUrl,
  };
}

function dedupeSponsors(sponsors) {
  const byLogin = new Map();

  for (const sponsor of sponsors) {
    const key = sponsor.login.toLowerCase();
    const previous = byLogin.get(key);
    if (!previous || compareSponsors(sponsor, previous) < 0) {
      byLogin.set(key, sponsor);
    }
  }

  return [...byLogin.values()].sort(compareSponsors);
}

function compareSponsors(left, right) {
  return left.login.localeCompare(right.login);
}

function upsertSponsorsSection(content, labels) {
  const block = renderSponsorsBlock(labels);
  const markerPattern = /<!-- sponsors:start -->[\s\S]*?<!-- sponsors:end -->/;

  if (markerPattern.test(content)) {
    return content.replace(markerPattern, block);
  }

  const section = `## ${labels.section}\n\n${block}\n\n`;
  const insertBeforeIndex = content.indexOf(`\n${labels.insertBefore}`);

  if (insertBeforeIndex === -1) {
    return `${content.trimEnd()}\n\n${section}`;
  }

  return `${content.slice(0, insertBeforeIndex).trimEnd()}\n\n${section}${content.slice(
    insertBeforeIndex + 1,
  )}`;
}

function renderSponsorsBlock(labels) {
  return [
    "<!-- sponsors:start -->",
    '<p align="center">',
    `  <a href="https://github.com/sponsors/${escapeAttribute(sponsorLogin)}"><strong>${escapeHtml(
      labels.cta,
    )}</strong></a>`,
    "</p>",
    "",
    `### ${labels.current}`,
    "",
    renderSponsorGrid(currentSponsors, labels.emptyCurrent),
    "",
    `### ${labels.past}`,
    "",
    renderSponsorGrid(pastSponsors, labels.emptyPast),
    "",
    `<p align="center"><sub>${escapeHtml(labels.updated)}</sub></p>`,
    "<!-- sponsors:end -->",
  ].join("\n");
}

function renderSponsorGrid(sponsors, emptyText) {
  if (!sponsors.length) {
    return `<p align="center"><sub>${escapeHtml(emptyText)}</sub></p>`;
  }

  return [
    '<p align="center">',
    ...sponsors.map(
      (sponsor) =>
        `  <a href="${escapeAttribute(sponsor.url)}" title="${escapeAttribute(
          sponsor.name,
        )} (@${escapeAttribute(sponsor.login)})"><img src="${escapeAttribute(
          sponsor.avatarUrl,
        )}" width="56" height="56" alt="@${escapeAttribute(sponsor.login)}"></a>`,
    ),
    "</p>",
  ].join("\n");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll('"', "&quot;");
}
