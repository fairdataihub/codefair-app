import type { User } from "lucia";

export const useUser = () => {
  return useState<User | null>("user", () => null);
};

export const useAuthenticatedUser = () => {
  const user = useUser();
  return computed(() => {
    const userValue = unref(user);
    if (!userValue) {
      throw createError(
        "useAuthenticatedUser() can only be used in protected pages",
      );
    }
    return userValue;
  });
};
