// ─── Configuration Loader ───────────────────────────────────────────
// Reads .env and exports a frozen config object used across the app.

import 'dotenv/config';

const config = Object.freeze({
  // Discord
  token:    process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId:  process.env.GUILD_ID,

  // Web dashboard — Firebase Studio uses PORT env variable
  port: parseInt(process.env.PORT, 10) || 3000,
});

// Validate required keys on startup
const required = ['token', 'clientId', 'guildId'];
for (const key of required) {
  if (!config[key]) {
    console.error(`❌  Missing required env variable: ${key.toUpperCase()}`);
    process.exit(1);
  }
}

export default config;
