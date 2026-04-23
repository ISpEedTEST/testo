// ─── Entry Point ────────────────────────────────────────────────────
// Boots the Discord bot and Express web dashboard in a single process.

import { Client, Collection, Events, GatewayIntentBits } from 'discord.js';
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import express from 'express';
import config from './config.js';
import apiRouter from './routes/api.js';
import { getAll } from './utils/audioStore.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');

// ── Discord Client ──────────────────────────────────────────────────

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

client.commands = new Collection();

// Dynamic command loader
const commandsDir = join(__dirname, 'commands');
const commandFiles = readdirSync(commandsDir).filter((f) => f.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = join(commandsDir, file);
  const mod = await import(pathToFileURL(filePath).href);
  if (mod.data && mod.execute) {
    client.commands.set(mod.data.name, mod);
    console.log(`  ✔ Command loaded: /${mod.data.name}`);
  }
}

// ── Interaction Handler ─────────────────────────────────────────────

client.on(Events.InteractionCreate, async (interaction) => {
  // ── Autocomplete (e.g. /play local name suggestions) ───────────────
  if (interaction.isAutocomplete()) {
    const command = client.commands.get(interaction.commandName);
    if (command?.autocomplete) {
      try {
        await command.autocomplete(interaction);
      } catch (err) {
        console.error('[Autocomplete Error]', err);
      }
    }
    return;
  }

  // ── Slash Commands ─────────────────────────────────────────────────
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) {
    console.warn(`⚠️  Unknown command: /${interaction.commandName}`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(`[Command Error] /${interaction.commandName}:`, err);
    const reply = { content: '❌ Something went wrong.', ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(reply);
    } else {
      await interaction.reply(reply);
    }
  }
});

// ── Bot Ready ────────────────────────────────────────────────────────

client.once(Events.ClientReady, (c) => {
  console.log(`\n🤖 Bot online as: ${c.user.tag}`);
  console.log(`   Guilds: ${c.guilds.cache.size}`);
});

// ── Express Web Dashboard ────────────────────────────────────────────

const app = express();

app.use(express.json());
app.use('/api', apiRouter);

// Serve dashboard static files
app.use(express.static(join(PROJECT_ROOT, 'dashboard')));

// SPA fallback
app.get('*', (_req, res) => {
  res.sendFile(join(PROJECT_ROOT, 'dashboard', 'index.html'));
});

// ── Start Everything ─────────────────────────────────────────────────

app.listen(config.port, () => {
  console.log(`\n🌐 Dashboard: http://localhost:${config.port}`);
});

client.login(config.token);
