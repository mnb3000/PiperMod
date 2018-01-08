/* eslint-disable no-underscore-dangle,no-console,no-eval,no-await-in-loop */
const Datastore = require('nedb-promise').datastore;
const TelegramBot = require('tgfancy');

const db = {
  users: Datastore({
    filename: 'NeDB/users.json',
    autoload: true,
  }),
};

const token = '531554554:AAEm4Xd_weYCZrHiizE1UnpkXx2Qna5lyWQ';
const bot = new TelegramBot(token, { polling: true });

bot.onText(/\/promoteMe/, async (msg) => {
  const chatId = msg.chat.id;
  await db.users.insert({
    _id: chatId,
    username: msg.chat.username,
    admin: true,
  });
  await bot.sendMessage(chatId, 'Ты админ!');
});
