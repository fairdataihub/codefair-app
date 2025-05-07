import { init } from "@paralleldrive/cuid2";

export const createId = init({
  fingerprint: "a-custom-host-fingerprint",
  length: 10,
  random: Math.random,
});
