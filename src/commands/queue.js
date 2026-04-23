// ─── /queue — Show the current playback queue ──────────────────────

import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getQueue } from '../player/musicPlayer.js';

export const data = new SlashCommandBuilder()
  .setName('queue')
  .setDescription('Show the current music queue');

export async function execute(interaction) {
  const { current, queue } = getQueue(interaction.guildId);

  if (!current && queue.length === 0) {
    return interaction.reply({ content: '📭 The queue is empty.', ephemeral: true });
  }

  const embed = new EmbedBuilder()
    .setTitle('🎵 Music Queue')
    .setColor(0x5865f2) // Discord blurple
    .setTimestamp();

  if (current) {
    embed.addFields({
      name: '🔊 Now Playing',
      value: `**${current.title}** (${current.source})`,
    });
  }

  if (queue.length > 0) {
    const list = queue
      .slice(0, 15) // show max 15
      .map((t, i) => `\`${i + 1}.\` ${t.title} — *${t.source}*`)
      .join('\n');

    embed.addFields({
      name: `📋 Up Next (${queue.length})`,
      value: list + (queue.length > 15 ? `\n…and ${queue.length - 15} more` : ''),
    });
  }

  await interaction.reply({ embeds: [embed] });
}
