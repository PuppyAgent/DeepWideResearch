import { Checkout } from '@polar-sh/nextjs'

const serverEnv = (process.env.POLAR_SERVER || '').toLowerCase()
const server =
  serverEnv === 'sandbox' || serverEnv === 'production'
    ? (serverEnv as 'sandbox' | 'production')
    : undefined

export const GET = Checkout({
  accessToken: process.env.POLAR_ACCESS_TOKEN!,
  successUrl: process.env.POLAR_SUCCESS_URL,
  server,
})


