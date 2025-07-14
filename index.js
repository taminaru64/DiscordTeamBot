require("dotenv").config();

const express = require("express");
const app = express();

const {
    Client,
    GatewayIntentBits,
    PermissionsBitField,
    ChannelType,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    SlashCommandBuilder,
    REST,
    Routes,
} = require("discord.js");

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

// ===== Expressサーバー起動 =====
const port = process.env.PORT || 3000;
app.get("/", (req, res) => {
    res.send("Bot is alive!");
});
app.listen(port, () => {
    console.log(`🌐 Webサーバーがポート${port}で起動しました`);
});

// ===== コマンド定義 =====
const commands = [
    new SlashCommandBuilder()
        .setName("team_create")
        .setDescription("新しいチームを作成します")
        .addStringOption((option) =>
            option
                .setName("name")
                .setDescription("作成するチーム名")
                .setRequired(true)
        ),
    new SlashCommandBuilder()
        .setName("team_delete")
        .setDescription("このチャンネルのチームを削除します（チームchat内でのみ使用可能）"),
    new SlashCommandBuilder()
        .setName("team_rename")
        .setDescription("チーム名を変更します")
        .addStringOption((option) =>
            option
                .setName("newname")
                .setDescription("新しいチーム名")
                .setRequired(true)
        ),
    new SlashCommandBuilder()
        .setName("team_addmember")
        .setDescription("チームにメンバーを追加します")
        .addUserOption((option) =>
            option
                .setName("user")
                .setDescription("追加するメンバー")
                .setRequired(true)
        ),
    new SlashCommandBuilder()
        .setName("team_removemember")
        .setDescription("チームからメンバーを削除します")
        .addUserOption((option) =>
            option
                .setName("user")
                .setDescription("削除するメンバー")
                .setRequired(true)
        ),
].map((cmd) => cmd.toJSON());

// ===== コマンド登録関数 =====
async function registerCommands() {
    const rest = new REST({ version: "10" }).setToken(TOKEN);
    try {
        console.log("📤 コマンド登録中...");
        await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
            body: commands,
        });
        console.log("✅ コマンド登録完了！");
    } catch (error) {
        console.error("❌ コマンド登録失敗:", error);
    }
}

// Bot起動時にコマンド登録
client.once("ready", () => {
    console.log(`✅ ログイン成功：${client.user.tag}`);
    registerCommands();
});

