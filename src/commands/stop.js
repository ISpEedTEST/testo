// ─── /stop — Stop playback and disconnect ───────────────────────────

import { SlashCommandBuilder } from 'discord.js';
import { stop } from '../player/musicPlayer.js';

export const data = new SlashCommandBuilder()
  .setName('stop')
  .setDescription('Stop the music and disconnect the bot from voice');

export async function execute(interaction) {
  const success = stop(interaction.guildId);

  if (success) {
    await interaction.reply('⏹️ Stopped playback and disconnected.');
  } else {
    await interaction.reply({ content: '❌ Nothing is playing right now.', ephemeral: true });
  }
}
