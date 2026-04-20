// Curated reference data for major US digital-asset legislation.
//
// This file is hand-maintained. Update `lastReviewed` when values change.
// Dynamic data (live actions, text versions) should be fetched via the
// Congress.gov / GovInfo API tools instead.

export interface CuratedActSource {
  label: string;
  url: string;
}

export interface CuratedActSponsor {
  name: string;
  party: "R" | "D" | "I";
  state: string;
  chamber: "House" | "Senate";
  role?: "sponsor" | "cosponsor";
}

export interface CuratedActTimelineEvent {
  date: string; // ISO 8601 (YYYY-MM-DD)
  event: string;
}

export interface CuratedAct {
  slug: "genius-act" | "clarity-act";
  shortTitle: string;
  fullTitle: string;
  congress: 119;
  billId: string; // canonical "{type}{number}-{congress}" e.g. "s1582-119"
  billType: "s" | "hr";
  billNumber: number;
  publicLaw?: string; // e.g. "119-27"
  statute?: string; // codified citation e.g. "12 U.S.C. 5901 et seq."
  status: string;
  timeline: CuratedActTimelineEvent[];
  sponsors: CuratedActSponsor[];
  summary: string;
  keyProvisions: string[];
  agencyJurisdiction: string[];
  sources: CuratedActSource[];
  relatedBills: string[];
  lastReviewed: string; // ISO date
}

export const GENIUS_ACT: CuratedAct = {
  slug: "genius-act",
  shortTitle: "GENIUS Act",
  fullTitle:
    "Guiding and Establishing National Innovation for U.S. Stablecoins Act of 2025",
  congress: 119,
  billId: "s1582-119",
  billType: "s",
  billNumber: 1582,
  publicLaw: "119-27",
  statute: "12 U.S.C. 5901 et seq.",
  status:
    "Enacted. Signed into law by President Donald Trump on July 18, 2025 as Pub. L. 119-27.",
  timeline: [
    {
      date: "2025-05-01",
      event: "Introduced in the Senate by Sen. Bill Hagerty (R-TN).",
    },
    { date: "2025-06-17", event: "Passed the Senate, 68-30." },
    { date: "2025-07-17", event: "Passed the House, 308-122." },
    {
      date: "2025-07-18",
      event: "Signed by President Trump; became Public Law 119-27.",
    },
  ],
  sponsors: [
    {
      name: "Bill Hagerty",
      party: "R",
      state: "TN",
      chamber: "Senate",
      role: "sponsor",
    },
  ],
  summary:
    "The GENIUS Act establishes the first comprehensive US federal regulatory framework for payment stablecoins. It defines 'payment stablecoin' (a digital asset used as a means of payment or settlement whose issuer is obligated to redeem it for a fixed amount of monetary value and represents that a stable value will be maintained), limits who may issue payment stablecoins in the United States to 'permitted payment stablecoin issuers,' and assigns supervision across federal and state banking regulators. Reserve, redemption, disclosure, capital, liquidity, risk-management, consumer-protection, and anti-money-laundering standards are prescribed, and the Treasury, OCC, Federal Reserve, FDIC, NCUA, and state regulators are directed to issue implementing rules.",
  keyProvisions: [
    "Defines 'payment stablecoin' and 'permitted payment stablecoin issuer' (subsidiaries of insured depository institutions, federally qualified nonbank issuers chartered by the OCC, and state-qualified issuers under an approved state regime).",
    "Requires 1:1 backing of outstanding stablecoins with high-quality, highly liquid reserve assets (USD, insured demand deposits, short-dated Treasuries, Treasury-backed repo, and money-market funds holding such assets).",
    "Mandates monthly public reserve disclosures attested by a registered public accounting firm and annual audited financial statements for large issuers.",
    "Prohibits payment stablecoin issuers from paying interest or yield to holders on the stablecoin itself.",
    "Establishes redemption-at-par obligations and priority of stablecoin holders in insolvency proceedings.",
    "Sets AML/BSA, sanctions compliance, and customer identification requirements; treats issuers as financial institutions under the BSA.",
    "Creates a federal/state dual-track licensing regime with a Stablecoin Certification Review Committee to certify state regimes as substantially similar.",
    "Directs the OCC, Federal Reserve, FDIC, and NCUA to issue implementing regulations; Treasury retains residual authority.",
    "Preempts conflicting state money-transmitter licensing for permitted issuers.",
    "Places limits on affiliated issuer activities by public companies that are not predominantly engaged in financial activities.",
  ],
  agencyJurisdiction: [
    "Department of the Treasury",
    "Office of the Comptroller of the Currency (OCC)",
    "Federal Reserve Board",
    "Federal Deposit Insurance Corporation (FDIC)",
    "National Credit Union Administration (NCUA)",
    "State banking regulators (via Stablecoin Certification Review Committee)",
  ],
  sources: [
    {
      label: "Congress.gov: S.1582 - GENIUS Act",
      url: "https://www.congress.gov/bill/119th-congress/senate-bill/1582",
    },
    {
      label: "Enrolled bill text (PDF)",
      url: "https://www.congress.gov/119/bills/s1582/BILLS-119s1582enr.pdf",
    },
    {
      label: "Enrolled bill text (HTM)",
      url: "https://www.congress.gov/119/bills/s1582/BILLS-119s1582enr.htm",
    },
    {
      label: "GovInfo: Public Law 119-27",
      url: "https://www.govinfo.gov/app/details/PLAW-119publ27",
    },
    {
      label:
        "OCC NPR: Implementing the GENIUS Act for stablecoin issuance by OCC-regulated entities (NR 2026-9A)",
      url: "https://occ.gov/news-issuances/news-releases/2026/nr-occ-2026-9a.pdf",
    },
    {
      label: "White House Statement of Administration Policy (June 9, 2025)",
      url: "https://raw.githubusercontent.com/unitedstates/statements-of-administration-policy/main/archive/statements/47-Trump/119/2025-06-09_s1582.pdf",
    },
  ],
  relatedBills: [
    "S.919 (119th) - GENIUS Act of 2025 (Banking Committee version, ~81% incorporated)",
    "S.394 (119th) - GENIUS Act of 2025 (original Hagerty text, ~70% incorporated)",
    "H.R.2392 (119th) - STABLE Act of 2025 (~43% incorporated)",
  ],
  lastReviewed: "2026-04-20",
};

