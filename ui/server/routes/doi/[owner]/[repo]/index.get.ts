export default defineEventHandler(async (event) => {
  // This endpoint will act as a redirect to a user's doi deposition on zenodo
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

  return sendRedirect(
    event,
    `https://doi.org/${zenodo.last_published_zenodo_doi}`,
  );
});
