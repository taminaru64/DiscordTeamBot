require("dotenv").config();
const { REST, Routes, SlashCommandBuilder } = require("discord.js");

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const commands = [
  new SlashCommandBuilder()
    .setName("team_create")
    .setDescription("新しいチームを作成します")
    .addStringOption(option =>
      option.setName("name").setDescription("作成するチーム名").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("team_delete")
    .setDescription("このチャンネルのチームを削除します（チームchat内でのみ使用可能）"),

  new SlashCommandBuilder()
    .setName("team_addmember")
    .setDescription("チームにメンバーを追加します（チームchat内でのみ使用可能）")
    .addUserOption(option =>
      option.setName("user").setDescription("追加するユーザー").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("team_removemember")
    .setDescription("チームからメンバーを外します（チームchat内でのみ使用可能）")
    .addUserOption(option =>
      option.setName("user").setDescription("外すユーザー").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("team_rename")
    .setDescription("チーム名を変更します（チームchat内でのみ使用可能）")
    .addStringOption(option =>
      option.setName("new_name").setDescription("新しいチーム名").setRequired(true)
    )
].map(command => command.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  try {
    console.log("\u{1F4E4} コマンド削除中...");
    const existingCommands = await rest.get(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID));
    for (const cmd of existingCommands) {
      await rest.delete(Routes.applicationGuildCommand(CLIENT_ID, GUILD_ID, cmd.id));
      console.log(`❌ 削除: ${cmd.name}`);
    }

    console.log("\u{1F4E4} コマンド登録中...");
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log("✅ コマンド登録完了！");
  } catch (error) {
    console.error("❌ コマンド登録エラー:", error);
  }
})();
