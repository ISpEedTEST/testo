// ─── /skip — Skip the current track ─────────────────────────────────

import { SlashCommandBuilder } from 'discord.js';
import { skip, getQueue } from '../player/musicPlayer.js';

export const data = new SlashCommandBuilder()
  .setName('skip')
  .setDescription('Skip the currently playing track');

export async function execute(interaction) {
  const { current } = getQueue(interaction.guildId);

  if (!current) {
    return interaction.reply({ content: '❌ Nothing is playing right now.', ephemeral: true });
  }

  const skipped = skip(interaction.guildId);
  if (skipped) {
    await interaction.reply(`⏭️ Skipped: **${current.title}**`);
  } else {
    await interaction.reply({ content: '❌ Could not skip.', ephemeral: true });
  }
}
