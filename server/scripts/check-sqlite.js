const { execSync } = require('child_process');
const path = require('path');

console.log('[Check-SQLite] Verifying better-sqlite3 native binding...');

try {
  const Database = require('better-sqlite3');
  // Try to open a memory database to trigger the binding load
  new Database(':memory:');
  console.log('[Check-SQLite] better-sqlite3 is compatible with current Node.js version.');
} catch (e) {
  const isMismatch = e.message.includes('NODE_MODULE_VERSION') || 
                     e.message.includes('was compiled against a different Node.js version') ||
                     e.code === 'ERR_DLOPEN_FAILED';

  if (isMismatch) {
    console.log('[Check-SQLite] Node version mismatch detected. Rebuilding better-sqlite3...');
    try {
      execSync('npm rebuild better-sqlite3', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
      console.log('[Check-SQLite] Rebuild successful.');
    } catch (rebuildError) {
      console.error('[Check-SQLite] Failed to rebuild better-sqlite3:', rebuildError);
      process.exit(1);
    }
  } else {
    console.error('[Check-SQLite] Unexpected error loading better-sqlite3:', e);
    throw e;
  }
}
