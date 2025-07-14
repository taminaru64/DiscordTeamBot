require("dotenv").config();
const express = require("express");
const app = express();

app.get("/", (req, res) => {
    res.send("Bot is alive!");
});

app.listen(3000, () => {
    console.log("🌐 Webサーバーがポート3000で起動しました");
});

process.on("unhandledRejection", (reason) => {
    console.error("Unhandled Rejection:", reason);
});
process.on("uncaughtException", (error) => {
    console.error("Uncaught Exception:", error);
});

const {
    Client,
    GatewayIntentBits,
    PermissionsBitField,
    ChannelType,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require("discord.js");

const deployCommands = require("./deploy-commands");

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

const TOKEN = process.env.TOKEN;

client.once("ready", () => {
    console.log(`✅ ログイン成功：${client.user.tag}`);
});

deployCommands();

client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const guild = interaction.guild;
    const member = interaction.member;

    if (interaction.commandName === "team_create") {
        const teamName = interaction.options.getString("name");

        if (guild.roles.cache.find((r) => r.name === `Team_${teamName}`)) {
            return interaction.reply({
                content: `❌ チーム「${teamName}」は既に存在します。`,
                ephemeral: true,
            });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            const role = await guild.roles.create({
                name: `Team_${teamName}`,
                reason: `チーム ${teamName} 用ロール`,
            });

            const category = await guild.channels.create({
                name: `Team_${teamName}`,
                type: ChannelType.GuildCategory,
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone.id,
                        deny: [PermissionsBitField.Flags.ViewChannel],
                    },
                    {
                        id: role.id,
                        allow: [
                            PermissionsBitField.Flags.ViewChannel,
                            PermissionsBitField.Flags.ManageChannels,
                            PermissionsBitField.Flags.Connect,
                        ],
                    },
                ],
            });

            await guild.channels.create({
                name: "テキストチャンネル",
                type: ChannelType.GuildText,
                parent: category.id,
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone.id,
                        deny: [PermissionsBitField.Flags.ViewChannel],
                    },
                    {
                        id: role.id,
                        allow: [
                            PermissionsBitField.Flags.ViewChannel,
                            PermissionsBitField.Flags.SendMessages,
                        ],
                    },
                ],
            });

            await guild.channels.create({
                name: "ボイスチャンネル",
                type: ChannelType.GuildVoice,
                parent: category.id,
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone.id,
                        deny: [PermissionsBitField.Flags.ViewChannel],
                    },
                    {
                        id: role.id,
                        allow: [
                            PermissionsBitField.Flags.ViewChannel,
                            PermissionsBitField.Flags.Connect,
                        ],
                    },
                ],
            });

            await member.roles.add(role);

            await interaction.editReply(`✅ チーム「${teamName}」を作成しました！`);
        } catch (err) {
            console.error(err);
            await interaction.editReply("❌ チーム作成中にエラーが発生しました。");
        }
    }

    else if (interaction.commandName === "team_delete") {
        const channel = interaction.channel;
        if (!channel.parent) {
            return interaction.reply({
                content: "❌ このコマンドはカテゴリー内のチャンネルで使用してください。",
                ephemeral: true,
            });
        }

        const categoryName = channel.parent.name;
        const match = categoryName.match(/^Team_(.+)$/);
        if (!match) {
            return interaction.reply({
                content: "❌ チームカテゴリー内でのみ使用可能です。",
                ephemeral: true,
            });
        }

        const teamName = match[1];
        const role = guild.roles.cache.find((r) => r.name === `Team_${teamName}`);
        if (!role) {
            return interaction.reply({
                content: `❌ ロール Team_${teamName} が見つかりません。`,
                ephemeral: true,
            });
        }

        const isAdmin = member.permissions.has(PermissionsBitField.Flags.Administrator);
        const isTeamMember = member.roles.cache.has(role.id);

        if (!isAdmin && !isTeamMember) {
            return interaction.reply({
                content: "❌ このチームを削除する権限がありません。",
                ephemeral: true,
            });
        }

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`confirm_delete_${teamName}_${member.id}`)
                .setLabel("✅ 本当に削除する")
                .setStyle(ButtonStyle.Danger)
        );

        await interaction.reply({
            content: `⚠️ チーム「${teamName}」を削除しますか？`,
            components: [row],
            ephemeral: true,
        });
    }

    else if (interaction.commandName === "team_addmember") {
        const user = interaction.options.getUser("user");
        const channel = interaction.channel;

        if (!channel.parent) return;
        const categoryName = channel.parent.name;
        const match = categoryName.match(/^Team_(.+)$/);
        if (!match) return;

        const teamName = match[1];
        const role = guild.roles.cache.find((r) => r.name === `Team_${teamName}`);
        if (!role) {
            return interaction.reply({ content: "❌ ロールが見つかりません。", ephemeral: true });
        }

        const memberToAdd = await guild.members.fetch(user.id);
        await memberToAdd.roles.add(role);

        await interaction.reply({
            content: `✅ ${user.tag} をチーム「${teamName}」に追加しました。`,
            ephemeral: true,
        });
    }

    else if (interaction.commandName === "team_removemember") {
        const user = interaction.options.getUser("user");
        const channel = interaction.channel;
        if (!channel.parent) return;
        const categoryName = channel.parent.name;
        const match = categoryName.match(/^Team_(.+)$/);
        if (!match) return;

        const teamName = match[1];
        const role = guild.roles.cache.find((r) => r.name === `Team_${teamName}`);
        if (!role) return;

        const memberToRemove = await guild.members.fetch(user.id);
        await memberToRemove.roles.remove(role);

        await interaction.reply({
            content: `✅ ${user.tag} をチーム「${teamName}」から削除しました。`,
            ephemeral: true,
        });

        const stillMembers = guild.members.cache.filter((m) => m.roles.cache.has(role.id));
        if (stillMembers.size === 0) {
            const category = guild.channels.cache.find(
                (c) => c.name === `Team_${teamName}` && c.type === ChannelType.GuildCategory
            );
            const children = guild.channels.cache.filter((c) => c.parentId === category.id);
            for (const [, ch] of children) {
                await ch.delete();
            }
            await category.delete();
            await role.delete();
            console.log(`👥 チーム「${teamName}」を自動削除しました`);
        }
    }

    else if (interaction.commandName === "team_rename") {
        const newName = interaction.options.getString("new_name");
        const channel = interaction.channel;
        if (!channel.parent) return;

        const categoryName = channel.parent.name;
        const match = categoryName.match(/^Team_(.+)$/);
        if (!match) return;

        const oldTeamName = match[1];
        const oldRole = guild.roles.cache.find((r) => r.name === `Team_${oldTeamName}`);
        if (!oldRole) return;

        const category = channel.parent;
        category.setName(`Team_${newName}`);
        oldRole.setName(`Team_${newName}`);

        const children = guild.channels.cache.filter((c) => c.parentId === category.id);
        for (const [, ch] of children) {
            if (ch.name === "テキストチャンネル" || ch.name === "ボイスチャンネル") continue;
            await ch.setName(`チャンネル_${newName}`);
        }

        await interaction.reply({
            content: `✅ チーム名を「${oldTeamName}」から「${newName}」に変更しました。`,
            ephemeral: true,
        });
    }

});

