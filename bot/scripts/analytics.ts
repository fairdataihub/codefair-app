import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const prisma = new PrismaClient();
const __dirname = dirname(fileURLToPath(import.meta.url));

function pct(n: number, total: number): string {
  if (total === 0) return `${n} (0.0%)`;
  return `${n} (${((n / total) * 100).toFixed(1)}%)`;
}

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

function section(title: string): void {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  ${title}`);
  console.log("=".repeat(60));
}

function row(label: string, value: string | number): void {
  const padded = String(label).padEnd(38, " ");
  console.log(`  ${padded} ${value}`);
}

async function runAnalytics() {
  const now = new Date();
  const ago30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const ago90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  console.log(`\n${"=".repeat(60)}`);
  console.log(`  CODEFAIR ANALYTICS REPORT`);
  console.log(`  Generated: ${now.toISOString().slice(0, 10)}`);
  console.log("=".repeat(60));

  // ── Run all DB queries in parallel ──────────────────────────
  const [
    // Adoption
    totalInstallations,
    allOwners,
    newRepos30,
    newRepos90,
    totalUsers,
    activeUsers30,
    activeUsers90,

    // Compliance - presence
    licensePresent,
    licenseValid,
    codemetaPresent,
    codemetaValid,
    citationPresent,
    citationValid,
    readmePresent,
    cocPresent,
    contributingPresent,
    cwlPresent,

    // Full FAIR compliance (valid license + valid codemeta or valid citation)
    // We need to fetch IDs and intersect in JS
    validLicenseRepoIds,
    validCodemetaRepoIds,
    validCitationRepoIds,

    // Zenodo
    totalDepositions,
    publishedDepositions,
    reposWithDoi,

    // Analytics counters (summed)
    analyticsAgg,
  ] = await prisma.$transaction([
    // Adoption
    prisma.installation.count(),
    prisma.installation.findMany({ select: { owner: true } }),
    prisma.installation.count({ where: { created_at: { gte: ago30 } } }),
    prisma.installation.count({ where: { created_at: { gte: ago90 } } }),
    prisma.user.count(),
    prisma.user.count({ where: { last_login: { gte: ago30 } } }),
    prisma.user.count({ where: { last_login: { gte: ago90 } } }),

    // Compliance - presence
    prisma.licenseRequest.count({ where: { contains_license: true } }),
    prisma.licenseRequest.count({ where: { license_status: "valid" } }),
    prisma.codeMetadata.count({ where: { contains_codemeta: true } }),
    prisma.codeMetadata.count({ where: { codemeta_status: "valid" } }),
    prisma.codeMetadata.count({ where: { contains_citation: true } }),
    prisma.codeMetadata.count({ where: { citation_status: "valid" } }),
    prisma.readmeValidation.count({ where: { contains_readme: true } }),
    prisma.codeofConductValidation.count({ where: { contains_code: true } }),
    prisma.contributingValidation.count({ where: { contains_contrib: true } }),
    prisma.cwlValidation.count({ where: { contains_cwl_files: true } }),

    // For full compliance calculation
    prisma.licenseRequest.findMany({
      where: { license_status: "valid" },
      select: { repository_id: true },
    }),
    prisma.codeMetadata.findMany({
      where: { codemeta_status: "valid" },
      select: { repository_id: true },
    }),
    prisma.codeMetadata.findMany({
      where: { citation_status: "valid" },
      select: { repository_id: true },
    }),

    // Zenodo
    prisma.zenodoDeposition.count(),
    prisma.zenodoDeposition.count({ where: { status: "published" } }),
    prisma.zenodoDeposition.count({
      where: { last_published_zenodo_doi: { not: null } },
    }),

    // Analytics aggregate
    prisma.analytics.aggregate({
      _sum: {
        license_created: true,
        update_codemeta: true,
        update_citation: true,
        update_readme: true,
        update_code_of_conduct: true,
        update_contributing: true,
        cwl_validated_file_count: true,
        zenodo_release: true,
        create_release: true,
      },
    }),
  ]);

  const totalRepos = totalInstallations;
  const uniqueOwners = new Set(allOwners.map((i) => i.owner)).size;

  const validLicenseSet = new Set(
    validLicenseRepoIds.map((r) => r.repository_id)
  );
  const validMetaSet = new Set([
    ...validCodemetaRepoIds.map((r) => r.repository_id),
    ...validCitationRepoIds.map((r) => r.repository_id),
  ]);
  let fullCompliantCount = 0;
  for (const id of validLicenseSet) {
    if (validMetaSet.has(id)) fullCompliantCount++;
  }

  // FAIR-ready: have a license AND metadata (present, not necessarily valid)
  const [licenseRepoIds, anyMetaRepoIds] = await Promise.all([
    prisma.licenseRequest.findMany({
      where: { contains_license: true },
      select: { repository_id: true },
    }),
    prisma.codeMetadata.findMany({
      where: { OR: [{ contains_codemeta: true }, { contains_citation: true }] },
      select: { repository_id: true },
    }),
  ]);
  const licenseSet = new Set(licenseRepoIds.map((r) => r.repository_id));
  const metaSet = new Set(anyMetaRepoIds.map((r) => r.repository_id));
  let fairReadyCount = 0;
  for (const id of licenseSet) {
    if (metaSet.has(id)) fairReadyCount++;
  }

  // Orgs/owners with ≥1 fully compliant repo
  const [compliantInstalls] = await Promise.all([
    prisma.installation.findMany({
      where: {
        id: { in: [...validLicenseSet].filter((id) => validMetaSet.has(id)) },
      },
      select: { owner: true },
    }),
  ]);
  const compliantOwners = new Set(compliantInstalls.map((i) => i.owner)).size;

  const sum = analyticsAgg._sum;

  // Output

  section("1. ADOPTION & GROWTH");
  row("Total repos installed:", fmt(totalRepos));
  row("Unique owners / orgs:", fmt(uniqueOwners));
  row("New repos (last 30 days):", fmt(newRepos30));
  row("New repos (last 90 days):", fmt(newRepos90));
  row("Registered users:", fmt(totalUsers));
  row("Active users (last 30 days):", fmt(activeUsers30));
  row("Active users (last 90 days):", fmt(activeUsers90));

  section("2. COMPLIANCE COVERAGE  (% of total repos)");
  row("= License ==============================", "");
  row("  Has a license file:", pct(licensePresent, totalRepos));
  row("  License is valid (SPDX):", pct(licenseValid, totalRepos));
  row("= Metadata =============================", "");
  row("  Has codemeta.json:", pct(codemetaPresent, totalRepos));
  row("  codemeta.json is valid:", pct(codemetaValid, totalRepos));
  row("  Has CITATION.cff:", pct(citationPresent, totalRepos));
  row("  CITATION.cff is valid:", pct(citationValid, totalRepos));
  row("= Documentation ========================", "");
  row("  Has README:", pct(readmePresent, totalRepos));
  row("  Has CODE_OF_CONDUCT:", pct(cocPresent, totalRepos));
  row("  Has CONTRIBUTING:", pct(contributingPresent, totalRepos));
  row("= Workflows ============================", "");
  row("  Has CWL files:", pct(cwlPresent, totalRepos));

  section("3. FAIR SOFTWARE COMPLIANCE");
  row("  Fully compliant repos", `${pct(fullCompliantCount, totalRepos)}`);
  console.log("  (valid license + valid codemeta or CITATION.cff)");
  row("  FAIR-ready repos", `${pct(fairReadyCount, totalRepos)}`);
  console.log("  (has a license + has any metadata file)");
  row("  Orgs/owners with ≥1 compliant repo:", fmt(compliantOwners));

  section("4. ZENODO / ARCHIVAL");
  row("Total Zenodo depositions created:", fmt(totalDepositions));
  row("Published depositions:", fmt(publishedDepositions));
  row("Repos with a Zenodo DOI:", fmt(reposWithDoi));
  row("Lifetime releases archived to Zenodo:", fmt(sum.zenodo_release ?? 0));
  row("Lifetime GitHub releases created:", fmt(sum.create_release ?? 0));

  section("5. LIFETIME ACTIVITY  (actions codefair has taken)");
  row("License files created:", fmt(sum.license_created ?? 0));
  row("codemeta.json files updated:", fmt(sum.update_codemeta ?? 0));
  row("CITATION.cff files updated:", fmt(sum.update_citation ?? 0));
  row("README files updated:", fmt(sum.update_readme ?? 0));
  row("CODE_OF_CONDUCT files updated:", fmt(sum.update_code_of_conduct ?? 0));
  row("CONTRIBUTING files updated:", fmt(sum.update_contributing ?? 0));
  row("CWL files validated:", fmt(sum.cwl_validated_file_count ?? 0));
  row("Zenodo releases published:", fmt(sum.zenodo_release ?? 0));

  console.log(`\n${"=".repeat(60)}\n`);

  // JSON output
  const report = {
    generatedAt: now.toISOString(),
    adoption: {
      totalRepos,
      uniqueOwners,
      newRepos30Days: newRepos30,
      newRepos90Days: newRepos90,
      registeredUsers: totalUsers,
      activeUsers30Days: activeUsers30,
      activeUsers90Days: activeUsers90,
    },
    compliance: {
      license: {
        present: licensePresent,
        presentPct: totalRepos
          ? +((licensePresent / totalRepos) * 100).toFixed(1)
          : 0,
        valid: licenseValid,
        validPct: totalRepos
          ? +((licenseValid / totalRepos) * 100).toFixed(1)
          : 0,
      },
      codemeta: {
        present: codemetaPresent,
        presentPct: totalRepos
          ? +((codemetaPresent / totalRepos) * 100).toFixed(1)
          : 0,
        valid: codemetaValid,
        validPct: totalRepos
          ? +((codemetaValid / totalRepos) * 100).toFixed(1)
          : 0,
      },
      citation: {
        present: citationPresent,
        presentPct: totalRepos
          ? +((citationPresent / totalRepos) * 100).toFixed(1)
          : 0,
        valid: citationValid,
        validPct: totalRepos
          ? +((citationValid / totalRepos) * 100).toFixed(1)
          : 0,
      },
      readme: {
        present: readmePresent,
        presentPct: totalRepos
          ? +((readmePresent / totalRepos) * 100).toFixed(1)
          : 0,
      },
      codeOfConduct: {
        present: cocPresent,
        presentPct: totalRepos
          ? +((cocPresent / totalRepos) * 100).toFixed(1)
          : 0,
      },
      contributing: {
        present: contributingPresent,
        presentPct: totalRepos
          ? +((contributingPresent / totalRepos) * 100).toFixed(1)
          : 0,
      },
      cwl: {
        present: cwlPresent,
        presentPct: totalRepos
          ? +((cwlPresent / totalRepos) * 100).toFixed(1)
          : 0,
      },
    },
    fairCompliance: {
      fullyCompliant: fullCompliantCount,
      fullyCompliantPct: totalRepos
        ? +((fullCompliantCount / totalRepos) * 100).toFixed(1)
        : 0,
      fairReady: fairReadyCount,
      fairReadyPct: totalRepos
        ? +((fairReadyCount / totalRepos) * 100).toFixed(1)
        : 0,
      ownersWithCompliantRepo: compliantOwners,
    },
    zenodo: {
      totalDepositions,
      publishedDepositions,
      reposWithDoi,
      lifetimeReleasesArchived: sum.zenodo_release ?? 0,
      lifetimeReleasesCreated: sum.create_release ?? 0,
    },
    lifetimeActivity: {
      licensesCreated: sum.license_created ?? 0,
      codemetaUpdates: sum.update_codemeta ?? 0,
      citationUpdates: sum.update_citation ?? 0,
      readmeUpdates: sum.update_readme ?? 0,
      codeOfConductUpdates: sum.update_code_of_conduct ?? 0,
      contributingUpdates: sum.update_contributing ?? 0,
      cwlFilesValidated: sum.cwl_validated_file_count ?? 0,
      zenodoReleasesPublished: sum.zenodo_release ?? 0,
    },
  };

  const outPath = join(__dirname, "analytics.json");
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`  JSON report written to: ${outPath}\n`);
}

runAnalytics()
  .catch((err) => {
    console.error("Analytics failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
