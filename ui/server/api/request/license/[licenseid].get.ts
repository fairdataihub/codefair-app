import licensesJSON from "@/assets/data/licenses.json";

export default defineEventHandler(async (event) => {
  const { licenseid } = event.context.params as { licenseid: string };

  const license = licensesJSON.find(
    (license) => license.licenseId === licenseid,
  );

  if (!license) {
    throw createError({
      statusCode: 404,
      statusMessage: "License not found",
    });
  }

  // Request the license text from the license server
  const licenseDetailsUrl = license.detailsUrl;

  const response = await fetch(licenseDetailsUrl);
  const responseDate = await response.json();

  return {
    licenseText: (responseDate.licenseText as string) || "",
    licenseStandardTemplate:
      (responseDate.licenseStandardTemplate as string) || "",
    licenseName: (responseDate.licenseName as string) || "",
    licenseId: (responseDate.licenseId as string) || "",
    licenseSeeAlso: (responseDate.licenseSeeAlso as string[]) || [],
    licenseIsOsiApproved: responseDate.licenseIsOsiApproved as boolean,
    licenseTextHtml: (responseDate.licenseTextHtml as string) || "",
  };
});
