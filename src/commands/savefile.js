// ─── /savefile — Upload an audio file to the bot ────────────────────
// Users attach an audio file; the bot downloads it to audio/ and
// records its metadata in audiofile.json.

import { SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { v4 as uuidv4 } from 'uuid';
import { add } from '../utils/audioStore.js';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const AUDIO_DIR  = join(__dirname, '..', '..', 'audio');
const ALLOWED    = new Set(['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.webm']);

export const data = new SlashCommandBuilder()
  .setName('savefile')
  .setDescription('Upload an audio file to the bot library')
  .addAttachmentOption((opt) =>
    opt.setName('file').setDescription('The audio file to upload').setRequired(true),
  )
  .addStringOption((opt) =>
    opt.setName('title').setDescription('Custom title for the track').setRequired(false),
  );

export async function execute(interaction) {
  const attachment = interaction.options.getAttachment('file');
  const customTitle = interaction.options.getString('title');

  // ── Validate extension ────────────────────────────────────────────
  const ext = extname(attachment.name).toLowerCase();
  if (!ALLOWED.has(ext)) {
    return interaction.reply({
      content: `❌ Unsupported file type **${ext}**. Allowed: ${[...ALLOWED].join(', ')}`,
      ephemeral: true,
    });
  }

  await interaction.deferReply();

  try {
    // ── Download the file ─────────────────────────────────────────────
    const id       = uuidv4();
    const fileName = `${id}${ext}`;
    const filePath = join(AUDIO_DIR, fileName);

    const res = await fetch(attachment.url);
    if (!res.ok) throw new Error(`Download failed: ${res.statusText}`);

    await pipeline(res.body, createWriteStream(filePath));

    // ── Save metadata ─────────────────────────────────────────────────
    const entry = add({
      id,
      title:        customTitle || attachment.name,
      originalName: attachment.name,
      fileName,
      filePath:     `audio/${fileName}`,
      size:         attachment.size,
      uploaderId:   interaction.user.id,
      uploaderName: interaction.user.username,
      uploadDate:   new Date().toISOString(),
    });

    await interaction.editReply(
      `✅ **${entry.title}** saved successfully!\n📁 ID: \`${entry.id}\``,
    );
  } catch (err) {
    console.error('[savefile]', err);
    await interaction.editReply('❌ Something went wrong while saving the file.');
  }
}
