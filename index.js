require("dotenv").config();
const express = require("express");
const {
    Client,
    GatewayIntentBits,
    PermissionsBitField,
    ChannelType,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require("discord.js");


const commands = [
    {
        name: "team_create",
        description: "新しいチームを作成します",
        options: [
            {
                name: "name",
                description: "作成するチーム名",
                type: 3,
                required: true,
            },
        ],
    },
    {
        name: "team_delete",
        description: "このチャンネルのチームを削除します（チーム内で使用）",
    },
    {
        name: "team_addmember",
        description: "チームに指定メンバーを追加します",
        options: [
            {
                name: "member",
                description: "追加するメンバー",
                type: 6,
                required: true,
            },
        ],
    },
    {
        name: "team_removemember",
        description: "チームから指定メンバーを外します",
        options: [
            {
                name: "member",
                description: "外すメンバー",
                type: 6,
                required: true,
            },
        ],
    },
    {
        name: "team_rename",
        description: "チーム名を変更します（チーム内で使用）",
        options: [
            {
                name: "new_name",
                description: "新しいチーム名",
                type: 3,
                required: true,
            },
        ],
    },
];

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
    try {
        console.log("📤 コマンド登録中...");
        await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
            body: commands,
        });
        console.log("✅ コマンド登録完了！");
    } catch (error) {
        console.error("❌ コマンド登録失敗:", error);
    }
})();