client.on("interactionCreate", async (interaction) => {
    if (!interaction.isButton()) return;

    const [action, subAction, teamName, userId] = interaction.customId.split("_");

    if (action !== "confirm" || subAction !== "delete" || interaction.user.id !== userId) {
        return interaction.reply({
            content: "❌ あなたはこのボタンを使用できません。",
            ephemeral: true,
        });
    }

    const guild = interaction.guild;
    const role = guild.roles.cache.find((r) => r.name === `Team_${teamName}`);
    const category = guild.channels.cache.find(
        (c) => c.name === `Team_${teamName}` && c.type === ChannelType.GuildCategory
    );

    if (!role || !category) {
        return interaction.update({
            content: "❌ チーム削除中にエラーが発生しました。",
            components: [],
        });
    }

    try {
        const children = guild.channels.cache.filter((c) => c.parentId === category.id);
        for (const [, child] of children) {
            await child.delete("チーム削除によるチャンネル削除");
        }

        await category.delete("チーム削除");
        await role.delete("チーム削除");

        await interaction.update({
            content: `✅ チーム「${teamName}」を削除しました。`,
            components: [],
        });
    } catch (error) {
        console.error(error);
        await interaction.update({
            content: "❌ チーム削除中にエラーが発生しました。",
            components: [],
        });
    }
});

client.login(TOKEN);