export const CLARITY_ACT: CuratedAct = {
  slug: "clarity-act",
  shortTitle: "CLARITY Act",
  fullTitle: "Digital Asset Market Clarity Act of 2025",
  congress: 119,
  billId: "hr3633-119",
  billType: "hr",
  billNumber: 3633,
  status:
    "Passed House (294-134) on July 17, 2025; referred to Senate Banking, Housing, and Urban Affairs Committee. As of April 2026 the Senate markup is stalled with 100+ pending amendments; a companion Digital Commodities Intermediary Act (DCIA) advanced through the Senate Agriculture Committee on January 29, 2026.",
  timeline: [
    {
      date: "2025-05-29",
      event:
        "Introduced in the House by Rep. French Hill (R-AR-2), with 21 original cosponsors (14 R, 7 D).",
    },
    {
      date: "2025-06-23",
      event:
        "Ordered reported by the House Financial Services and House Agriculture Committees.",
    },
    {
      date: "2025-07-17",
      event: "Passed the House, 294-134 (bipartisan).",
    },
    {
      date: "2025-07-18",
      event:
        "Received in the Senate; referred to the Committee on Banking, Housing, and Urban Affairs.",
    },
    {
      date: "2026-01-29",
      event:
        "Companion Digital Commodities Intermediary Act (DCIA) advanced through the Senate Agriculture Committee on a party-line vote.",
    },
    {
      date: "2026-04",
      event:
        "Senate markup remains delayed; Sen. Cynthia Lummis publicly warns this is Congress's 'last chance' window before a potential legislative reset.",
    },
  ],
  sponsors: [
    {
      name: "French Hill",
      party: "R",
      state: "AR",
      chamber: "House",
      role: "sponsor",
    },
  ],
  summary:
    "The Digital Asset Market Clarity (CLARITY) Act establishes a federal regulatory framework for the offer and sale of digital assets in the United States, allocating jurisdiction between the Securities and Exchange Commission (SEC) and the Commodity Futures Trading Commission (CFTC). It creates new statutory categories ('digital commodity,' 'permitted payment stablecoin,' 'restricted digital asset') and a maturity/decentralization test for when a digital asset is regulated as a commodity versus a security. It also amends the Federal Reserve Act to bar Federal Reserve Banks from offering retail-facing banking products directly to individuals and prohibits the use of a central bank digital currency (CBDC) for monetary policy.",
  keyProvisions: [
    "Creates a functional framework dividing jurisdiction: the CFTC regulates 'digital commodities' (including secondary-market trading of sufficiently decentralized blockchain tokens) and the SEC regulates 'restricted digital assets' offered as investment contracts.",
    "Defines a 'mature blockchain system' / decentralization test that, once met, transitions a token's secondary trading from SEC to CFTC oversight.",
    "Establishes CFTC registration categories for Digital Commodity Exchanges, Digital Commodity Brokers, and Digital Commodity Dealers, with capital, customer-property segregation, disclosure, and AML requirements.",
    "Creates an SEC framework for primary offerings of digital assets, including an exemption for fundraising up to statutory thresholds with disclosure and resale limitations.",
    "Provides a joint SEC-CFTC rulemaking process and a provisional registration path for existing market participants.",
    "Prohibits Federal Reserve Banks from offering retail-facing products or services directly to individuals (no 'FedAccounts').",
    "Prohibits the issuance of a central bank digital currency (CBDC) and bars the use of any CBDC for monetary policy.",
    "Preserves state money-transmitter authority while coordinating with the GENIUS Act's payment-stablecoin regime.",
    "Includes anti-manipulation, illicit-finance, and consumer-protection provisions applicable to digital commodity intermediaries.",
  ],
  agencyJurisdiction: [
    "Securities and Exchange Commission (SEC)",
    "Commodity Futures Trading Commission (CFTC)",
    "Department of the Treasury / FinCEN (AML)",
    "Federal Reserve Board (CBDC / retail services prohibitions)",
  ],
  sources: [
    {
      label:
        "Congress.gov: H.R.3633 - Digital Asset Market Clarity Act of 2025",
      url: "https://www.congress.gov/bill/119th-congress/house-bill/3633",
    },
    {
      label: "House-passed (RFS) bill text (PDF)",
      url: "https://www.congress.gov/119/bills/hr3633/BILLS-119hr3633rfs.pdf",
    },
    {
      label:
        "House Financial Services Committee: Section-by-Section Summary (May 29, 2025)",
      url: "https://financialservices.house.gov/uploadedfiles/2025-05-29_-_sbs_-_clarity_act_of_2025_-_final.pdf",
    },
    {
      label: "White House Statement of Administration Policy (July 15, 2025)",
      url: "https://raw.githubusercontent.com/unitedstates/statements-of-administration-policy/main/archive/statements/47-Trump/119/2025-07-15_hr3633.pdf",
    },
    {
      label: "GovTrack: H.R.3633 status and votes",
      url: "https://www.govtrack.us/congress/bills/119/hr3633",
    },
  ],
  relatedBills: [
    "S. (119th) - Digital Commodities Intermediary Act (DCIA) - Senate Agriculture companion",
    "S.1582 (119th) - GENIUS Act (payment stablecoin regime; complementary)",
    "H.R.4763 (118th) - Financial Innovation and Technology for the 21st Century Act (FIT21) - predecessor framework",
  ],
  lastReviewed: "2026-04-20",
};