const app = express();
app.get("/", (req, res) => res.send("Bot is alive!"));
app.listen(3000, () => console.log("🌐 Webサーバーがポート3000で起動しました"));
process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled Rejection:", reason);
});
process.on("uncaughtException", (error) => {
    console.error("Uncaught Exception:", error);
});

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});
client.once("ready", () => {
    console.log(`✅ ログイン成功：${client.user.tag}`);
});
client.on("interactionCreate", async (interaction) => {
    if (!interaction.guild) return;
    const guild = interaction.guild;
    try {
        if (interaction.isChatInputCommand()) {
            const commandName = interaction.commandName;
            await interaction.deferReply({ ephemeral: true });
            // /team_create
            if (commandName === "team_create") {
                const teamName = interaction.options.getString("name");
                const roleName = `Team_${teamName}`;
                const categoryName = `Team_${teamName}`;
                const exists =
                    guild.roles.cache.find((r) => r.name === roleName) ||
                    guild.channels.cache.find(
                        (c) =>
                            c.name === categoryName && c.type === ChannelType.GuildCategory,
                    );
                if (exists) {
                    return await interaction.editReply(
                        `❌ チーム「${teamName}」はすでに存在します。`,
                    );
                }
                const role = await guild.roles.create({ name: roleName });
                const category = await guild.channels.create({
                    name: categoryName,
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
                    parent: category,
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
                    parent: category,
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
                await interaction.member.roles.add(role);
                await interaction.editReply(`✅ チーム「${teamName}」を作成しました！`);
            }
            // /team_delete
            else if (commandName === "team_delete") {
                const channel = interaction.channel;
                if (!channel.parent) {
                    return interaction.editReply(
                        "❌ このコマンドはチームのカテゴリー内でのみ使用してください。",
                    );
                }
                const match = channel.parent.name.match(/^Team_(.+)$/);
                if (!match) {
                    return interaction.editReply(
                        "❌ チームのカテゴリー内でのみ使用してください。",
                    );
                }
                const teamName = match[1];
                const role = interaction.member.roles.cache.find(
                    (r) => r.name === `Team_${teamName}`,
                );
                const isAdmin = interaction.member.permissions.has(
                    PermissionsBitField.Flags.Administrator,
                );
                if (!role && !isAdmin) {
                    return interaction.editReply(
                        `❌ あなたはチーム「${teamName}」のメンバーではありません。`,
                    );
                }
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`confirm_delete_${teamName}_${interaction.user.id}`)
                        .setLabel("✅ 本当に削除する")
                        .setStyle(ButtonStyle.Danger),
                );
                await interaction.editReply({
                    content: `⚠️ 本当にチーム「${teamName}」を削除しますか？`,
                    components: [row],
                });
            }
            // /team_addmember
            else if (commandName === "team_addmember") {
                const target = interaction.options.getUser("member");
                const channel = interaction.channel;
                if (!channel.parent) {
                    return interaction.editReply(
                        "❌ このコマンドはチームのカテゴリー内で使用してください。",
                    );
                }
                const match = channel.parent.name.match(/^Team_(.+)$/);
                if (!match) {
                    return interaction.editReply(
                        "❌ チームのカテゴリー内で使用してください。",
                    );
                }
                const teamName = match[1];
                const role = guild.roles.cache.find(
                    (r) => r.name === `Team_${teamName}`,
                );
                const member = await guild.members.fetch(target.id);
                if (!role) {
                    return interaction.editReply(
                        `❌ チーム「${teamName}」のロールが見つかりません。`,
                    );
                }
                await member.roles.add(role);
                await interaction.editReply(
                    `✅ ${target.username} をチーム「${teamName}」に追加しました。`,
                );
            }
            // /team_removemember
            else if (commandName === "team_removemember") {
                const target = interaction.options.getUser("member");
                const channel = interaction.channel;
                if (!channel.parent) {
                    return interaction.editReply(
                        "❌ このコマンドはチームのカテゴリー内で使用してください。",
                    );
                }
                const match = channel.parent.name.match(/^Team_(.+)$/);
                if (!match) {
                    return interaction.editReply(
                        "❌ チームのカテゴリー内で使用してください。",
                    );
                }
                const teamName = match[1];
                const role = guild.roles.cache.find(
                    (r) => r.name === `Team_${teamName}`,
                );
                const member = await guild.members.fetch(target.id);
                if (!role || !member.roles.cache.has(role.id)) {
                    return interaction.editReply(
                        `❌ ユーザーはチーム「${teamName}」のメンバーではありません。`,
                    );
                }
                await member.roles.remove(role);
                await interaction.editReply(
                    `✅ ${target.username} をチーム「${teamName}」から削除しました。`,
                );
                // ロールのメンバーが0人なら自動削除
                const roleMembers = role.members;
                if (roleMembers.size === 0) {
                    const category = guild.channels.cache.find(
                        (c) =>
                            c.name === `Team_${teamName}` &&
                            c.type === ChannelType.GuildCategory,
                    );
                    if (category) {
                        const children = guild.channels.cache.filter(
                            (c) => c.parentId === category.id,
                        );
                        for (const [, child] of children) {
                            await child.delete("チーム自動削除");
                        }
                        await category.delete();
                    }
                    await role.delete();
                    console.log(
                        `🗑️ チーム「${teamName}」を自動削除しました（メンバーなし）`,
                    );
                }
            }
        }
        // ボタン操作: 削除確認
        if (interaction.isButton()) {
            const [prefix, action, teamName, userId] =
                interaction.customId.split("_");
            if (
                prefix !== "confirm" ||
                action !== "delete" ||
                interaction.user.id !== userId
            ) {
                return interaction.reply({
                    content: "❌ あなたはこのボタンを使用できません。",
                    ephemeral: true,
                });
            }
            const role = interaction.guild.roles.cache.find(
                (r) => r.name === `Team_${teamName}`,
            );
            const category = interaction.guild.channels.cache.find(
                (c) =>
                    c.name === `Team_${teamName}` && c.type === ChannelType.GuildCategory,
            );
            if (!role || !category) {
                return await interaction.update({
                    content: "❌ チームが見つかりません。",
                    components: [],
                });
            }
            const children = interaction.guild.channels.cache.filter(
                (c) => c.parentId === category.id,
            );
            for (const [, child] of children) {
                await child.delete("チーム削除");
            }
            await category.delete();
            await role.delete();
            await interaction.update({
                content: `✅ チーム「${teamName}」を削除しました。`,
                components: [],
            });
        }
    } catch (error) {
        console.error("❌ 実行エラー:", error);
        if (interaction.deferred) {
            await interaction.editReply("❌ コマンド実行中にエラーが発生しました。");
        } else {
            await interaction.reply({
                content: "❌ エラーが発生しました。",
                ephemeral: true,
            });
        }
    }
});
client.login(process.env.TOKEN);
