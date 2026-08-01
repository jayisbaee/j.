import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';
import { getEconomyData, setEconomyData, getMaxBankCapacity } from '../../utils/economy.js';
import { withErrorHandling } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { isBotOwner } from '../../config/bot.js';
import { logger } from '../../utils/logger.js';

// Owner-only. Discord hides this from the command picker for everyone else
// (setDefaultMemberPermissions(0n)), and isBotOwner() double-enforces it at
// runtime regardless of what permissions a server grants — even a server
// admin who isn't a bot owner can't run this.

export default {
    data: new SlashCommandBuilder()
        .setName('setbalance')
        .setDescription('Owner only')
        .addSubcommand(sub =>
            sub
                .setName('set')
                .setDescription('Set a user\'s balance to an exact amount')
                .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true))
                .addStringOption(o =>
                    o.setName('type').setDescription('wallet or bank').setRequired(true)
                        .addChoices({ name: 'wallet', value: 'wallet' }, { name: 'bank', value: 'bank' })
                )
                .addIntegerOption(o => o.setName('amount').setDescription('New amount').setRequired(true).setMinValue(0))
        )
        .addSubcommand(sub =>
            sub
                .setName('add')
                .setDescription('Add to a user\'s balance')
                .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true))
                .addStringOption(o =>
                    o.setName('type').setDescription('wallet or bank').setRequired(true)
                        .addChoices({ name: 'wallet', value: 'wallet' }, { name: 'bank', value: 'bank' })
                )
                .addIntegerOption(o => o.setName('amount').setDescription('Amount to add').setRequired(true).setMinValue(1))
        )
        .addSubcommand(sub =>
            sub
                .setName('remove')
                .setDescription('Remove from a user\'s balance')
                .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true))
                .addStringOption(o =>
                    o.setName('type').setDescription('wallet or bank').setRequired(true)
                        .addChoices({ name: 'wallet', value: 'wallet' }, { name: 'bank', value: 'bank' })
                )
                .addIntegerOption(o => o.setName('amount').setDescription('Amount to remove').setRequired(true).setMinValue(1))
        )
        .setDefaultMemberPermissions(0n), // hidden from the command picker for regular members

    execute: withErrorHandling(async (interaction, config, client) => {
        const deferred = await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
        if (!deferred) return;

        if (!isBotOwner(interaction.user.id)) {
            logger.warn('[OWNER_COMMAND_BLOCKED] Non-owner attempted /setbalance', {
                userId: interaction.user.id,
                guildId: interaction.guildId,
            });
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [errorEmbed('Unknown Command', 'That command does not exist.')],
            });
            return;
        }

        const sub = interaction.options.getSubcommand();
        const target = interaction.options.getUser('user');
        const type = interaction.options.getString('type');
        const amount = interaction.options.getInteger('amount');
        const guildId = interaction.guildId;

        const userData = await getEconomyData(client, guildId, target.id);

        let before = userData[type] || 0;
        let after;

        if (sub === 'set') {
            after = amount;
        } else if (sub === 'add') {
            after = before + amount;
        } else {
            after = Math.max(0, before - amount);
        }

        if (type === 'bank') {
            const maxBank = getMaxBankCapacity(userData);
            after = Math.min(after, maxBank);
        }

        userData[type] = after;
        await setEconomyData(client, guildId, target.id, userData);

        logger.info('[OWNER_ACTION] Balance overridden', {
            ownerId: interaction.user.id,
            targetId: target.id,
            guildId,
            type,
            before,
            after,
            action: sub,
        });

        const embed = successEmbed(
            'Balance Updated',
            `**${target.tag}**'s **${type}** is now **$${after.toLocaleString()}** (was $${before.toLocaleString()}).`
        );
        await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    }, { command: 'setbalance' }),
};