// ===== interactionCreate イベント =====
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand() && !interaction.isButton()) return;

    const guild = interaction.guild;
    const member = interaction.member;

    if (interaction.isChatInputCommand()) {
        const cmd = interaction.commandName;

        if (cmd === "team_create") {
            const originalName = interaction.options.getString("name");
            const teamName = originalName;

            // チーム重複チェック
            if (
                guild.roles.cache.some((r) => r.name === `Team_${teamName}`) ||
                guild.channels.cache.some((c) => c.name === `Team_${teamName}` && c.type === ChannelType.GuildCategory)
            ) {
                return interaction.reply({
                    content: `❌ チーム「${teamName}」は既に存在します。`,
                    ephemeral: true,
                });
            }

            try {
                await interaction.deferReply({ ephemeral: true });

                // ロール作成
                const role = await guild.roles.create({
                    name: `Team_${teamName}`,
                    reason: `チーム ${teamName} 用のロール作成`,
                });

                // カテゴリー作成（閲覧はチームメンバーのみ）
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

                // テキストチャンネル作成
                await guild.channels.create({
                    name: `chat`,
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

                // ボイスチャンネル作成
                await guild.channels.create({
                    name: `voice`,
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

                // 作成者にロール付与
                await member.roles.add(role);

                await interaction.editReply(`✅ チーム「${teamName}」を作成しました！`);
            } catch (error) {
                console.error(error);
                await interaction.editReply("❌ チーム作成中にエラーが発生しました。");
            }
        }

        else if (cmd === "team_delete") {
            if (!interaction.channel.parent) {
                return interaction.reply({
                    content: "❌ このコマンドはカテゴリー内のチャンネルでのみ使用可能です。",
                    ephemeral: true,
                });
            }

            const categoryName = interaction.channel.parent.name;
            const match = categoryName.match(/^Team_(.+)$/);
            if (!match) {
                return interaction.reply({
                    content: "❌ このコマンドはチームのカテゴリー内のチャンネルでのみ使用可能です。",
                    ephemeral: true,
                });
            }

            const teamName = match[1];
            const roleName = `Team_${teamName}`;
            const role = guild.roles.cache.find((r) => r.name === roleName);
            if (!role) {
                return interaction.reply({
                    content: `❌ ロール ${roleName} が見つかりません。`,
                    ephemeral: true,
                });
            }

            const hasRole = member.roles.cache.has(role.id);
            const isAdmin = member.permissions.has(PermissionsBitField.Flags.Administrator);

            if (!hasRole && !isAdmin) {
                return interaction.reply({
                    content: `❌ あなたはチーム「${teamName}」のメンバーまたは管理者ではありません。`,
                    ephemeral: true,
                });
            }

            // 削除確認ボタン送信
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`confirm_delete_${teamName}_${member.id}`)
                    .setLabel("✅ 本当に削除する")
                    .setStyle(ButtonStyle.Danger)
            );

            await interaction.reply({
                content: `⚠️ 本当にチーム「${teamName}」を削除しますか？`,
                components: [row],
                ephemeral: true,
            });
        }

        else if (cmd === "team_rename") {
            if (!interaction.channel.parent) {
                return interaction.reply({
                    content: "❌ このコマンドはカテゴリー内のチャンネルでのみ使用可能です。",
                    ephemeral: true,
                });
            }

            const newName = interaction.options.getString("newname");
            const categoryName = interaction.channel.parent.name;
            const match = categoryName.match(/^Team_(.+)$/);
            if (!match) {
                return interaction.reply({
                    content: "❌ このコマンドはチームのカテゴリー内のチャンネルでのみ使用可能です。",
                    ephemeral: true,
                });
            }

            const oldTeamName = match[1];
            const oldRoleName = `Team_${oldTeamName}`;
            const oldRole = guild.roles.cache.find((r) => r.name === oldRoleName);
            if (!oldRole) {
                return interaction.reply({
                    content: `❌ ロール ${oldRoleName} が見つかりません。`,
                    ephemeral: true,
                });
            }

            const hasRole = member.roles.cache.has(oldRole.id);
            const isAdmin = member.permissions.has(PermissionsBitField.Flags.Administrator);

            if (!hasRole && !isAdmin) {
                return interaction.reply({
                    content: `❌ あなたはチーム「${oldTeamName}」のメンバーまたは管理者ではありません。`,
                    ephemeral: true,
                });
            }

            // 新しいチーム名の重複チェック
            if (
                guild.roles.cache.some((r) => r.name === `Team_${newName}`) ||
                guild.channels.cache.some((c) => c.name === `Team_${newName}` && c.type === ChannelType.GuildCategory)
            ) {
                return interaction.reply({
                    content: `❌ チーム「${newName}」は既に存在します。`,
                    ephemeral: true,
                });
            }

            try {
                await interaction.deferReply({ ephemeral: true });

                // ロール名変更
                await oldRole.setName(`Team_${newName}`);

                // カテゴリー名変更
                const category = guild.channels.cache.find(
                    (c) => c.name === `Team_${oldTeamName}` && c.type === ChannelType.GuildCategory
                );
                if (!category) {
                    return interaction.editReply({
                        content: "❌ カテゴリーが見つかりません。",
                    });
                }
                await category.setName(`Team_${newName}`);

                // カテゴリー内のテキスト・ボイスチャンネル名も変更
                const children = guild.channels.cache.filter((c) => c.parentId === category.id);
                for (const [_, child] of children) {
                    if (child.type === ChannelType.GuildText && child.name === "chat") {
                        await child.setName("chat");
                    } else if (child.type === ChannelType.GuildVoice && child.name === "voice") {
                        await child.setName("voice");
                    }
                }

                await interaction.editReply(`✅ チーム名を「${oldTeamName}」から「${newName}」に変更しました。`);
            } catch (error) {
                console.error(error);
                await interaction.editReply("❌ チーム名変更中にエラーが発生しました。");
            }
        }

        else if (cmd === "team_addmember") {
            const user = interaction.options.getUser("user");
            if (!interaction.channel.parent) {
                return interaction.reply({
                    content: "❌ このコマンドはカテゴリー内のチャンネルでのみ使用可能です。",
                    ephemeral: true,
                });
            }

            const categoryName = interaction.channel.parent.name;
            const match = categoryName.match(/^Team_(.+)$/);
            if (!match) {
                return interaction.reply({
                    content: "❌ このコマンドはチームのカテゴリー内のチャンネルでのみ使用可能です。",
                    ephemeral: true,
                });
            }

            const teamName = match[1];
            const roleName = `Team_${teamName}`;
            const role = guild.roles.cache.find((r) => r.name === roleName);
            if (!role) {
                return interaction.reply({
                    content: `❌ ロール ${roleName} が見つかりません。`,
                    ephemeral: true,
                });
            }

            try {
                // 追加するユーザーのMember取得
                const memberToAdd = await guild.members.fetch(user.id);
                if (!memberToAdd) {
                    return interaction.reply({
                        content: "❌ ユーザーがサーバーに存在しません。",
                        ephemeral: true,
                    });
                }

                await memberToAdd.roles.add(role);

                await interaction.reply({
                    content: `✅ ${user.tag} をチーム「${teamName}」に追加しました。`,
                    ephemeral: true,
                });
            } catch (error) {
                console.error(error);
                await interaction.reply({
                    content: "❌ チームメンバー追加中にエラーが発生しました。",
                    ephemeral: true,
                });
            }
        }

        else if (cmd === "team_removemember") {
            const user = interaction.options.getUser("user");
            if (!interaction.channel.parent) {
                return interaction.reply({
                    content: "❌ このコマンドはカテゴリー内のチャンネルでのみ使用可能です。",
                    ephemeral: true,
                });
            }

            const categoryName = interaction.channel.parent.name;
            const match = categoryName.match(/^Team_(.+)$/);
            if (!match) {
                return interaction.reply({
                    content: "❌ このコマンドはチームのカテゴリー内のチャンネルでのみ使用可能です。",
                    ephemeral: true,
                });
            }

            const teamName = match[1];
            const roleName = `Team_${teamName}`;
            const role = guild.roles.cache.find((r) => r.name === roleName);
            if (!role) {
                return interaction.reply({
                    content: `❌ ロール ${roleName} が見つかりません。`,
                    ephemeral: true,
                });
            }

            try {
                // 削除するユーザーのMember取得
                const memberToRemove = await guild.members.fetch(user.id);
                if (!memberToRemove) {
                    return interaction.reply({
                        content: "❌ ユーザーがサーバーに存在しません。",
                        ephemeral: true,
                    });
                }

                await memberToRemove.roles.remove(role);

                // もしそのロールのメンバーが0人ならチームを削除
                const membersWithRole = role.members;
                if (membersWithRole.size === 0) {
                    // カテゴリー削除
                    const category = guild.channels.cache.find(
                        (c) => c.name === `Team_${teamName}` && c.type === ChannelType.GuildCategory
                    );

                    if (category) {
                        const children = guild.channels.cache.filter((c) => c.parentId === category.id);
                        for (const [_, child] of children) {
                            await child.delete("チームメンバーなしのためチャンネル削除");
                        }
                        await category.delete("チームメンバーなしのためカテゴリー削除");
                    }

                    // ロール削除
                    await role.delete("チームメンバーなしのためロール削除");
                    await interaction.reply({
                        content: `✅ ${user.tag} をチーム「${teamName}」から削除し、チームはメンバーがいなくなったため削除されました。`,
                        ephemeral: true,
                    });
                    return;
                }

                await interaction.reply({
                    content: `✅ ${user.tag} をチーム「${teamName}」から削除しました。`,
                    ephemeral: true,
                });
            } catch (error) {
                console.error(error);
                await interaction.reply({
                    content: "❌ チームメンバー削除中にエラーが発生しました。",
                    ephemeral: true,
                });
            }
        }
    }

    // ボタンの押下処理（チーム削除の確認）
    else if (interaction.isButton()) {
        const parts = interaction.customId.split("_");
        if (parts.length !== 4) return;

        const [action, subAction, teamName, userId] = parts;
        if (
            action !== "confirm" ||
            subAction !== "delete" ||
            interaction.user.id !== userId
        ) {
            return interaction.reply({
                content: "❌ あなたはこのボタンを使用できません。",
                ephemeral: true,
            });
        }

        try {
            await interaction.deferUpdate();

            const roleName = `Team_${teamName}`;
            const role = guild.roles.cache.find((r) => r.name === roleName);
            const category = guild.channels.cache.find(
                (c) => c.name === roleName && c.type === ChannelType.GuildCategory
            );

            if (!role) {
                return interaction.editReply({
                    content: `❌ ロール ${roleName} が見つかりません。`,
                    components: [],
                    ephemeral: true,
                });
            }
            if (!category) {
                return interaction.editReply({
                    content: `❌ カテゴリー ${roleName} が見つかりません。`,
                    components: [],
                    ephemeral: true,
                });
            }

            // チャンネル削除
            const children = guild.channels.cache.filter((c) => c.parentId === category.id);
            for (const [_, child] of children) {
                await child.delete("チーム削除によるチャンネル削除");
            }

            // カテゴリー削除
            await category.delete("チーム削除");

            // ロール削除
            await role.delete("チーム削除");

            await interaction.editReply({
                content: `✅ チーム「${teamName}」を削除しました。`,
                components: [],
            });
        } catch (error) {
            console.error(error);
            await interaction.editReply({
                content: "❌ チーム削除中にエラーが発生しました。",
                components: [],
            });
        }
    }
});

client.on("error", (error) => {
    console.error("クライアントエラー:", error);
});

client.on("warn", (info) => {
    console.warn("クライアント警告:", info);
});

process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled Rejection:", reason);
});

process.on("uncaughtException", (error) => {
    console.error("Uncaught Exception:", error);
});

client.login(TOKEN);
