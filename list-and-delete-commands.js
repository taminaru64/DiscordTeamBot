require("dotenv").config();
const { REST, Routes } = require("discord.js");

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
    try {
        // ==============================
        // 🔍 グローバルコマンド 一覧取得
        // ==============================
        const globalCommands = await rest.get(
            Routes.applicationCommands(CLIENT_ID),
        );
        console.log("🌐 グローバルコマンド一覧:");
        for (const cmd of globalCommands) {
            console.log(`- ${cmd.name} (${cmd.id})`);
        }

        // ==============================
        // ❌ グローバルコマンド 一括削除
        // ==============================
        for (const cmd of globalCommands) {
            await rest.delete(Routes.applicationCommand(CLIENT_ID, cmd.id));
            console.log(`🗑️ グローバルコマンド '${cmd.name}' を削除しました。`);
        }

        // ==============================
        // 🔍 ギルドコマンド 一覧取得
        // ==============================
        const guildCommands = await rest.get(
            Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
        );
        console.log("\n🏠 ギルドコマンド一覧:");
        for (const cmd of guildCommands) {
            console.log(`- ${cmd.name} (${cmd.id})`);
        }

        // ==============================
        // ❌ ギルドコマンド 一括削除
        // ==============================
        for (const cmd of guildCommands) {
            await rest.delete(
                Routes.applicationGuildCommand(CLIENT_ID, GUILD_ID, cmd.id),
            );
            console.log(`🗑️ ギルドコマンド '${cmd.name}' を削除しました。`);
        }

        console.log("\n✅ 全コマンドの削除が完了しました！");
    } catch (error) {
        console.error("❌ エラー:", error);
    }
})();
