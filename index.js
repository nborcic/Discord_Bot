console.log("🛠 Bot is starting from this file...");

require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, Events } = require('discord.js');
const axios = require('axios');
const { Match } = require('./db');
const { analyzeTelemetry } = require('./analyze');


const axiosWithRateLimit = async (url, config = {}) => {
    try {
        return  await axios.get(url, config);
    } catch (err) {
        if (err.response?.status === 429) {
            const retryAfter = err.response.headers['retry-after'] || 10;
            throw new Error(`RATE_LIMITED:${retryAfter}`);
        } else {
            throw err;
        }
    }
};

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

const handleMatchCommand = async (interaction) => {
    const playerName = interaction.options.getString('player');
    console.log(`📥 /match triggered for: ${playerName}`);

    await interaction.deferReply();

    try {
        // 1. Get player ID
        const playerRes = await axiosWithRateLimit(`https://api.pubg.com/shards/steam/players?filter[playerNames]=${playerName}`, {
            headers: {
                Authorization: `Bearer ${process.env.PUBG_API_KEY}`,
                Accept: 'application/vnd.api+json',
            },
        });
        const player = playerRes.data.data[0];
        const matchId = player.relationships.matches.data[0].id;

        // 2. Get match metadata
        const matchRes = await axiosWithRateLimit(`https://api.pubg.com/shards/steam/matches/${matchId}`, {
            headers: {
                Authorization: `Bearer ${process.env.PUBG_API_KEY}`,
                Accept: 'application/vnd.api+json',
            },
        });
        const included = matchRes.data.included;
        const match = matchRes.data.data.attributes;
        const participant = included.find(p => p.type === 'participant' && p.attributes.stats.name === playerName);
        const stats = participant.attributes.stats;

        const telemetryUrl = matchRes.data.included.find(a => a.type === 'asset').attributes.URL;
        const telemetryRes = await axiosWithRateLimit(telemetryUrl);
        const telemetry = telemetryRes.data;

        // 3. Analyze telemetry
        const analysis = analyzeTelemetry(telemetry, playerName);

        // 4. Store in MongoDB
        const matchDoc = new Match({
            matchId,
            playerName,
            createdAt: new Date(match.createdAt),
            mapName: match.mapName,
            gameMode: match.gameMode,
            winPlace: stats.winPlace,
            timeSurvived: stats.timeSurvived,
            kills: stats.kills,
            assists: stats.assists,
            damageDealt: stats.damageDealt,
            headshotKills: stats.headshotKills,
            longestKill: stats.longestKill,
            DBNOs: stats.DBNOs,
            teamKills: stats.teamKills,
            revives: stats.revives,
            rideDistance: stats.rideDistance,
            walkDistance: stats.walkDistance,
            boosts: stats.boosts,
            heals: stats.heals,
            weaponsAcquired: stats.weaponsAcquired,
            telemetry,
            analysis
        });
        await matchDoc.save();

        // 5. Build Discord embed
        const embed = new EmbedBuilder()
            .setTitle(`🎮 Match Report for ${playerName}`)
            .setColor(analysis.suspicious ? 0xff0000 : 0x00AE86)
            .addFields(
                { name: 'Map', value: match.mapName, inline: true },
                { name: 'Mode', value: match.gameMode, inline: true },
                { name: 'Placement', value: stats.winPlace.toString(), inline: true },
                { name: 'Kills', value: stats.kills.toString(), inline: true },
                { name: 'Damage', value: stats.damageDealt.toFixed(1), inline: true },
                { name: 'Shots Fired', value: analysis.totalShots.toString(), inline: true },
                { name: 'Hits', value: analysis.totalHits.toString(), inline: true },
                { name: 'Accuracy', value: `${analysis.accuracy.toFixed(2)}%`, inline: true },
                { name: 'Headshots >50m', value: analysis.headshotsOver50m.toString(), inline: true },
                { name: 'KD Ratio', value: analysis.kdRatio.toFixed(2), inline: true }
            )
            .setFooter({ text: analysis.suspicious ? `⚠️ Suspected: ${analysis.reasons.join(', ')}` : 'No suspicious activity detected' })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('❌ Error in /match:', error.response?.data || error.message);
        interaction.editReply('❌ Failed to fetch and analyze match data.');
    }
};



