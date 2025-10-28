const TelegramBot = require("node-telegram-bot-api");
require("dotenv").config();
const express = require("express");

const app = express();
const bot = new TelegramBot(process.env.TELEGRAMTOKEN, { polling: true });
const userState = new Map();
const mood = require('./moodanalyze')
const Journal = require('./journal.drive')


let gDrive = null;
let gDriveReady = null;

function waitForDrive() {
    if (!gDriveReady) {
        gDriveReady = (async () => {
            const drive = new Journal();
            await drive.init();
            console.log("📁 Google Drive initialized");
            gDrive = drive;
            return drive;
        })();
    }
    return gDriveReady;
}


function startMenu() {
    return {
        reply_markup: {
            inline_keyboard: [
                [{ text: "📝 Add Journal", callback_data: "add_journal" }],
                [{ text: "📚 List Journal", callback_data: "list_journal" }],
            ],
        },
    };
}

function listMenu() {
    return {
        reply_markup: {
            inline_keyboard: [
                [{ text: "📖 List All", callback_data: "list_all" }],
                [{ text: "🕓 Get Last", callback_data: "get_last" }],
                [{ text: "⬅️ Back", callback_data: "start" }],
            ],
        },
    };
}

function acceptMenu() {
    return {
        reply_markup: {
            inline_keyboard: [
                [{ text: "✅ Save", callback_data: "approve" }],
                [{ text: "❌ Discard", callback_data: "disapprove" }],
            ],
        },
    };
}

function buildJournalListKeyboard(journals, page = 0, pageSize = 10) {
    const start = page * pageSize;
    const end = start + pageSize;
    const slice = journals.slice(start, end);

    // Each journal becomes a button showing date + mood
    const buttons = slice.map(j => {
        const text = `${j.date} | ${j.mood} | ${j.theme}`;
        const callback_data = `open_${j.date}`; // unique ID for callback
        return [{ text, callback_data }];
    });

    // Pagination buttons
    const navButtons = [];
    if (start > 0) navButtons.push({ text: '⬅️ Prev', callback_data: `page_${page - 1}` });
    if (end < journals.length) navButtons.push({ text: 'Next ➡️', callback_data: `page_${page + 1}` });
    if (navButtons.length > 0) buttons.push(navButtons);

    return {
        reply_markup: {
            inline_keyboard: buttons
        }
    };
}


bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, "👋 Welcome!", startMenu());
});

bot.on("callback_query", async (callbackQuery) => {
    const data = callbackQuery.data;
    const chatId = callbackQuery.message.chat.id;
    const drive = await waitForDrive();
    if (data === "start") {
        bot.sendMessage(chatId ,"👋 Welcome!",startMenu());
    }

    if (data === "add_journal") {
        userState.set(chatId, { mode: "adding" });
        bot.sendMessage(chatId, "✍️ Please type your journal entry:");
    }

    if (data === "approve") {
        const state = userState.get(chatId);
        if (state?.pendingText) {
            // Example: save it here

            const date = new Date(); // Gets the current date and time
            const year = date.getFullYear();
            const month = (date.getMonth() + 1).toString().padStart(2, '0'); // Month is 0-indexed, add 1 and pad with leading zero
            const day = date.getDate().toString().padStart(2, '0');
            const id = `${year}-${month}-${day}`;

            const data = state.pendingText;
            const wordcount = data.split(" ").length;
            const moodData = mood.analyzeJournalEntry(data);
            // await gDrive.save(state.pendingText);

            const journal = {
                id,
                date,
                wordcount,
                entry: data,
                mood: moodData.mood,
                tags: moodData.themes
            }

            drive.uploadFile(true, journal);

            bot.sendMessage(chatId, "✅ Journal saved!");
            userState.delete(chatId);
            bot.sendMessage(chatId ,"👋 Welcome!",startMenu());
        }
    }

    if (data === "disapprove") {
        bot.sendMessage(chatId, "🗑️ Entry discarded.", startMenu());
        userState.delete(chatId);
    }

    if (data === "list_menu") {
        userState.set(chatId, { mode: "adding" });
        bot.sendMessage(chatId, "✍️ Please type your journal entry:");
    }


    if (data === "list_journal") {
        userState.set(chatId, { mode: "listing" });
        bot.editMessageText("👋 Welcome!", {
            chat_id: chatId,
            message_id: callbackQuery.message.message_id,
            ...listMenu(),
        });
    }
    bot.answerCallbackQuery(callbackQuery.id, { text: "Loading..." })

    if (data === "get_last") {

        const journal = await drive.getLastFile();
          const text = `📅 ${journal.date}\n📝 ${journal.entry}\n💡 Mood: ${journal.mood}\n🏷️ Tags: ${journal.themes}`;
       bot.sendMessage(chatId,text);
       bot.sendMessage(chatId ,"👋 Welcome!",startMenu());

    }
    if (data === "list_all") {

        const journals = await drive.listJournals(true, true, null, null);
        userState.set(chatId, { journals, page: 0 });
        const keyboard = buildJournalListKeyboard(journals);
        await bot.sendMessage(chatId, "Select a journal to view:", keyboard);

    }
    const state = userState.get(chatId);
    if (!state) return;
    const { journals } = state;
    if (callbackQuery.data.startsWith("open_")) {
        const date = callbackQuery.data.replace("open_", "");
        const journal = journals.find(j => j.date === date);
        if (journal) {
            const text = `📅 ${journal.date}\n📝 ${journal.entry}\n💡 Mood: ${journal.mood}\n🏷️ Tags: ${journal.themes}`;
            await bot.sendMessage(chatId, text);
        } else {
            await bot.sendMessage(chatId, "Journal not found.");
        }
    }

    // Handle pagination
    if (callbackQuery.data.startsWith("page_")) {
        const page = parseInt(callbackQuery.data.replace("page_", ""), 10);
        state.page = page;
        const keyboard = buildJournalListKeyboard(journals, page);
        await bot.editMessageReplyMarkup(keyboard.reply_markup, {
            chat_id: chatId,
            message_id: query.message.message_id
        });
    }

});

bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const state = userState.get(chatId);

    // ignore commands
    if (msg.text.startsWith("/")) return;

    if (state?.mode === "adding") {
        userState.set(chatId, { mode: "approval", pendingText: msg.text });
        bot.sendMessage(chatId, `You wrote:\n\n"${msg.text}"\n\nSave this entry?`, acceptMenu());
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));