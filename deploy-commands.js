require("dotenv").config();
const { REST, Routes } = require("discord.js");

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const commands = [
  {
    name: "team_create",
    description: "新しいチームを作成します",
    options: [
      {
        name: "name",
        description: "チーム名",
        type: 3,
        required: true,
      },
    ],
  },
  {
    name: "team_delete",
    description: "このチャンネルのチームを削除します",
  },
  {
    name: "team_addmember",
    description: "チームにメンバーを追加します",
    options: [
      {
        name: "user",
        description: "追加するユーザー",
        type: 6, // USER
        required: true,
      },
    ],
  },
  {
    name: "team_removemember",
    description: "チームからメンバーを外します",
    options: [
      {
        name: "user",
        description: "外すユーザー",
        type: 6,
        required: true,
      },
    ],
  },
  {
    name: "team_rename",
    description: "チーム名を変更します",
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

async function deployCommands() {
  const rest = new REST({ version: "10" }).setToken(TOKEN);
  try {
    console.log("📤 コマンド登録中...");
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
      body: commands,
    });
    console.log("✅ コマンド登録完了！");
  } catch (error) {
    console.error("❌ コマンド登録失敗:", error);
    throw error;
  }
}

module.exports = deployCommands;
