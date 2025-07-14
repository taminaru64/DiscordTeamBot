require("dotenv").config();

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
});

const deployCommands = require("./deploy-commands");
const { Client, GatewayIntentBits, PermissionsBitField, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const express = require("express");

(async () => {
  try {
    // まずコマンド登録を完了させる
    await deployCommands();

    // Discordクライアント作成
    const client = new Client({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
    });

    client.once("ready", () => {
      console.log(`✅ ログイン成功：${client.user.tag}`);
    });

    client.on("interactionCreate", async (interaction) => {
      if (interaction.isChatInputCommand()) {
        const guild = interaction.guild;

        if (interaction.commandName === "team_create") {
          const originalName = interaction.options.getString("name");
          const teamName = originalName; // 大文字小文字そのまま保持

          try {
            await interaction.deferReply({ ephemeral: true });

            // チームが既にあるかチェック
            const existingRole = guild.roles.cache.find((r) => r.name === `Team_${teamName}`);
            if (existingRole) {
              return interaction.editReply(`❌ 既にチーム「${teamName}」は存在します。別の名前を指定してください。`);
            }

            const role = await guild.roles.create({
              name: `Team_${teamName}`,
              reason: `チーム ${teamName} 用のロール作成`,
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
              name: `テキストチャンネル`,
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
              name: `ボイスチャンネル`,
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
                  deny: [PermissionsBitField.Flags.ManageChannels],
                },
              ],
            });

            await interaction.member.roles.add(role);

            await interaction.editReply(`✅ チーム「${originalName}」を作成しました！`);
          } catch (error) {
            console.error(error);
            await interaction.editReply("❌ チーム作成中にエラーが発生しました。");
          }
        } else if (interaction.commandName === "team_delete") {
          const member = interaction.member;
          const channel = interaction.channel;

          if (!channel.parent) {
            return interaction.reply({
              content: "❌ このコマンドはカテゴリーに属するチャンネルでのみ使用できます。",
              ephemeral: true,
            });
          }

          const categoryName = channel.parent.name;
          const match = categoryName.match(/^Team_(.+)$/);
          if (!match) {
            return interaction.reply({
              content: "❌ このコマンドはチームのカテゴリー内のチャンネルでのみ使用できます。",
              ephemeral: true,
            });
          }

          const teamName = match[1]; // 大文字小文字そのまま保持
          const roleName = `Team_${teamName}`;
          const role = member.roles.cache.find((r) => r.name === roleName);

          if (!role) {
            return interaction.reply({
              content: `❌ あなたはチーム「${teamName}」のメンバーではありません。`,
              ephemeral: true,
            });
          }

          const isAdmin = member.permissions.has(PermissionsBitField.Flags.Administrator);

          if (!isAdmin && !member.roles.cache.has(role.id)) {
            return interaction.reply({
              content: "❌ このチームを削除する権限がありません。",
              ephemeral: true,
            });
          }

          // 削除確認ボタンを送る
          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`confirm_delete_${teamName}_${member.id}`)
              .setLabel("✅ 本当に削除する")
              .setStyle(ButtonStyle.Danger),
          );

          await interaction.reply({
            content: `⚠️ 本当にチーム「${teamName}」を削除しますか？`,
            components: [row],
            ephemeral: true,
          });
        } else if (interaction.commandName === "team_addmember") {
          await interaction.deferReply({ ephemeral: true });
          const userToAdd = interaction.options.getUser("user");
          const memberToAdd = await interaction.guild.members.fetch(userToAdd.id);
          const channel = interaction.channel;

          if (!channel.parent) {
            return interaction.editReply({
              content: "❌ このコマンドはカテゴリーに属するチャンネルでのみ使用できます。",
            });
          }

          const categoryName = channel.parent.name;
          const match = categoryName.match(/^Team_(.+)$/);
          if (!match) {
            return interaction.editReply({
              content: "❌ このコマンドはチームのカテゴリー内のチャンネルでのみ使用できます。",
            });
          }

          const teamName = match[1];
          const roleName = `Team_${teamName}`;
          const role = interaction.guild.roles.cache.find((r) => r.name === roleName);

          if (!role) {
            return interaction.editReply({
              content: `❌ ロール「${roleName}」が見つかりません。`,
            });
          }

          try {
            await memberToAdd.roles.add(role);
            await interaction.editReply(`✅ ユーザー ${userToAdd.tag} をチーム「${teamName}」に追加しました。`);
          } catch (error) {
            console.error(error);
            await interaction.editReply("❌ チームメンバーの追加中にエラーが発生しました。");
          }
        } else if (interaction.commandName === "team_removemember") {
          await interaction.deferReply({ ephemeral: true });
          const userToRemove = interaction.options.getUser("user");
          const memberToRemove = await interaction.guild.members.fetch(userToRemove.id);
          const channel = interaction.channel;

          if (!channel.parent) {
            return interaction.editReply({
              content: "❌ このコマンドはカテゴリーに属するチャンネルでのみ使用できます。",
            });
          }

          const categoryName = channel.parent.name;
          const match = categoryName.match(/^Team_(.+)$/);
          if (!match) {
            return interaction.editReply({
              content: "❌ このコマンドはチームのカテゴリー内のチャンネルでのみ使用できます。",
            });
          }

          const teamName = match[1];
          const roleName = `Team_${teamName}`;
          const role = interaction.guild.roles.cache.find((r) => r.name === roleName);

          if (!role) {
            return interaction.editReply({
              content: `❌ ロール「${roleName}」が見つかりません。`,
            });
          }

          try {
            await memberToRemove.roles.remove(role);
            await interaction.editReply(`✅ ユーザー ${userToRemove.tag} をチーム「${teamName}」から外しました。`);

            // ロールを持つメンバーがいなければチームを自動削除
            const membersWithRole = role.members;
            if (membersWithRole.size === 0) {
              const category = interaction.guild.channels.cache.find(
                (c) => c.name === `Team_${teamName}` && c.type === ChannelType.GuildCategory,
              );
              if (category) {
                const children = interaction.guild.channels.cache.filter((c) => c.parentId === category.id);
                for (const [, child] of children) {
                  await child.delete("チームメンバーゼロのためチャンネル削除");
                }
                await category.delete("チームメンバーゼロのためカテゴリー削除");
              }
              await role.delete("チームメンバーゼロのためロール削除");
            }
          } catch (error) {
            console.error(error);
            await interaction.editReply("❌ チームメンバーの削除中にエラーが発生しました。");
          }
        } else if (interaction.commandName === "team_rename") {
          await interaction.deferReply({ ephemeral: true });
          const newName = interaction.options.getString("new_name");
          const channel = interaction.channel;

          if (!channel.parent) {
            return interaction.editReply({
              content: "❌ このコマンドはカテゴリーに属するチャンネルでのみ使用できます。",
            });
          }

          const categoryName = channel.parent.name;
          const match = categoryName.match(/^Team_(.+)$/);
          if (!match) {
            return interaction.editReply({
              content: "❌ このコマンドはチームのカテゴリー内のチャンネルでのみ使用できます。",
            });
          }

          const oldTeamName = match[1];
          const oldRoleName = `Team_${oldTeamName}`;
          const oldRole = interaction.guild.roles.cache.find((r) => r.name === oldRoleName);

          if (!oldRole) {
            return interaction.editReply({
              content: `❌ ロール「${oldRoleName}」が見つかりません。`,
            });
          }

          try {
            // 新しいチーム名のロールが既にあればエラー
            const newRoleName = `Team_${newName}`;
            if (interaction.guild.roles.cache.find((r) => r.name === newRoleName)) {
              return interaction.editReply(`❌ チーム「${newName}」は既に存在します。`);
            }

            await oldRole.setName(newRoleName);

            const category = interaction.guild.channels.cache.find(
              (c) => c.name === `Team_${oldTeamName}` && c.type === ChannelType.GuildCategory,
            );

            if (category) {
              await category.setName(newRoleName);

              const children = interaction.guild.channels.cache.filter((c) => c.parentId === category.id);
              for (const [, child] of children) {
                // VCは名前を「ボイスチャンネル」、テキストは「テキストチャンネル」のままにしていますが
                // 名前を変えたい場合はここで変更してください
              }
            }

            await interaction.editReply(`✅ チーム名を「${oldTeamName}」から「${newName}」に変更しました。`);
          } catch (error) {
            console.error(error);
            await interaction.editReply("❌ チーム名変更中にエラーが発生しました。");
          }
        }
      } else if (interaction.isButton()) {
        const parts = interaction.customId.split("_");
        const action = parts[0];
        const subAction = parts[1];
        const teamName = parts[2];
        const userId = parts[3];

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

        const guild = interaction.guild;
        const role = guild.roles.cache.find((r) => r.name === `Team_${teamName}`);
        if (!role) {
          return interaction.reply({
            content: `❌ ロール Team_${teamName} が見つかりません。`,
            ephemeral: true,
          });
        }

        const category = guild.channels.cache.find(
          (c) => c.name === `Team_${teamName}` && c.type === ChannelType.GuildCategory,
        );

        if (!category) {
          return interaction.reply({
            content: `❌ カテゴリー Team_${teamName} が見つかりません。`,
            ephemeral: true,
          });
        }

        try {
          const children = guild.channels.cache.filter(
            (c) => c.parentId === category.id,
          );
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
      }
    });

    // Botログイン
    await client.login(process.env.TOKEN);

    // ExpressでWebサーバー起動（Render用）
    const app = express();
    app.get("/", (req, res) => {
      res.send("Bot is alive!");
    });
    app.listen(3000, () => {
      console.log("🌐 Webサーバーがポート3000で起動しました");
    });

  } catch (e) {
    console.error("🚫 起動時エラー:", e);
  }
})();
