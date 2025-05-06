import prisma from "../../db.js";
import { createId } from "../../utils/tools/index.js";
const CODEFAIR_DOMAIN = process.env.CODEFAIR_APP_DOMAIN;
const db = prisma;

export async function applyAdditionalChecksTemplate(
  subjects,
  template,
  repository,
  owner,
  context
) {
  // 1) Prepare identifier and badge URL
  let contribIdentifier, cofcIdentifier, contribBadgeUrl, cofcBadgeUrl;

  try {
    contribIdentifier = createId();
    cofcIdentifier = createId();
    contribBadgeUrl = `${CODEFAIR_DOMAIN}/dashboard/${owner}/${repository.name}/edit/contributing`;
    cofcBadgeUrl = `${CODEFAIR_DOMAIN}/dashboard/${owner}/${repository.name}/edit/code-of-conduct`;
  } catch (error) {
    throw new Error(
      `Failed to initialize ADDITIONAL CHECKS template parameters: ${error.message}`,
      { cause: error }
    );
  }

  // 2) Upsert data to contributingValidation and codeOfConductValidation tables
  try {
    const existingContrib = await db.contributingValidation.findUnique({
      where: { repository_id: repository.id },
    });
    const existingCofc = await db.codeofConductValidation.findUnique({
      where: { repository_id: repository.id },
    });

    const upsertContribData = {
      contains_contrib: subjects.contributing.status,
      contrib_content: subjects.contributing.content,
      contrib_path: subjects.contributing.path,
    };
    const upsertCofcData = {
      contains_code: subjects.cofc.status,
      code_content: subjects.cofc.content,
      code_path: subjects.cofc.path,
    };

    if (existingContrib) {
      await db.contributingValidation.update({
        where: { id: existingContrib.id },
        data: upsertContribData,
      });
    } else {
      await db.contributingValidation.create({
        data: {
          identifier: contribIdentifier,
          ...upsertContribData,
          repository: { connect: { id: repository.id } },
        },
      });
    }

    if (existingCofc) {
      await db.codeofConductValidation.update({
        where: { id: existingCofc.id },
        data: upsertCofcData,
      });
    } else {
      await db.codeofConductValidation.create({
        data: {
          identifier: cofcIdentifier,
          ...upsertCofcData,
          repository: { connect: { id: repository.id } },
        },
      });
    }
  } catch (error) {
    throw new Error(
      `Database error in applyAdditionalChecksTemplate: ${error.message}`,
      { cause: error }
    );
  }

  // 3) Prepare the template data
  try {
    const additionalSubjects = [
      {
        label: "CONTRIBUTING.md",
        url: contribBadgeUrl,
        status: subjects.contributing.status,
        reason:
          "Provides guidelines for contributors, reducing onboarding friction.",
        badge: `${subjects.contributing.status ? "Edit" : "Create"}_CONTRIBUTING-${
          subjects.contributing.status ? "0ea5e9" : "dc2626"
        }`,
      },
      {
        label: "CODE_OF_CONDUCT.md",
        url: cofcBadgeUrl,
        status: subjects.cofc.status,
        reason:
          "Sets the tone for community interactions, fostering inclusivity.",
        badge: `${subjects.cofc.status ? "Edit" : "Create"}_CODE_OF_CONDUCT-${
          subjects.cofc.status ? "0ea5e9" : "dc2626"
        }`,
      },
    ];

    const overallStatusEmoji = additionalSubjects.every(
      (subject) => subject.status
    )
      ? "✔️"
      : "❗";

    const rows = additionalSubjects
      .map(
        ({ label, reason, url, badge }) =>
          `| ${label} | ${reason} | [![${label}](https://img.shields.io/badge/${badge}.svg)](${url}) |`
      )
      .join("\n");

    const section = `## Additional Recommendations ${overallStatusEmoji}\n\nAlthough these files aren’t part of the core FAIR compliance checks, Codefair recommends including them to improve project governance, community engagement, and contributor experience:\n\n| Item             | Why it matters                                                                 | Action                                                                                               |\n| ---------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |\n${rows}\n\n`;

    return `${template}\n\n${section}`;
  } catch (error) {
    throw new Error(
      `Failed to prepare template data in applyAdditionalChecksTemplate: ${error.message}`,
      { cause: error }
    );
  }
}
