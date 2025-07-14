require("dotenv").config();
const express = require("express");
const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  ChannelType,
  Partials,
  Routes,
  REST,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Events,
} = require("discord.js");

const app = express();
app.get("/", (req, res) => {
  res.send("Bot is alive!");
});
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`\u{1F310} Webサーバーがポート${port}で起動しました`);
});

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
  partials: [Partials.Channel],
});

client.once("ready", () => {
  console.log(`\u{2705} ログイン成功: ${client.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isChatInputCommand()) {
    const { commandName, guild, member } = interaction;

    if (commandName === "team_create") {
      const teamName = interaction.options.getString("name");
      const roleName = `Team_${teamName}`;

      await interaction.deferReply({ ephemeral: true });

      if (guild.roles.cache.find((r) => r.name === roleName)) {
        return await interaction.editReply("❌ 同じ名前のチームがすでに存在します。");
      }

      const role = await guild.roles.create({ name: roleName });
      const category = await guild.channels.create({
        name: roleName,
        type: ChannelType.GuildCategory,
        permissionOverwrites: [
          { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
          { id: role.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ManageChannels, PermissionsBitField.Flags.Connect] },
        ],
      });

      await guild.channels.create({
        name: "テキストチャンネル",
        type: ChannelType.GuildText,
        parent: category.id,
        permissionOverwrites: [
          { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
          { id: role.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
        ],
      });

      await guild.channels.create({
        name: "ボイスチャンネル",
        type: ChannelType.GuildVoice,
        parent: category.id,
        permissionOverwrites: [
          { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
          { id: role.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.Connect] },
        ],
      });

      await member.roles.add(role);
      await interaction.editReply(`✅ チーム「${teamName}」を作成しました！`);

    } else if (commandName === "team_delete") {
      const channel = interaction.channel;
      if (!channel.parent) return await interaction.reply({ content: "❌ このチャンネルはチーム内ではありません。", ephemeral: true });

      const category = channel.parent;
      const teamName = category.name.replace(/^Team_/, "");
      const role = guild.roles.cache.find(r => r.name === `Team_${teamName}`);

      if (!role || (!member.roles.cache.has(role.id) && !member.permissions.has(PermissionsBitField.Flags.Administrator))) {
        return await interaction.reply({ content: "❌ このチームを削除する権限がありません。", ephemeral: true });
      }

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`confirm_delete_${teamName}_${member.id}`)
          .setLabel("✅ 本当に削除する")
          .setStyle(ButtonStyle.Danger)
      );

      await interaction.reply({
        content: `⚠️ チーム「${teamName}」を削除してもよろしいですか？`,
        components: [row],
        ephemeral: true,
      });

    } else if (commandName === "team_addmember") {
      const user = interaction.options.getUser("user");
      const channel = interaction.channel;
      if (!channel.parent) return await interaction.reply({ content: "❌ チーム内で実行してください。", ephemeral: true });

      const teamName = channel.parent.name.replace(/^Team_/, "");
      const role = interaction.guild.roles.cache.find(r => r.name === `Team_${teamName}`);
      if (!role) return await interaction.reply({ content: "❌ チームが見つかりません。", ephemeral: true });

      const memberToAdd = await guild.members.fetch(user.id);
      await memberToAdd.roles.add(role);
      await interaction.reply({ content: `✅ ${user.username} をチーム「${teamName}」に追加しました。`, ephemeral: true });

    } else if (commandName === "team_removemember") {
      const user = interaction.options.getUser("user");
      const channel = interaction.channel;
      if (!channel.parent) return await interaction.reply({ content: "❌ チーム内で実行してください。", ephemeral: true });

      const teamName = channel.parent.name.replace(/^Team_/, "");
      const role = interaction.guild.roles.cache.find(r => r.name === `Team_${teamName}`);
      if (!role) return await interaction.reply({ content: "❌ チームが見つかりません。", ephemeral: true });

      const memberToRemove = await guild.members.fetch(user.id);
      await memberToRemove.roles.remove(role);
      await interaction.reply({ content: `✅ ${user.username} をチーム「${teamName}」から外しました。`, ephemeral: true });

      const roleMembers = guild.members.cache.filter(m => m.roles.cache.has(role.id));
      if (roleMembers.size === 0) {
        const category = guild.channels.cache.find(c => c.name === `Team_${teamName}` && c.type === ChannelType.GuildCategory);
        if (category) {
          const children = guild.channels.cache.filter(ch => ch.parentId === category.id);
          for (const [, ch] of children) await ch.delete();
          await category.delete();
        }
        await role.delete();
      }

    } else if (commandName === "team_rename") {
      const newName = interaction.options.getString("new_name");
      const channel = interaction.channel;
      if (!channel.parent) return await interaction.reply({ content: "❌ チーム内で実行してください。", ephemeral: true });

      const oldTeamName = channel.parent.name.replace(/^Team_/, "");
      const oldRole = guild.roles.cache.find(r => r.name === `Team_${oldTeamName}`);
      if (!oldRole) return await interaction.reply({ content: "❌ 古いチームロールが見つかりません。", ephemeral: true });

      const newRoleName = `Team_${newName}`;
      await oldRole.setName(newRoleName);

      const category = channel.parent;
      await category.setName(newRoleName);

      await interaction.reply({ content: `✅ チーム名を「${newName}」に変更しました。`, ephemeral: true });
    }
  }

  if (interaction.isButton()) {
    const [action, sub, teamName, userId] = interaction.customId.split("_");
    if (action !== "confirm" || sub !== "delete" || interaction.user.id !== userId) return;

    const guild = interaction.guild;
    const role = guild.roles.cache.find(r => r.name === `Team_${teamName}`);
    const category = guild.channels.cache.find(c => c.name === `Team_${teamName}` && c.type === ChannelType.GuildCategory);

    try {
      if (category) {
        const children = guild.channels.cache.filter(ch => ch.parentId === category.id);
        for (const [, ch] of children) await ch.delete();
        await category.delete();
      }
      if (role) await role.delete();

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

client.login(process.env.TOKEN);
