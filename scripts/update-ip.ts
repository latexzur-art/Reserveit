import { networkInterfaces } from 'os';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Automatically detects the current machine's active local network IPv4 address
 * and updates `.env.local`'s NEXT_PUBLIC_APP_URL and CORS_ORIGIN variables dynamically.
 */
function updateLocalIP() {
  console.log('🔍 Detecting active local network IPv4...');

  const nets = networkInterfaces();
  let detectedIP: string | null = null;

  // Search through all network interfaces
  for (const name of Object.keys(nets)) {
    const interfaces = nets[name] || [];
    for (const net of interfaces) {
      // Find non-internal IPv4 addresses
      if (net.family === 'IPv4' && !net.internal) {
        // Prioritize common active interface names (Wi-Fi, Ethernet, wireless, etc.)
        const lowerName = name.toLowerCase();
        if (lowerName.includes('wi-fi') || lowerName.includes('ethernet') || lowerName.includes('wlan') || lowerName.includes('wireless')) {
          detectedIP = net.address;
          break;
        }
        // Fallback to any other active non-internal IPv4
        if (!detectedIP) {
          detectedIP = net.address;
        }
      }
    }
    if (detectedIP && (name.toLowerCase().includes('wi-fi') || name.toLowerCase().includes('ethernet'))) {
      break;
    }
  }

  if (!detectedIP) {
    console.log('⚠️ Could not detect an active local network IPv4 address. Defaulting to localhost.');
    detectedIP = 'localhost';
  }

  console.log(`✨ Detected local IP: ${detectedIP}`);

  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) {
    console.error('❌ .env.local file not found in the workspace root.');
    return;
  }

  let envContent = fs.readFileSync(envPath, 'utf8');

  // Regex to match NEXT_PUBLIC_APP_URL and CORS_ORIGIN lines
  const appUrlRegex = /^(NEXT_PUBLIC_APP_URL\s*=\s*http:\/\/)[^:\n\r]+(:\d+)?(.*)$/m;
  const corsRegex = /^(CORS_ORIGIN\s*=\s*http:\/\/)[^:\n\r]+(:\d+)?(.*)$/m;

  let updated = false;

  if (appUrlRegex.test(envContent)) {
    envContent = envContent.replace(appUrlRegex, `$1${detectedIP}$2$3`);
    updated = true;
  } else {
    // If not exists, append it
    envContent += `\nNEXT_PUBLIC_APP_URL=http://${detectedIP}:3000`;
    updated = true;
  }

  if (corsRegex.test(envContent)) {
    envContent = envContent.replace(corsRegex, `$1${detectedIP}$2$3`);
  }

  if (updated) {
    fs.writeFileSync(envPath, envContent, 'utf8');
    console.log(`✅ Successfully updated .env.local with NEXT_PUBLIC_APP_URL=http://${detectedIP}:3000`);
    console.log(`🔗 Access your app network-wide at: http://${detectedIP}:3000`);
  } else {
    console.log('ℹ️ No environment variables needed updating.');
  }
}

updateLocalIP();
