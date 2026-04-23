// ─── /library — List your uploaded audio files ─────────────────────

import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getByUser } from '../utils/audioStore.js';

export const data = new SlashCommandBuilder()
  .setName('library')
  .setDescription('List all audio files you have uploaded');

export async function execute(interaction) {
  const files = getByUser(interaction.user.id);

  if (files.length === 0) {
    return interaction.reply({
      content: '📭 You haven\'t uploaded any files yet. Use `/savefile` to add one!',
      ephemeral: true,
    });
  }

  const list = files
    .slice(0, 20)
    .map(
      (f, i) =>
        `\`${i + 1}.\` **${f.title}**\n` +
        `   ▸ ${(f.size / 1024 / 1024).toFixed(2)} MB • <t:${Math.floor(new Date(f.uploadDate).getTime() / 1000)}:R>`,
    )
    .join('\n');

  const embed = new EmbedBuilder()
    .setTitle('📚 Your Audio Library')
    .setDescription(list + (files.length > 20 ? `\n…and ${files.length - 20} more` : ''))
    .setColor(0x5865f2)
    .setFooter({ text: '💡 Use /play local <name> to play a track' })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}
