import { cp, mkdir, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const publicDirectory = fileURLToPath(new URL('../public/', import.meta.url))
const userBuild = fileURLToPath(new URL('../apps/user-app/dist/', import.meta.url))
const adminBuild = fileURLToPath(new URL('../apps/admin-app/dist/', import.meta.url))

await rm(publicDirectory, { recursive: true, force: true })
await mkdir(publicDirectory, { recursive: true })
await cp(userBuild, publicDirectory, { recursive: true })
await cp(adminBuild, `${publicDirectory}/admin`, { recursive: true })

console.log(`Prepared Vercel public assets in ${publicDirectory.replace(root, '')}`)
