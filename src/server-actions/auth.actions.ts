"use server";

import { redirect } from "next/navigation";
import type { AuthActionState } from "@/types/auth";
import { loginSchema } from "@/schemas/auth.schema";
import { authenticateUser } from "@/services/auth.service";
import { clearSessionCookie, setSessionCookie, signSessionToken } from "@/lib/session";

export async function loginAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const payload = {
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    rememberMe: formData.get("rememberMe") === "on",
  };

  const parsed = loginSchema.safeParse(payload);

  if (!parsed.success) {
    const formatted = parsed.error.flatten().fieldErrors;

    return {
      success: false,
      message: "Please fix form validation errors",
      fieldErrors: {
        email: formatted.email?.[0],
        password: formatted.password?.[0],
      },
    };
  }

  const authResult = await authenticateUser(parsed.data);

  if (!authResult) {
    return {
      success: false,
      message: "Invalid email or password",
    };
  }

  const { token, maxAge } = await signSessionToken(
    {
      id: authResult.user.id,
      email: authResult.user.email,
      fullName: authResult.user.fullName,
    },
    authResult.rememberMe,
  );

  await setSessionCookie(token, maxAge);

  redirect("/");
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  redirect("/login");
}
