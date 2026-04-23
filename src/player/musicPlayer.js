// ─── Music Player Engine ────────────────────────────────────────────
// Manages per-guild voice connections, audio players, and track queues.
// Supports both local files and YouTube streams.
// NOTE: Voice requires UDP — will not work on cloud IDEs (Firebase Studio, etc.)

import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  NoSubscriberBehavior,
} from '@discordjs/voice';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import play from 'play-dl';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..');

// Detect cloud environment (Firebase Studio, Codespaces, etc.)
const IS_CLOUD = !!(process.env.IDX_CHANNEL || process.env.CODESPACES || process.env.CLOUD_SHELL);

// Guild-scoped player states:  Map<guildId, GuildPlayer>
const players = new Map();

// ── Helpers ──────────────────────────────────────────────────────────

/** Get or create a GuildPlayer for the given guild. */
function getGuildPlayer(guildId) {
  if (!players.has(guildId)) {
    players.set(guildId, {
      connection: null,
      player:     null,
      queue:      [],   // { title, source: 'local'|'youtube', url|filePath }
      current:    null,
    });
  }
  return players.get(guildId);
}

/** Create an AudioResource from a track object. */
async function createResource(track) {
  if (track.source === 'local') {
    const absPath = join(PROJECT_ROOT, track.filePath);
    console.log('[Player] Creating resource from local file:', absPath);
    return createAudioResource(absPath, { inlineVolume: true });
  }

  // YouTube stream via play-dl
  console.log('[Player] Streaming from YouTube:', track.url);
  const stream = await play.stream(track.url);
  return createAudioResource(stream.stream, {
    inputType: stream.type,
    inlineVolume: true,
  });
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Connect to the voice channel, enqueue the track, and start playing
 * if nothing is already playing.
 */
export async function enqueue(interaction, track) {
  const gp = getGuildPlayer(interaction.guildId);
  const voiceChannel = interaction.member?.voice?.channel;

  if (!voiceChannel) {
    return interaction.editReply('❌ You must be in a voice channel first!');
  }

  // Join the channel if not already connected
  if (
    !gp.connection ||
    gp.connection.state.status === VoiceConnectionStatus.Disconnected ||
    gp.connection.state.status === VoiceConnectionStatus.Destroyed
  ) {
    console.log(`[Voice] Joining channel: ${voiceChannel.name} (${voiceChannel.id})`);

    if (IS_CLOUD) {
      console.warn('[Voice] ⚠️  Cloud environment detected — UDP may be blocked.');
    }

    gp.connection = joinVoiceChannel({
      channelId:      voiceChannel.id,
      guildId:        interaction.guildId,
      adapterCreator: interaction.guild.voiceAdapterCreator,
      selfDeaf:       true,
    });

    // Debug: log every state change
    gp.connection.on('stateChange', (oldState, newState) => {
      console.log(`[Voice] Connection: ${oldState.status} → ${newState.status}`);
    });

    // Handle unexpected disconnects — try to reconnect
    gp.connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        // Try to reconnect within 5 seconds
        await Promise.race([
          entersState(gp.connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(gp.connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
        // Seems to be reconnecting, wait for Ready
      } catch {
        // Not reconnecting — destroy
        if (gp.connection.state.status !== VoiceConnectionStatus.Destroyed) {
          gp.connection.destroy();
        }
      }
    });

    // Attempt to enter Ready state within 15 seconds
    try {
      await entersState(gp.connection, VoiceConnectionStatus.Ready, 15_000);
      console.log('[Voice] Connected successfully!');
    } catch (err) {
      console.error('[Voice] Failed to reach Ready state:', err?.message || err);
      if (gp.connection.state.status !== VoiceConnectionStatus.Destroyed) {
        gp.connection.destroy();
      }
      gp.connection = null;

      // Give a clear error message depending on environment
      if (IS_CLOUD) {
        return interaction.editReply(
          '❌ **Voice is not supported on Firebase Studio.**\n' +
          '> Cloud environments block UDP connections required for Discord audio.\n' +
          '> Run the bot on your **PC** or a **VPS** for voice playback.\n\n' +
          '✅ All other commands work fine here: `/savefile`, `/library`, `/queue`'
        );
      }

      return interaction.editReply(
        '❌ Could not connect to the voice channel.\n' +
        '> Check bot permissions and make sure FFmpeg is installed.\n' +
        '> Try again in a few seconds.'
      );
    }
  }

  // Create player if needed
  if (!gp.player) {
    gp.player = createAudioPlayer({
      behaviors: { noSubscriber: NoSubscriberBehavior.Play },
    });

    gp.player.on('stateChange', (oldState, newState) => {
      console.log(`[Player] ${oldState.status} → ${newState.status}`);
    });

    gp.player.on(AudioPlayerStatus.Idle, () => {
      // Current track finished — play next in queue
      gp.current = null;
      playNext(interaction.guildId);
    });

    gp.player.on('error', (err) => {
      console.error('[Player Error]', err.message);
      gp.current = null;
      playNext(interaction.guildId);
    });

    gp.connection.subscribe(gp.player);
  }

  // Add to queue
  gp.queue.push(track);

  // If nothing is playing, kick off the queue
  if (!gp.current) {
    playNext(interaction.guildId);
    return interaction.editReply(`🎶 Now playing: **${track.title}**`);
  }

  return interaction.editReply(
    `📥 Queued: **${track.title}** (position #${gp.queue.length})`,
  );
}

/** Play the next track in the queue. */
async function playNext(guildId) {
  const gp = getGuildPlayer(guildId);
  if (gp.queue.length === 0) {
    // Nothing left — disconnect after a short delay
    gp.current = null;
    setTimeout(() => {
      const g = players.get(guildId);
      if (g && !g.current && g.queue.length === 0 && g.connection) {
        g.connection.destroy();
        g.connection = null;
        g.player = null;
      }
    }, 120_000); // 2 min idle timeout
    return;
  }

  const track = gp.queue.shift();
  gp.current  = track;

  try {
    const resource = await createResource(track);
    gp.player.play(resource);
  } catch (err) {
    console.error('[playNext]', err);
    playNext(guildId); // skip broken track
  }
}

/** Skip the currently playing track. */
export function skip(guildId) {
  const gp = getGuildPlayer(guildId);
  if (!gp.player) return false;
  gp.player.stop(); // triggers Idle → playNext
  return true;
}

/** Stop playback, clear queue, disconnect. */
export function stop(guildId) {
  const gp = players.get(guildId);
  if (!gp) return false;

  gp.queue   = [];
  gp.current = null;
  if (gp.player)     gp.player.stop();
  if (gp.connection) gp.connection.destroy();
  gp.player     = null;
  gp.connection = null;
  players.delete(guildId);
  return true;
}

/** Return the current queue array (readonly copy). */
export function getQueue(guildId) {
  const gp = players.get(guildId);
  if (!gp) return { current: null, queue: [] };
  return { current: gp.current, queue: [...gp.queue] };
}
