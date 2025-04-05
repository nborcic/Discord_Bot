require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const commands = [
    new SlashCommandBuilder()
        .setName('match')
        .setDescription('Get latest PUBG match info for a player')
        .addStringOption(option =>
            option.setName('player')
                .setDescription('Player name')
                .setRequired(true)
        )
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log('🔁 Registering slash commands...');
        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commands }
        );
        console.log('✅ Slash commands registered!');
    } catch (err) {
        console.error('❌ Failed to register commands:', err);
    }
})();
