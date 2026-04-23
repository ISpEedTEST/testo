// ─── Deploy Slash Commands ──────────────────────────────────────────
// Run once with: node src/deploy-commands.js
// Registers all slash commands globally for the configured guild.

import { REST, Routes } from 'discord.js';
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import config from './config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const commandsDir = join(__dirname, 'commands');

async function deploy() {
  const commands = [];

  const files = readdirSync(commandsDir).filter((f) => f.endsWith('.js'));

  for (const file of files) {
    const filePath = join(commandsDir, file);
    const mod = await import(pathToFileURL(filePath).href);
    if (mod.data) {
      commands.push(mod.data.toJSON());
      console.log(`  ✔ Loaded: /${mod.data.name}`);
    }
  }

  const rest = new REST({ version: '10' }).setToken(config.token);

  console.log(`\n⏳ Registering ${commands.length} slash commands…`);

  await rest.put(
    Routes.applicationGuildCommands(config.clientId, config.guildId),
    { body: commands },
  );

  console.log(`✅ Successfully registered ${commands.length} commands!\n`);
}

deploy().catch(console.error);
