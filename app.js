/* eslint-disable no-underscore-dangle,no-console,no-eval,no-await-in-loop */
const Datastore = require('nedb-promise').datastore;
const TelegramBot = require('tgfancy');
const scheduler = require('node-schedule');

const db = {
  users: Datastore({
    filename: 'NeDB/users.json',
    autoload: true,
  }),
};

const token = '531554554:AAEm4Xd_weYCZrHiizE1UnpkXx2Qna5lyWQ';
const bot = new TelegramBot(token, { polling: true });

function declOfNum(number, titles) {
  const cases = [2, 0, 1, 1, 1, 2];
  return titles[(number % 100 > 4 && number % 100 < 20) ? 2 :
    cases[(number % 10 < 5) ? number % 10 : 5]];
}

bot.onText(/\/kick(.*)/, async (msg, match) => {
  const userId = msg.from.id;
  const chatId = msg.chat.id;
  const senderDoc = await db.users.findOne({ _id: userId });
  let error = 0;
  if (senderDoc && senderDoc.admin) {
    const atPos = match[0].search('@');
    if (atPos !== -1) {
      const username = match[0].slice(atPos + 1);
      const kickDoc = await db.users.findOne({ username });
      if (kickDoc) {
        try {
          await bot.kickChatMember(chatId, kickDoc._id, false);
        } catch (err) {
          error = err.response.body.error_code;
        }
        if (!error) {
          await bot.sendMessage(chatId, `@${username} был кикнут `);
        } else {
          await bot.sendMessage(chatId, 'Либо у меня нету прав администратора, либо вы пытаетесь кикнуть админа.');
        }
      } else {
        await bot.sendMessage(chatId, 'Пользователь не писал ничего в этот чат, не могу кикнуть.');
      }
    } else if (msg.reply_to_message) {
      try {
        await bot.kickChatMember(chatId, msg.reply_to_message.from.id, false);
      } catch (err) {
        error = err.response.body.error_code;
      }
      if (!error) {
        await bot.sendMessage(chatId, `@${msg.reply_to_message.from.username} был кикнут `);
      } else {
        await bot.sendMessage(chatId, 'Либо у меня нету прав администратора, либо вы пытаетесь кикнуть админа.');
      }
    }
  }
});

bot.onText(/\/ban(.*)/, async (msg, match) => {
  const userId = msg.from.id;
  const chatId = msg.chat.id;
  const senderDoc = await db.users.findOne({ _id: userId });
  let error = 0;
  if (senderDoc && senderDoc.admin) {
    const atPos = match[0].search('@');
    const timeMatch = match[0].match(/\/ban(?: )?(?:@.[^ ]*)?(?: )?(\d+h)?(?: )?(\d+m)?/);
    if (timeMatch[1] || timeMatch[2]) {
      let banHour = 0;
      let banMinute = 0;
      if (timeMatch[1]) {
        banHour = parseInt(timeMatch[1].replace('h', ''), 10);
      }
      if (timeMatch[2]) {
        banMinute = parseInt(timeMatch[2].replace('m', ''), 10);
      }
      if (atPos !== -1) {
        const username = match[0].match(/\/ban(?: )?(?:@)(.[^ ]*)/)[1];
        const banDoc = await db.users.findOne({ username });
        if (banDoc) {
          try {
            await bot.kickChatMember(chatId, banDoc._id);
          } catch (err) {
            error = err.response.body.error_code;
          }
          if (!error) {
            const unban = scheduler.scheduleJob(new Date(Date.now() + (banHour * 3600000) +
              (banMinute * 60000)), async () => {
              await bot.unbanChatMember(chatId, banDoc._id);
              await bot.sendMessage(chatId, `Бан для @${username} прошел`);
            });
            console.log(unban.nextInvocation());
            await bot.sendMessage(chatId, `@${username} был забанен на ${banHour} ${declOfNum(banHour, ['час', 'часа', 'часов'])} и ${banMinute} ${declOfNum(banMinute, ['минуту', 'минуты', 'минут'])}`);
          } else {
            await bot.sendMessage(chatId, 'Либо у меня нету прав администратора, либо вы пытаетесь забанить админа.');
          }
        } else {
          await bot.sendMessage(chatId, 'Пользователь не писал ничего в этот чат, не могу забанить.');
        }
      } else if (msg.reply_to_message) {
        try {
          await bot.kickChatMember(chatId, msg.reply_to_message.from.id);
        } catch (err) {
          error = err.response.body.error_code;
        }
        if (!error) {
          const unban = scheduler.scheduleJob(new Date(Date.now() + (banHour * 3600000) +
            (banMinute * 60000)), async () => {
            await bot.unbanChatMember(chatId, msg.reply_to_message.from.id);
            await bot.sendMessage(chatId, `Бан для @${msg.reply_to_message.from.username} прошел`);
          });
          console.log(unban.nextInvocation());
          await bot.sendMessage(chatId, `@${msg.reply_to_message.from.username} был забанен на ${banHour} ${declOfNum(banHour, ['час', 'часа', 'часов'])} и ${banMinute} ${declOfNum(banMinute, ['минуту', 'минуты', 'минут'])}`);
        } else {
          await bot.sendMessage(chatId, 'Либо у меня нету прав администратора, либо вы пытаетесь забанить админа.');
        }
      }
    } else if (atPos !== -1) {
      const username = match[0].match(/\/ban(?: )?(?:@)(.[^ ]*)/)[1];
      const banDoc = await db.users.findOne({ username });
      if (banDoc) {
        try {
          await bot.kickChatMember(chatId, banDoc._id);
        } catch (err) {
          error = err.response.body.error_code;
        }
        if (!error) {
          await bot.sendMessage(chatId, `@${username} был забанен навсегда `);
        } else {
          await bot.sendMessage(chatId, 'Либо у меня нету прав администратора, либо вы пытаетесь забанить админа.');
        }
      } else {
        await bot.sendMessage(chatId, 'Пользователь не писал ничего в этот чат, не могу забанить.');
      }
    } else if (msg.reply_to_message) {
      try {
        await bot.kickChatMember(chatId, msg.reply_to_message.from.id);
      } catch (err) {
        error = err.response.body.error_code;
      }
      if (!error) {
        await bot.sendMessage(chatId, `@${msg.reply_to_message.from.username} был забанен навсегда `);
      } else {
        await bot.sendMessage(chatId, 'Либо у меня нету прав администратора, либо вы пытаетесь забанить админа.');
      }
    }
  }
});

bot.onText(/\/promoteMe/, async (msg) => {
  const userId = msg.from.id;
  const chatId = msg.chat.id;
  const senderDoc = await db.users.findOne({ _id: userId });
  if (senderDoc) {
    await db.users.update({ _id: userId }, { $set: { admin: true } });
  } else {
    await db.users.insert({
      _id: userId,
      username: msg.from.username,
      first_name: msg.from.first_name,
      admin: true,
    });
  }
  await bot.sendMessage(chatId, 'Теперь ты админ!');
});

bot.on('message', async (msg) => {
  const userId = msg.from.id;
  const senderDoc = await db.users.findOne({ _id: userId });
  if (!senderDoc) {
    await db.users.insert({
      _id: userId,
      username: msg.from.username,
      first_name: msg.from.first_name,
      admin: false,
    });
  }
});
