export const AI_CRAWLERS = [
  "gptbot",
  "chatgpt-user",
  "oai-searchbot",
  "claudebot",
  "anthropic-ai",
  "claude-web",
  "google-extended",
  "google-cloudvertexbot",
  "googleother",
  "bytespider",
  "ccbot",
  "perplexitybot",
  "applebot-extended",
  "cohere-ai",
  "amazonbot",
  "meta-externalagent",
] as const;

export const DISCOVERY_PATHS = [
  "/llms.txt",
  "/.well-known/llms.txt",
  "/.well-known/mcp.json",
  "/sitemap.xml",
];

type RobotsGroup = {
  agents: string[];
  disallows: string[];
};

export type RobotsVerdict = {
  level: "allow" | "mixed" | "block";
  reasons: string[];
};

export function assessRobotsTxt(text: string | undefined): RobotsVerdict {
  if (text === undefined) {
    return { level: "allow", reasons: ["No robots.txt; default allow"] };
  }

  const groups = parseRobots(text);
  if (groups.length === 0) {
    return { level: "allow", reasons: ["robots.txt has no Disallow rules"] };
  }

  const reasons: string[] = [];
  const star = groupsFor(groups, "*");
  const starBlocksSite = star.some((group) => pathDisallowed(group.disallows, "/"));
  const starBlocksDiscovery = DISCOVERY_PATHS.filter((path) =>
    star.some((group) => pathDisallowed(group.disallows, path)),
  );

  if (starBlocksSite) {
    reasons.push("User-agent * Disallow: / blocks all crawlers");
  }
  if (starBlocksDiscovery.length > 0) {
    reasons.push(`User-agent * disallows ${starBlocksDiscovery.join(", ")}`);
  }

  const sitewideBots: string[] = [];
  const discoveryBots: string[] = [];
  const otherBots: string[] = [];

  for (const bot of AI_CRAWLERS) {
    const matched = groupsFor(groups, bot);
    const blocksSite = matched.some((group) => pathDisallowed(group.disallows, "/"));
    const blockedDiscovery = DISCOVERY_PATHS.filter((path) =>
      matched.some((group) => pathDisallowed(group.disallows, path)),
    );
    const hasOther = matched.some((group) =>
      group.disallows.some((rule) => rule !== "" && rule !== "/"),
    );
    if (blocksSite) sitewideBots.push(bot);
    else if (blockedDiscovery.length > 0) discoveryBots.push(bot);
    else if (hasOther && matched.some((group) => group.agents.includes(bot))) {
      otherBots.push(bot);
    }
  }

  if (sitewideBots.length > 0) {
    reasons.push(`Sitewide Disallow for ${sitewideBots.join(", ")}`);
  }
  if (discoveryBots.length > 0) {
    reasons.push(`Discovery paths blocked for ${discoveryBots.join(", ")}`);
  }

  if (starBlocksSite || sitewideBots.length > 0 || starBlocksDiscovery.length > 0 || discoveryBots.length > 0) {
    return { level: "block", reasons };
  }
  if (otherBots.length > 0) {
    return {
      level: "mixed",
      reasons: [`Limited Disallow rules for ${otherBots.join(", ")}`],
    };
  }
  return { level: "allow", reasons: ["No AI-crawler or discovery-path blocks"] };
}

export function parseRobots(text: string): RobotsGroup[] {
  const groups: RobotsGroup[] = [];
  let current: RobotsGroup | null = null;
  let sawRule = false;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) {
      current = null;
      sawRule = false;
      continue;
    }
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const field = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();

    if (field === "user-agent") {
      if (!current || sawRule) {
        current = { agents: [], disallows: [] };
        groups.push(current);
        sawRule = false;
      }
      current.agents.push(value.toLowerCase());
    } else if (field === "disallow" && current) {
      current.disallows.push(value);
      sawRule = true;
    } else if (field === "allow") {
      sawRule = true;
    }
  }

  return groups.filter((group) => group.agents.length > 0);
}

function groupsFor(groups: RobotsGroup[], agent: string): RobotsGroup[] {
  const specific = groups.filter((group) => group.agents.includes(agent));
  if (specific.length > 0) return specific;
  return groups.filter((group) => group.agents.includes("*"));
}

function pathDisallowed(disallows: string[], path: string): boolean {
  return disallows.some((rule) => {
    if (rule === "") return false;
    if (rule === "/") return true;
    return path === rule || path.startsWith(rule);
  });
}
