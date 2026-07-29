import licensesJSON from "@/assets/data/licenses.json";
import { logwatch } from "~/server/utils/logwatch";

// The upstream SPDX lookup is a network call; cap it so a slow or unreachable
// spdx.org can't hold a server request open indefinitely.
const SPDX_FETCH_TIMEOUT_MS = 10_000;

export default defineEventHandler(async (event) => {
  // Only ever called from the license editor, which is already behind the
  // `protected` middleware. Requiring a session keeps this from being used as
  // an open outbound-fetch proxy.
  protectRoute(event);

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

  let responseDate;

  try {
    const response = await fetch(licenseDetailsUrl, {
      signal: AbortSignal.timeout(SPDX_FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`SPDX responded with ${response.status}`);
    }

    responseDate = await response.json();
  } catch (error) {
    logwatch.error({
      action: "request:license",
      error: error instanceof Error ? error.message : String(error),
      licenseId: licenseid,
      message: "Failed to fetch license details from SPDX",
    });

    throw createError({
      statusCode: 502,
      statusMessage: "license-details-fetch-failed",
    });
  }

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
