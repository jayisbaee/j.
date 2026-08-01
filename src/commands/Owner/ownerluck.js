import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';
import { getEconomyData, setEconomyData } from '../../utils/economy.js';
import { withErrorHandling } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { isBotOwner } from '../../config/bot.js';
import { setRig } from '../../utils/riggedLuck.js';
import { logger } from '../../utils/logger.js';

// Owner-only. Hidden from the command picker + double-enforced via isBotOwner()
// at runtime. The rig itself is stored on the target's own economy record
// under an unremarkable key, so it's invisible to them in every normal
// display command (balance, inventory, etc).

export default {
    data: new SlashCommandBuilder()
        .setName('luck')
        .setDescription('Owner only')
        .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true))
        .addStringOption(o =>
            o.setName('mode').setDescription('Luck mode').setRequired(true)
                .addChoices(
                    { name: 'off (normal odds)', value: 'off' },
                    { name: 'boosted (+35% win chance)', value: 'boosted' },
                    { name: 'insane (guaranteed win)', value: 'insane' },
                )
        )
        .addIntegerOption(o =>
            o.setName('minutes').setDescription('Auto-expire after N minutes (omit for indefinite)').setMinValue(1)
        )
        .setDefaultMemberPermissions(0n),

    execute: withErrorHandling(async (interaction, config, client) => {
        const deferred = await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
        if (!deferred) return;

        if (!isBotOwner(interaction.user.id)) {
            logger.warn('[OWNER_COMMAND_BLOCKED] Non-owner attempted /luck', {
                userId: interaction.user.id,
                guildId: interaction.guildId,
            });
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [errorEmbed('Unknown Command', 'That command does not exist.')],
            });
            return;
        }

        const target = interaction.options.getUser('user');
        const mode = interaction.options.getString('mode');
        const minutes = interaction.options.getInteger('minutes');
        const guildId = interaction.guildId;

        const userData = await getEconomyData(client, guildId, target.id);
        const expiresAt = minutes ? Date.now() + minutes * 60 * 1000 : null;
        setRig(userData, mode, { expiresAt, setBy: interaction.user.id });
        await setEconomyData(client, guildId, target.id, userData);

        logger.info('[OWNER_ACTION] Luck rig updated', {
            ownerId: interaction.user.id,
            targetId: target.id,
            guildId,
            mode,
            expiresAt,
        });

        const durationText = expiresAt ? `for ${minutes} minute(s)` : 'indefinitely';
        const embed = mode === 'off'
            ? successEmbed('Luck Cleared', `**${target.tag}** is back to normal odds.`)
            : successEmbed('Luck Rigged', `**${target.tag}** is now set to **${mode}** ${durationText} on \`/gamble\` and \`/blackjack\`.\nThis is invisible to them.`);

        await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    }, { command: 'luck' }),
};