export const CURATED_ACTS: Record<string, CuratedAct> = {
  "genius-act": GENIUS_ACT,
  "clarity-act": CLARITY_ACT,
};

// Current Congress (hand-maintained; update every two years in January).
export const CURRENT_CONGRESS = 119;

// Bills we always want surfaced for digital-asset / stablecoin / crypto queries.
// These are fetched live via Congress.gov so status stays current, but the
// allow-list itself is hand-curated to avoid the noise from keyword-less
// listing the Congress.gov /bill endpoint returns.
export interface TrackedBill {
  congress: number;
  type: "hr" | "s" | "hjres" | "sjres";
  number: number;
  tags: string[]; // lowercase keywords this bill is about
  note?: string;
}

export const TRACKED_DIGITAL_ASSET_BILLS: TrackedBill[] = [
  {
    congress: 119,
    type: "s",
    number: 1582,
    tags: [
      "stablecoin",
      "payment stablecoin",
      "genius",
      "digital asset",
      "crypto",
      "reserves",
    ],
    note: "GENIUS Act (Pub. L. 119-27)",
  },
  {
    congress: 119,
    type: "hr",
    number: 3633,
    tags: [
      "clarity",
      "digital asset",
      "market structure",
      "digital commodity",
      "crypto",
      "cbdc",
      "sec",
      "cftc",
    ],
    note: "CLARITY Act",
  },
  {
    congress: 119,
    type: "s",
    number: 919,
    tags: ["stablecoin", "genius", "digital asset", "crypto"],
    note: "GENIUS Act (Banking Committee version)",
  },
  {
    congress: 119,
    type: "s",
    number: 394,
    tags: ["stablecoin", "genius", "digital asset", "crypto"],
    note: "GENIUS Act (original Hagerty text)",
  },
  {
    congress: 119,
    type: "hr",
    number: 2392,
    tags: ["stablecoin", "stable act", "digital asset", "crypto"],
    note: "STABLE Act of 2025",
  },
  {
    congress: 118,
    type: "hr",
    number: 4763,
    tags: [
      "fit21",
      "digital asset",
      "market structure",
      "digital commodity",
      "crypto",
      "sec",
      "cftc",
    ],
    note: "FIT21 Act (118th Congress, CLARITY predecessor)",
  },
];

