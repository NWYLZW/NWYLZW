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

const maintainerSponsorsQuery = `
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

const sponsorTargetsQuery = `
  query SponsorTargets($login: String!, $after: String, $activeOnly: Boolean!) {
    user(login: $login) {
      sponsorshipsAsSponsor(first: 100, after: $after, activeOnly: $activeOnly) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          sponsorable {
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

const sponsorTargetsWithPrivacyQuery = `
  query SponsorTargetsWithPrivacy($login: String!, $after: String, $activeOnly: Boolean!) {
    user(login: $login) {
      sponsorshipsAsSponsor(first: 100, after: $after, activeOnly: $activeOnly) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          privacyLevel
          sponsorable {
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
      receivedCurrent: "Sponsoring my work now",
      receivedPast: "Sponsored my work before",
      givingCurrent: "People I sponsor now",
      givingPast: "People I sponsored before",
      cta: "Sponsor One Works / YiJie on GitHub",
      emptyReceivedCurrent: "No public current sponsors yet.",
      emptyReceivedPast: "No public past sponsors yet.",
      emptyGivingCurrent: "No public current sponsorships yet.",
      emptyGivingPast: "No public past sponsorships yet.",
      updated: "Updated daily by GitHub Actions.",
      insertBefore: "## Start Here",
    },
  },
  {
    file: "README.zh-Hans.md",
    labels: {
      section: "赞助者",
      receivedCurrent: "正在赞助我的人",
      receivedPast: "曾经赞助我的人",
      givingCurrent: "我正在赞助的人",
      givingPast: "我曾经赞助过的人",
      cta: "在 GitHub Sponsors 支持 One Works / 一介",
      emptyReceivedCurrent: "暂无公开的当前赞助者。",
      emptyReceivedPast: "暂无公开的历史赞助者。",
      emptyGivingCurrent: "暂无公开的当前赞助对象。",
      emptyGivingPast: "暂无公开的历史赞助对象。",
      updated: "由 GitHub Actions 每天自动更新。",
      insertBefore: "## 从这里开始",
    },
  },
  {
    file: "README.ja.md",
    labels: {
      section: "スポンサー",
      receivedCurrent: "現在支援してくれているスポンサー",
      receivedPast: "過去に支援してくれたスポンサー",
      givingCurrent: "現在支援している人",
      givingPast: "過去に支援した人",
      cta: "GitHub Sponsors で One Works / YiJie を支援する",
      emptyReceivedCurrent: "公開されている現在のスポンサーはまだありません。",
      emptyReceivedPast: "公開されている過去のスポンサーはまだありません。",
      emptyGivingCurrent: "公開されている現在の支援先はまだありません。",
      emptyGivingPast: "公開されている過去の支援先はまだありません。",
      updated: "GitHub Actions により毎日自動更新されます。",
      insertBefore: "## はじめる",
    },
  },
];

let canReadSponsorTargetPrivacy = true;

const activeReceivedSponsors = await fetchReceivedSponsors(true);
const allReceivedSponsors = await fetchReceivedSponsors(false);
const currentReceivedSponsors = dedupeSponsors(activeReceivedSponsors);
const currentReceivedLogins = new Set(
  currentReceivedSponsors.map((sponsor) => sponsor.login.toLowerCase()),
);
const pastReceivedSponsors = dedupeSponsors(
  allReceivedSponsors.filter(
    (sponsor) => !currentReceivedLogins.has(sponsor.login.toLowerCase()),
  ),
);

const activeSponsorTargets = await fetchSponsorTargets(true);
const allSponsorTargets = await fetchSponsorTargets(false);
const currentSponsorTargets = dedupeSponsors(activeSponsorTargets);
const currentSponsorTargetLogins = new Set(
  currentSponsorTargets.map((sponsor) => sponsor.login.toLowerCase()),
);
const pastSponsorTargets = dedupeSponsors(
  allSponsorTargets.filter(
    (sponsor) => !currentSponsorTargetLogins.has(sponsor.login.toLowerCase()),
  ),
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
  [
    `Updated sponsors for ${sponsorLogin}:`,
    `${currentReceivedSponsors.length} current supporters,`,
    `${pastReceivedSponsors.length} past supporters,`,
    `${currentSponsorTargets.length} current sponsorships,`,
    `${pastSponsorTargets.length} past sponsorships.`,
  ].join(" "),
);

async function fetchReceivedSponsors(activeOnly) {
  return fetchSponsorships({
    activeOnly,
    connectionField: "sponsorshipsAsMaintainer",
    entityField: "sponsorEntity",
    includePrivateArgument: includePrivate,
    source: maintainerSponsorsQuery,
  });
}

async function fetchSponsorTargets(activeOnly) {
  if (canReadSponsorTargetPrivacy) {
    try {
      return await fetchSponsorships({
        activeOnly,
        connectionField: "sponsorshipsAsSponsor",
        entityField: "sponsorable",
        filterPrivateByPrivacyLevel: !includePrivate,
        source: sponsorTargetsWithPrivacyQuery,
      });
    } catch (error) {
      if (!isPrivacyScopeError(error)) {
        throw error;
      }

      canReadSponsorTargetPrivacy = false;
    }
  }

  return fetchSponsorships({
    activeOnly,
    connectionField: "sponsorshipsAsSponsor",
    entityField: "sponsorable",
    source: sponsorTargetsQuery,
  });
}

async function fetchSponsorships({
  activeOnly,
  connectionField,
  entityField,
  filterPrivateByPrivacyLevel = false,
  includePrivateArgument,
  source,
}) {
  const sponsors = [];
  let after = null;

  do {
    const variables = {
      login: sponsorLogin,
      after,
      activeOnly,
    };
    if (includePrivateArgument !== undefined) {
      variables.includePrivate = includePrivateArgument;
    }

    const data = await graphql(source, variables);
    const connection = data.user?.[connectionField];

    if (!connection) {
      throw new Error(`GitHub user not found or sponsors unavailable: ${sponsorLogin}`);
    }

    sponsors.push(
      ...connection.nodes
        .map((node) => normalizeSponsor(node, entityField, filterPrivateByPrivacyLevel))
        .filter(Boolean),
    );
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
    const error = new Error(`GitHub GraphQL errors: ${JSON.stringify(body.errors)}`);
    error.graphqlErrors = body.errors;
    throw error;
  }

  return body.data;
}

function normalizeSponsor(node, entityField, filterPrivateByPrivacyLevel) {
  if (filterPrivateByPrivacyLevel && node.privacyLevel && node.privacyLevel !== "PUBLIC") {
    return null;
  }

  const entity = node[entityField];
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
    `### ${labels.receivedCurrent}`,
    "",
    renderSponsorGrid(currentReceivedSponsors, labels.emptyReceivedCurrent),
    "",
    `### ${labels.receivedPast}`,
    "",
    renderSponsorGrid(pastReceivedSponsors, labels.emptyReceivedPast),
    "",
    `### ${labels.givingCurrent}`,
    "",
    renderSponsorGrid(currentSponsorTargets, labels.emptyGivingCurrent),
    "",
    `### ${labels.givingPast}`,
    "",
    renderSponsorGrid(pastSponsorTargets, labels.emptyGivingPast),
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

function isPrivacyScopeError(error) {
  return error.graphqlErrors?.some(
    (graphqlError) =>
      graphqlError.type === "INSUFFICIENT_SCOPES" &&
      String(graphqlError.message).includes("privacyLevel"),
  );
}
