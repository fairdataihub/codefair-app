import { makeBadge } from "badge-maker";

export default defineEventHandler(async (event) => {
  const { owner, repo } = event.context.params as {
    owner: string;
    repo: string;
  };

  // Fetch zenodo doi details from the database
  const zenodo = await prisma.zenodoDeposition.findFirst({
    where: {
      repository: {
        owner,
        repo,
      },
    },
  });

  if (!zenodo) {
    throw createError({
      statusCode: 404,
      statusMessage: "zenodo-not-found",
    });
  }

  console.log(
    "zenodo.last_published_zenodo_doi",
    zenodo.last_published_zenodo_doi,
  );
  console.log("Creating badge");

  const format = {
    label: "DOI",
    message: `${zenodo.last_published_zenodo_doi}`,
    color: "blue",
  };

  // Create the badge with badge-maker
  // Svg string is stored in the badge variable
  const badge = makeBadge(format);

  // Set the response header to indicate SVG content
  setHeader(event, "Content-Type", "image/svg+xml");

  // Return the SVG string directly
  return badge;
});