// Keywords that mean "this is a digital-asset / crypto query." Used to
// (a) decide whether to surface the curated knowledge and (b) filter noise.
export const DIGITAL_ASSET_QUERY_TERMS: string[] = [
  "stablecoin",
  "stable coin",
  "digital asset",
  "digital assets",
  "digital commodity",
  "digital commodities",
  "cryptocurrency",
  "crypto",
  "blockchain",
  "cbdc",
  "central bank digital currency",
  "genius act",
  "genius",
  "clarity act",
  "clarity",
  "fit21",
  "market structure",
  "tokenization",
  "token",
  "defi",
  "payment stablecoin",
];

export function queryMatchesDigitalAssets(query: string): boolean {
  const q = query.toLowerCase();
  return DIGITAL_ASSET_QUERY_TERMS.some((term) => q.includes(term));
}

export function matchingCuratedActs(query: string): CuratedAct[] {
  const q = query.toLowerCase();
  const matches: CuratedAct[] = [];
  for (const act of Object.values(CURATED_ACTS)) {
    const hay = [
      act.shortTitle,
      act.fullTitle,
      act.slug,
      act.summary,
      ...act.keyProvisions,
    ]
      .join(" ")
      .toLowerCase();
    const terms = q.split(/\s+/).filter((t) => t.length > 2);
    const hit = terms.some((t) => hay.includes(t));
    if (hit) matches.push(act);
  }
  return matches;
}

export function formatCuratedAct(act: CuratedAct): string {
  const lines: string[] = [];
  lines.push(`# ${act.shortTitle} - ${act.fullTitle}`);
  lines.push("");
  lines.push(
    `**Bill:** ${act.billId.toUpperCase()} (${act.congress}th Congress)`,
  );
  if (act.publicLaw) lines.push(`**Public Law:** ${act.publicLaw}`);
  if (act.statute) lines.push(`**Codified:** ${act.statute}`);
  lines.push(`**Status:** ${act.status}`);
  lines.push(`**Last Reviewed:** ${act.lastReviewed}`);
  lines.push("");
  lines.push("## Summary");
  lines.push(act.summary);
  lines.push("");
  lines.push("## Sponsor(s)");
  for (const s of act.sponsors) {
    lines.push(`- ${s.name} (${s.party}-${s.state}, ${s.chamber})`);
  }
  lines.push("");
  lines.push("## Timeline");
  for (const ev of act.timeline) {
    lines.push(`- **${ev.date}** - ${ev.event}`);
  }
  lines.push("");
  lines.push("## Key Provisions");
  for (const p of act.keyProvisions) {
    lines.push(`- ${p}`);
  }
  lines.push("");
  lines.push("## Agency Jurisdiction");
  for (const a of act.agencyJurisdiction) {
    lines.push(`- ${a}`);
  }
  lines.push("");
  lines.push("## Sources");
  for (const src of act.sources) {
    lines.push(`- [${src.label}](${src.url})`);
  }
  lines.push("");
  if (act.relatedBills.length > 0) {
    lines.push("## Related Bills");
    for (const rb of act.relatedBills) {
      lines.push(`- ${rb}`);
    }
  }
  return lines.join("\n");
}
