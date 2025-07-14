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