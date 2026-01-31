process.env.FFMPEG_PATH = __dirname + "\\ffmpeg\\bin\\ffmpeg.exe";
require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { 
  joinVoiceChannel, 
  createAudioPlayer, 
  createAudioResource, 
  AudioPlayerStatus,
  entersState,
  VoiceConnectionStatus
} = require('@discordjs/voice');
const path = require('path');
const fs = require('fs');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ]
});

// Funzione per creare una nuova risorsa audio
function createRainResource() {
  const audioPath = path.join(__dirname, 'sounds', 'rain.mp3');
  
  // Verifica che il file esista
  if (!fs.existsSync(audioPath)) {
    console.error('❌ File audio non trovato:', audioPath);
    return null;
  }
  
  console.log('✅ File audio trovato:', audioPath);
  
  const resource = createAudioResource(audioPath, { 
    inlineVolume: true
  });
  
  resource.volume.setVolume(0.5);
  return resource;
}

const activeConnections = new Map(); // Per evitare connessioni duplicate

client.once('ready', () => {
  console.log('🌧️ Ambient bot online');
  console.log('📁 Directory corrente:', __dirname);
  console.log('🎵 Percorso ffmpeg:', process.env.FFMPEG_PATH);
});

client.on('voiceStateUpdate', async (oldState, newState) => {
  // Se qualcuno entra nel canale
  if (!newState.channel) return;
  
  if (newState.channel.name === '🏛️ Raining Library') {
    const guildId = newState.guild.id;
    
    // Evita connessioni duplicate
    if (activeConnections.has(guildId)) {
      console.log('⚠️ Bot già connesso in questo server');
      return;
    }
    
    try {
      console.log('🔌 Tentativo di connessione al canale vocale...');
      
      const connection = joinVoiceChannel({
        channelId: newState.channel.id,
        guildId: newState.guild.id,
        adapterCreator: newState.guild.voiceAdapterCreator,
        selfDeaf: false, // IMPORTANTE: non mettere in mute il bot
        selfMute: false
      });

      activeConnections.set(guildId, connection);

      // Attendi che la connessione sia pronta
      console.log('⏳ Attendo che la connessione sia pronta...');
      await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
      console.log('✅ Connessione pronta!');
      
      const player = createAudioPlayer();
      
      // Log dettagliato degli stati del player
      player.on(AudioPlayerStatus.Playing, () => {
        console.log('▶️ Audio in riproduzione');
      });
      
      player.on(AudioPlayerStatus.Idle, () => {
        console.log('⏸️ Audio terminato, riavvio loop...');
        const newResource = createRainResource();
        if (newResource) {
          player.play(newResource);
        }
      });
      
      player.on(AudioPlayerStatus.Buffering, () => {
        console.log('⏳ Buffering audio...');
      });

      player.on('error', error => {
        console.error('❌ Errore player audio:', error.message);
        console.error('Stack:', error.stack);
      });

      connection.on(VoiceConnectionStatus.Ready, () => {
        console.log('✅ Connessione vocale ready');
      });

      connection.on(VoiceConnectionStatus.Disconnected, async () => {
        console.log('⚠️ Disconnesso dal canale');
        activeConnections.delete(guildId);
      });

      connection.on('error', error => {
        console.error('❌ Errore connessione:', error);
      });

      // Sottoscrivi il player alla connessione
      const subscription = connection.subscribe(player);
      
      if (!subscription) {
        console.error('❌ Impossibile sottoscrivere il player alla connessione');
        connection.destroy();
        activeConnections.delete(guildId);
        return;
      }
      
      console.log('✅ Player sottoscritto alla connessione');

      // Play iniziale
      const resource = createRainResource();
      if (resource) {
        console.log('🎵 Avvio riproduzione...');
        player.play(resource);
      } else {
        console.error('❌ Impossibile creare la risorsa audio');
        connection.destroy();
        activeConnections.delete(guildId);
      }
      
    } catch (error) {
      console.error('❌ Errore durante la connessione al canale:', error.message);
      console.error('Stack completo:', error.stack);
      activeConnections.delete(guildId);
    }
  }
});

client.login(process.env.TOKEN);