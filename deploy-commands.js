const { SlashCommandBuilder, REST, Routes } = require('discord.js');
require('dotenv').config();

const commands = [
    new SlashCommandBuilder()
        .setName('stat')
        .setDescription('Get PUBG player stats for a season')
        .addStringOption(option =>
            option.setName('player')
                .setDescription('Player name')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('season')
                .setDescription('Season type: lifetime or current')
                .setRequired(true)
                .addChoices(
                    { name: 'lifetime', value: 'lifetime' },
                    { name: 'current', value: 'current' }
                )),

    new SlashCommandBuilder()
        .setName('match')
        .setDescription('Analyze the latest match for a player')
        .addStringOption(option =>
            option.setName('player')
                .setDescription('Player name')
                .setRequired(true))
]
    .map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log('🔄 Refreshing application commands...');

        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands },
        );

        console.log('✅ Successfully registered commands!');
    } catch (error) {
        console.error('❌ Error registering commands:', error);
    }
})();
