import { Checkout } from "@polar-sh/nextjs";

export const GET = Checkout({
  accessToken: process.env.POLAR_ACCESS_TOKEN,
  successUrl: process.env.POLAR_SUCCESS_URL,
  // Use sandbox in development if configured
  server: (process.env.POLAR_SERVER as "sandbox" | "production") || undefined,
});


