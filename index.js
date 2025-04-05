console.log("🛠 Bot is starting from this file...");

require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, Events } = require('discord.js');
const axios = require('axios');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
});

client.once('ready', () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const command = interaction.commandName;

    //  /stat command
    if (command === 'stat') {
        const playerName = interaction.options.getString('player');
        const seasonType = interaction.options.getString('season');

        await interaction.deferReply();

        try {
            const playerRes = await axios.get(`https://api.pubg.com/shards/steam/players?filter[playerNames]=${playerName}`, {
                headers: {
                    Authorization: `Bearer ${process.env.PUBG_API_KEY}`,
                    Accept: 'application/vnd.api+json',
                },
            });

            const player = playerRes.data.data[0];
            const playerId = player.id;

            let seasonId = 'lifetime';
            if (seasonType === 'current') {
                const seasonList = await axios.get(`https://api.pubg.com/shards/steam/seasons`, {
                    headers: {
                        Authorization: `Bearer ${process.env.PUBG_API_KEY}`,
                        Accept: 'application/vnd.api+json',
                    },
                });

                const currentSeason = seasonList.data.data.find(season => season.attributes.isCurrentSeason);
                seasonId = currentSeason.id;
            }

            const statsRes = await axios.get(`https://api.pubg.com/shards/steam/players/${playerId}/seasons/${seasonId}`, {
                headers: {
                    Authorization: `Bearer ${process.env.PUBG_API_KEY}`,
                    Accept: 'application/vnd.api+json',
                },
            });

            const stats = statsRes.data.data.attributes.gameModeStats['squad-fpp'];

            if (!stats) {
                interaction.editReply('🚫 No `squad-fpp` stats found for this season.');
                return;
            }

            const embed = new EmbedBuilder()
                .setColor(0x00AE86)
                .setTitle(`📊 PUBG Stats for ${playerName}`)
                .setDescription(`Season: **${seasonType}** — Mode: **squad-fpp**`)
                .addFields(
                    { name: 'Wins', value: stats.wins.toString(), inline: true },
                    { name: 'Kills', value: stats.kills.toString(), inline: true },
                    { name: 'K/D Ratio', value: (stats.kills / stats.losses).toFixed(2), inline: true },
                    { name: 'Damage Dealt', value: stats.damageDealt.toFixed(1), inline: true },
                    { name: 'Headshots', value: stats.headshotKills.toString(), inline: true },
                    { name: 'Top 10s', value: stats.top10s.toString(), inline: true },
                    { name: 'Rounds Played', value: stats.roundsPlayed.toString(), inline: true }
                )
                .setTimestamp()
                .setFooter({ text: 'PUBG Stats Bot' });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error(error.response?.data || error.message);
            interaction.editReply('❌ Failed to fetch player stats.');
        }
    }

    //  /match command
    if (command === 'match') {
        const playerName = interaction.options.getString('player');
        console.log(`📥 /match triggered for: ${playerName}`);

        await interaction.deferReply();

        try {
            const playerRes = await axios.get(`https://api.pubg.com/shards/steam/players?filter[playerNames]=${playerName}`, {
                headers: {
                    Authorization: `Bearer ${process.env.PUBG_API_KEY}`,
                    Accept: 'application/vnd.api+json',
                },
            });

            const player = playerRes.data.data[0];
            const matchId = player.relationships.matches.data[0].id;

            console.log('✅ Player ID:', player.id);
            console.log('🎮 Latest Match ID:', matchId);

            const matchRes = await axios.get(`https://api.pubg.com/shards/steam/matches/${matchId}`, {
                headers: {
                    Authorization: `Bearer ${process.env.PUBG_API_KEY}`,
                    Accept: 'application/vnd.api+json',
                },
            });

            const included = matchRes.data.included;
            const participant = included.find(p => p.type === 'participant' && p.attributes.stats.name === playerName);

            if (!participant) {
                interaction.editReply('❌ Could not find player in match data.');
                return;
            }

            const stats = participant.attributes.stats;
            const match = matchRes.data.data.attributes;

            const embed = new EmbedBuilder()
                .setTitle(`🎮 Latest Match for ${playerName}`)
                .setColor(0x1f8b4c)
                .addFields(
                    { name: 'Map', value: match.mapName, inline: true },
                    { name: 'Mode', value: match.gameMode, inline: true },
                    { name: 'Team Placement', value: stats.winPlace.toString(), inline: true },
                    { name: 'Kills', value: stats.kills.toString(), inline: true },
                    { name: 'Assists', value: stats.assists.toString(), inline: true },
                    { name: 'Damage', value: stats.damageDealt.toFixed(1), inline: true },
                    { name: 'Time Survived', value: `${(stats.timeSurvived / 60).toFixed(1)} min`, inline: true }
                )
                .setTimestamp()
                .setFooter({ text: 'PUBG Match Report' });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('❌ Error fetching match:', error.response?.data || error.message);
            interaction.editReply(`❌ Failed to fetch latest match for "${playerName}".`);
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
