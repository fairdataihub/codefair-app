import { defineEventHandler } from "h3";
// import { ensureZenodoToken } from "@/server/utils/ensureToken";

export default defineEventHandler(async (event) => {
  // FIXME: replace this with your actual test user ID or pull from session
  const TEST_USER_ID = "tkiu772g3yqi36sg";
  // const rec = await prisma.zenodoToken.findFirst({
  //   where: { user_id: TEST_USER_ID },
  // });
  // console.l?og("Zenodo token record:", JSON.stringify(rec, null, 2));
  // Pass `true` to force the refresh branch even if not expired
  // const newToken = await ensureZenodoToken(
  //   TEST_USER_ID,
  //   /* forceRefresh= */ true,
  // );
  // return { newToken };
});
