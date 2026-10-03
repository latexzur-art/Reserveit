import fs from 'fs'
import path from 'path'

const envPath = path.join(process.cwd(), '.env.local')
const mode = process.argv[2]?.toLowerCase()

if (!fs.existsSync(envPath)) {
  console.error('❌ .env.local file not found at:', envPath)
  process.exit(1)
}

let content = fs.readFileSync(envPath, 'utf8')

const localEnv = Object.fromEntries(
  content.split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (!match) return []
    return [[match[1], match[2].replace(/^(["'])(.*)\1$/, '$2')]]
  }),
)

function getEnv(key) {
  return (process.env[key] || localEnv[key] || '').replace(/^(["'])(.*)\1$/, '$2')
}

const STI_CONFIG = {
  clientId: getEnv('AZURE_STI_CLIENT_ID'),
  clientSecret: getEnv('AZURE_STI_CLIENT_SECRET'),
  tenantId: getEnv('AZURE_STI_TENANT_ID'),
}

const TEST_CONFIG = {
  clientId: getEnv('AZURE_TEST_CLIENT_ID'),
  clientSecret: getEnv('AZURE_TEST_CLIENT_SECRET'),
  tenantId: getEnv('AZURE_TEST_TENANT_ID'),
}

if (mode === 'status') {
  if (content.includes(`AZURE_TENANT_ID=${STI_CONFIG.tenantId}`)) {
    console.log('⚡ Active Tenant: STI College Lucena Directory (Live)')
    console.log('   Tenant ID:', STI_CONFIG.tenantId)
  } else if (content.includes(`AZURE_TENANT_ID=${TEST_CONFIG.tenantId}`)) {
    console.log('🧪 Active Tenant: ReserveIT Dev Test Tenant')
    console.log('   Tenant ID:', TEST_CONFIG.tenantId)
  } else {
    console.log('❓ Active Tenant: Unknown or Custom Tenant')
  }
  process.exit(0)
}

if (mode !== 'sti' && mode !== 'test') {
  console.log('Usage:')
  console.log('  npm run env:tenant:sti     -> Switch to STI College Lucena (Live)')
  console.log('  npm run env:tenant:test    -> Switch to ReserveIT Test Tenant')
  console.log('  npm run env:tenant:status  -> Print current active tenant')
  process.exit(1)
}

const targetConfig = mode === 'sti' ? STI_CONFIG : TEST_CONFIG
const targetName = mode === 'sti' ? 'STI' : 'Test'
if (!targetConfig.clientId || !targetConfig.clientSecret || !targetConfig.tenantId) {
  console.error(`Azure ${mode} tenant profile is incomplete in .env.local`)
  process.exit(1)
}

// Update AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID
content = content.replace(/^AZURE_CLIENT_ID=.*/m, `AZURE_CLIENT_ID=${targetConfig.clientId}`)
content = content.replace(/^AZURE_CLIENT_SECRET=.*/m, `AZURE_CLIENT_SECRET=${targetConfig.clientSecret}`)
content = content.replace(/^AZURE_TENANT_ID=.*/m, `AZURE_TENANT_ID=${targetConfig.tenantId}`)

fs.writeFileSync(envPath, content, 'utf8')

console.log(`✅ Successfully switched .env.local to: ${targetName}`)
console.log(`   AZURE_TENANT_ID: ${targetConfig.tenantId}`)
console.log(`   AZURE_CLIENT_ID: ${targetConfig.clientId}`)
