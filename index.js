// index.js
// ──────────────────────────────────────────────────────────────────────────────

// 1) Load your Discord token from environment (keep it secret!)
require('dotenv').config();

const { Client, GatewayIntentBits } = require('discord.js');
const { Player, QueueRepeatMode }   = require('discord-player');
const { YoutubeiExtractor }         = require('discord-player-youtubei');
const express                       = require('express');

////////////////////////////////////////////////////////////////////////////////
// 2) CONFIG — hard-coded IDs & default YouTube stream URL

const GUILD_ID           = '1334623606977728584';
const VOICE_CHANNEL_ID   = '1370499249980051596';
const CONTROL_CHANNEL_ID = '1370503771620114595';

let RADIO_SOURCE = 'https://www.youtube.com/watch?v=_k-5U7IeK8g';

////////////////////////////////////////////////////////////////////////////////
// 3) Create the Discord client

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

////////////////////////////////////////////////////////////////////////////////
// 4) Instantiate the Player

const player = new Player(client);

////////////////////////////////////////////////////////////////////////////////
// 5) Helper: startRadio connects, plays & loops indefinitely

async function startRadio(sourceUrl) {
  const guild   = client.guilds.cache.get(GUILD_ID);
  const channel = guild?.channels.cache.get(VOICE_CHANNEL_ID);

  if (!channel?.isVoiceBased()) {
    throw new Error('Voice channel not found — check VOICE_CHANNEL_ID');
  }

  // Tear down any existing queue
  const oldQueue = player.nodes.get(GUILD_ID);
  if (oldQueue) await oldQueue.delete();

  // Create a fresh, never-leaving, looping queue
  const queue = player.nodes.create(channel, {
    metadata: { textChannel: null },
    leaveOnEmpty: false,
    leaveOnEnd:   false
  });

  await queue.connect(channel);
  await queue.play(sourceUrl, {
    nodeOptions: { metadata: { source: '24/7-radio' } }
  });
  queue.setRepeatMode(QueueRepeatMode.QUEUE);

  console.log(`🎶 Radio now playing: ${sourceUrl}`);
}

////////////////////////////////////////////////////////////////////////////////
// 6) When ready: register extractor and immediately start the radio

client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  try {
    // Register YouTube extractor with progressive A/V → audio-only fallback
    await player.extractors.register(YoutubeiExtractor, {
      downloadOptions: [
        { quality: 'best',         filter: 'audioandvideo' },
        { quality: 'highestaudio', filter: 'audioonly'    }
      ]
    });
    console.log('✅ YoutubeiExtractor registered.');

    // Immediately start the 24/7 stream
    await startRadio(RADIO_SOURCE);
    console.log('🚀 24/7 radio started.');
  } catch (err) {
    console.error('❌ Failed to start radio or register extractor:', err);
  }
});

////////////////////////////////////////////////////////////////////////////////
// 7) Command handler: change the stream via !radio <YouTube URL>

client.on('messageCreate', async message => {
  if (message.author.bot) return;
  if (message.channel.id !== CONTROL_CHANNEL_ID) return;

  const [ cmd, url ] = message.content.trim().split(/\s+/);
  if (cmd.toLowerCase() !== '!radio' || !url) {
    return message.channel.send('❗ Usage: `!radio <YouTube URL>`');
  }
  if (!url.startsWith('http')) {
    return message.channel.send('❗ Please provide a valid URL.');
  }

  try {
    RADIO_SOURCE = url;
    await startRadio(RADIO_SOURCE);
    message.channel.send(`🔁 Radio source changed to:\n${RADIO_SOURCE}`);
  } catch (err) {
    console.error('❌ Error switching radio:', err);
    message.channel.send('❌ Could not switch the radio—see logs for details.');
  }
});

////////////////////////////////////////////////////////////////////////////////
// 8) Log in to Discord

client.login(process.env.DISCORD_TOKEN)
  .then(() => console.log('🚀 Bot login complete.'))
  .catch(err => console.error('❌ Bot login failed—check your DISCORD_TOKEN:', err));

////////////////////////////////////////////////////////////////////////////////
// 9) Keep-alive HTTP server for Fly.io healthchecks

const app  = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('OK'));
app.listen(port, () => {
  console.log(`✅ Keep-alive server listening on port ${port}`);
});