client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const command = interaction.commandName;

    //  /stat command
    if (command === 'stat') {
        const playerName = interaction.options.getString('player');
        const seasonType = interaction.options.getString('season');

        await interaction.deferReply();

        try {
            const playerRes = await axiosWithRateLimit(`https://api.pubg.com/shards/steam/players?filter[playerNames]=${playerName}`, {
                headers: {
                    Authorization: `Bearer ${process.env.PUBG_API_KEY}`,
                    Accept: 'application/vnd.api+json',
                },
            });

            const player = playerRes.data.data[0];
            const playerId = player.id;

            let seasonId = 'lifetime';
            if (seasonType === 'current') {
                const seasonList = await axiosWithRateLimit(`https://api.pubg.com/shards/steam/seasons`, {
                    headers: {
                        Authorization: `Bearer ${process.env.PUBG_API_KEY}`,
                        Accept: 'application/vnd.api+json',
                    },
                });

                const currentSeason = seasonList.data.data.find(season => season.attributes.isCurrentSeason);
                seasonId = currentSeason.id;
            }

            const statsRes = await axiosWithRateLimit(`https://api.pubg.com/shards/steam/players/${playerId}/seasons/${seasonId}`, {
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

    //  /flagged command
    if (command === 'flagged') {
        const { FlaggedPlayer } = require('./db');

        try {
            const flaggedPlayers = await FlaggedPlayer.find().sort({ flaggedAt: -1 }).limit(10);

            if (!flaggedPlayers.length) {
                await interaction.reply('✅ No flagged players yet. Everything looks clean!');
                return;
            }

            const reportLines = flaggedPlayers.map((p, index) => (
                `**${index + 1}. ${p.playerName}** — ⚠️ ${p.suspiciousMatches}/${p.matchesAnalyzed} suspicious matches  
       KD: ${p.avgKD.toFixed(2)} | Accuracy: ${p.avgAccuracy.toFixed(1)}% | Headshots >50m: ${p.avgHeadshotsOver50m.toFixed(1)}`
            ));

            await interaction.reply({
                content: `📋 **Flagged Players**\n\n${reportLines.join('\n\n')}`,
                ephemeral: false
            });

        } catch (err) {
            console.error('❌ Error loading flagged players:', err);
            await interaction.reply('❌ Could not load flagged players.');
        }
    }
    //  /match command
    if (command === 'match') {
        const playerName = interaction.options.getString('player');
        const normalizedName = playerName.toLowerCase();

        await interaction.deferReply();

        try {
            // 1. Get player ID
            const playerRes = await axiosWithRateLimit(`https://api.pubg.com/shards/steam/players?filter[playerNames]=${playerName}`, {
                headers: {
                    Authorization: `Bearer ${process.env.PUBG_API_KEY}`,
                    Accept: 'application/vnd.api+json',
                },
            });

            const player = playerRes.data.data[0];
            const matchList = player.relationships.matches.data.slice(0, 50); // Get all matches for the player cca.50

            // 2. Get current season ID
            const seasonRes = await axiosWithRateLimit(`https://api.pubg.com/shards/steam/seasons`, {
                headers: {
                    Authorization: `Bearer ${process.env.PUBG_API_KEY}`,
                    Accept: 'application/vnd.api+json',
                },
            });
            const rankedSeason = seasonRes.data.data.find(season =>
                season.attributes.isCurrentSeason &&
                season.id.startsWith('division.bro.official')
            );

            if (!rankedSeason) {
                await interaction.editReply('❌ Could not find the current ranked season.');
                return;
            }
            const seasonId = rankedSeason.id;

            let totalKills = 0;
            let totalKD = 0;
            let totalAccuracy = 0;
            let totalHeadshots50m = 0;
            let suspiciousCount = 0;
            let matchesAnalyzed = 0;

            for (const matchRef of matchList) {
                try {
                    const matchId = matchRef.id;
                    const matchRes = await axiosWithRateLimit(`https://api.pubg.com/shards/steam/matches/${matchId}`, {
                        headers: {
                            Authorization: `Bearer ${process.env.PUBG_API_KEY}`,
                            Accept: 'application/vnd.api+json',
                        },
                    });

                    const match = matchRes.data.data.attributes;
                    if (match.gameMode !== 'squad-fpp') continue;

                    const included = matchRes.data.included;
                    const participant = included.find(p => p.type === 'participant' && p.attributes.stats.name.toLowerCase() === normalizedName);
                    if (!participant) continue;
                    if (match.gameMode !== 'squad-fpp') continue;
                    const createdAt = new Date(match.createdAt);
                    const seasonStart = new Date(rankedSeason.attributes.startDate);
                    const seasonEnd = new Date(rankedSeason.attributes.endDate);
                    if (createdAt < seasonStart || createdAt > seasonEnd) continue;
                    const stats = participant.attributes.stats;

                    const asset = included.find(a => a.type === 'asset');
                    if (!asset || !asset.attributes?.URL) continue;

                    const telemetryRes = await axiosWithRateLimit(asset.attributes.URL);
                    const telemetry = telemetryRes.data;

                    const analysis = analyzeTelemetry(telemetry, playerName);

                    totalKills += analysis.totalKills;
                    totalKD += analysis.kdRatio;
                    totalAccuracy += analysis.accuracy;
                    totalHeadshots50m += analysis.headshotsOver50m;
                    if (analysis.suspicious) suspiciousCount++;
                    matchesAnalyzed++;
                } catch (innerErr) {
                    console.warn(`⚠️ Failed to analyze match: ${matchRef.id}`, innerErr.message);
                    continue;
                }
            }

            if (matchesAnalyzed === 0) {
                await interaction.editReply(`❌ No squad-fpp matches found for ${playerName}.`);
                return;
            }

            const avgKills = (totalKills / matchesAnalyzed).toFixed(1);
            const avgKD = (totalKD / matchesAnalyzed).toFixed(2);
            const avgAccuracy = (totalAccuracy / matchesAnalyzed).toFixed(1);
            const avgHeadshots50m = (totalHeadshots50m / matchesAnalyzed).toFixed(1);

            const embed = new EmbedBuilder()
                .setTitle(`🎮 Match Analysis for ${playerName}`)
                .setColor(suspiciousCount > 3 ? 0xff0000 : 0x00AE86)
                .setDescription(`Last ${matchesAnalyzed} **Ranked** squad-fpp matches`)
                .addFields(
                    { name: 'Avg Kills', value: avgKills, inline: true },
                    { name: 'Avg KD', value: avgKD, inline: true },
                    { name: 'Avg Accuracy', value: `${avgAccuracy}%`, inline: true },
                    { name: 'Avg Headshots >50m', value: avgHeadshots50m, inline: true },
                    { name: 'Suspicious Matches', value: `${suspiciousCount}/${matchesAnalyzed}`, inline: false },
                )
                .setFooter({ text: suspiciousCount > 0 ? '⚠️ Suspicious behavior detected' : '✅ No major issues found' })
                .setTimestamp();

            if (suspiciousCount >= 3) {
                const { FlaggedPlayer } = require('./db');

                await FlaggedPlayer.findOneAndUpdate(
                    { playerName },
                    {
                        playerName,
                        suspiciousMatches: suspiciousCount,
                        matchesAnalyzed,
                        avgKD: Number(avgKD),
                        avgAccuracy: Number(avgAccuracy),
                        avgHeadshotsOver50m: Number(avgHeadshots50m),
                        flaggedAt: new Date()
                    },
                    { upsert: true, new: true }
                );
            }
            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            if (error.message?.startsWith('RATE_LIMITED')) {
                const waitTime = error.message.split(':')[1];
                await interaction.editReply(`⏳ PUBG API rate limit hit. Please try again in **${waitTime} seconds**.`);
                return;
            }
        
            console.error('❌ Error in /match:', error.response?.data || error.message);
            await interaction.editReply('❌ Failed to analyze matches.');
        }
    }

});

client.login(process.env.DISCORD_TOKEN);
