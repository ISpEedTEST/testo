// ─── /play — Play audio from YouTube or local library ───────────────

import { SlashCommandBuilder } from 'discord.js';
import play from 'play-dl';
import { getAll } from '../utils/audioStore.js';
import { enqueue } from '../player/musicPlayer.js';

export const data = new SlashCommandBuilder()
  .setName('play')
  .setDescription('Play audio from YouTube or your local library')
  .addSubcommand((sub) =>
    sub
      .setName('youtube')
      .setDescription('Play from a YouTube URL or search query')
      .addStringOption((opt) =>
        opt.setName('query').setDescription('YouTube URL or search term').setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('local')
      .setDescription('Play a track from the bot library')
      .addStringOption((opt) =>
        opt
          .setName('name')
          .setDescription('Track name (start typing for suggestions)')
          .setRequired(true)
          .setAutocomplete(true),
      ),
  );

// ── Autocomplete handler ─────────────────────────────────────────────
export async function autocomplete(interaction) {
  const focused = interaction.options.getFocused().toLowerCase();
  const files = getAll();

  const choices = files
    .filter((f) => f.title.toLowerCase().includes(focused))
    .slice(0, 25)
    .map((f) => ({ name: f.title.slice(0, 100), value: f.id }));

  await interaction.respond(choices);
}

// ── Execute handler ──────────────────────────────────────────────────
export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  await interaction.deferReply();

  if (sub === 'youtube') {
    const query = interaction.options.getString('query');

    try {
      let url = query;

      // If not a URL, search YouTube
      if (!play.yt_validate(query)) {
        const results = await play.search(query, { limit: 1 });
        if (results.length === 0) {
          return interaction.editReply('❌ No results found on YouTube.');
        }
        url = results[0].url;
      }

      const info = await play.video_basic_info(url);
      const track = {
        title: info.video_details.title || query,
        source: 'youtube',
        url,
      };

      await enqueue(interaction, track);
    } catch (err) {
      console.error('[play youtube]', err);
      await interaction.editReply('❌ Could not play from YouTube. Check the URL/query.');
    }
  }

  if (sub === 'local') {
    const nameOrId = interaction.options.getString('name');
    const files = getAll();

    // Try exact ID match first (from autocomplete), then fuzzy title match
    let file = files.find((f) => f.id === nameOrId);
    if (!file) {
      const lower = nameOrId.toLowerCase();
      file = files.find((f) => f.title.toLowerCase() === lower);
    }
    if (!file) {
      const lower = nameOrId.toLowerCase();
      file = files.find((f) => f.title.toLowerCase().includes(lower));
    }

    if (!file) {
      return interaction.editReply(
        `❌ Track not found: **${nameOrId}**\nUse \`/library\` to see available tracks.`,
      );
    }

    const track = {
      title: file.title,
      source: 'local',
      filePath: file.filePath,
    };

    await enqueue(interaction, track);
  }
}
