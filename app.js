/* eslint-disable no-underscore-dangle,no-console,no-eval,no-await-in-loop,no-loop-func */
const Datastore = require('nedb-promise').datastore;
const TelegramBot = require('tgfancy');
const scheduler = require('node-schedule');

const db = {
  users: Datastore({
    filename: 'NeDB/users.json',
    autoload: true,
  }),
  data: Datastore({
    filename: 'NeDB/data.json',
    autoload: true,
  }),
};

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });
const banArr = [];
let banCounter = 0;

async function init() {
  const timedBanned = await db.users.find({
    banDate: {
      $ne: false,
    },
  });
  const ugolBanned = await db.users.find({ ugol: true });
  ugolBanned.forEach(async (ugolDoc) => {
    await db.users.update(
      { _id: ugolDoc._id },
      { $set: { ugol: false } },
    );
  });
  for (let i = 0; i < timedBanned.length; i += 1) {
    db.users.update(
      { username: timedBanned[i].username },
      { $set: { ban: banCounter, banDate: timedBanned[i].banDate } },
    );
    banArr[banCounter] = scheduler.scheduleJob(timedBanned[i].banDate, async () => {
      await bot.unbanChatMember(timedBanned[i].banChat, timedBanned[i]._id);
      await bot.sendMessage(timedBanned[i].banChat, `Бан для @${timedBanned[i].username} прошел`);
      await db.users.update(
        { username: timedBanned[i].username },
        { $set: { ban: false, banDate: false } },
      );
      console.log(`Scheduled unban for ${timedBanned[i].username}`);
    });
    banCounter += 1;
  }
}

function declamaitionOfNum(number, titles) {
  const cases = [2, 0, 1, 1, 1, 2];
  return titles[(number % 100 > 4 && number % 100 < 20) ? 2 :
    cases[(number % 10 < 5) ? number % 10 : 5]];
}

function coinFlip() {
  return (Math.floor(Math.random() * 2) === 0);
}

init()
  .catch((err) => {
    console.log(err);
  });

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

bot.onText(/\/promote(.*)/, async (msg, match) => {
  const userId = msg.from.id;
  const chatId = msg.chat.id;
  const senderDoc = await db.users.findOne({ _id: userId });
  if (senderDoc && senderDoc.admin) {
    const atPos = match[0].search('@');
    if (atPos !== -1) {
      const username = match[0].slice(atPos + 1);
      const promoteDoc = await db.users.findOne({ username });
      if (promoteDoc) {
        await db.users.update({ username }, { $set: { admin: true } });
        await bot.sendMessage(chatId, `@${username} теперь админ `);
      } else {
        await bot.sendMessage(chatId, 'Пользователь не писал ничего в этот чат, не могу дать админку.');
      }
    } else if (msg.reply_to_message) {
      await db.users.update({ _id: msg.reply_to_message.from.id }, { $set: { admin: true } });
      await bot.sendMessage(chatId, `@${msg.reply_to_message.from.username} теперь админ `);
    }
  }
});

bot.onText(/\/demote(.*)/, async (msg, match) => {
  const userId = msg.from.id;
  const chatId = msg.chat.id;
  const senderDoc = await db.users.findOne({ _id: userId });
  if (senderDoc && senderDoc.admin) {
    const atPos = match[0].search('@');
    if (atPos !== -1) {
      const username = match[0].slice(atPos + 1);
      const demoteDoc = await db.users.findOne({ username });
      if (demoteDoc) {
        await db.users.update({ username }, { $set: { admin: false } });
        await bot.sendMessage(chatId, `@${username} больше не админ `);
      } else {
        await bot.sendMessage(chatId, 'Пользователь не писал ничего в этот чат, не могу дать админку.');
      }
    } else if (msg.reply_to_message) {
      await db.users.update({ _id: msg.reply_to_message.from.id }, { $set: { admin: false } });
      await bot.sendMessage(chatId, `@${msg.reply_to_message.from.username} больше не админ `);
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
        if (banDoc && !banDoc.ban) {
          try {
            await bot.kickChatMember(chatId, banDoc._id);
          } catch (err) {
            error = err.response.body.error_code;
          }
          if (!error) {
            const banDate = new Date(Date.now() + (banHour * 3600000) + (banMinute * 60000));
            db.users.update({ username }, { $set: { ban: banCounter, banDate, banChat: chatId } });
            banArr[banCounter] = scheduler.scheduleJob(banDate, async () => {
              await bot.unbanChatMember(chatId, banDoc._id);
              await bot.sendMessage(chatId, `Бан для @${username} прошел`);
              await db.users.update(
                { username },
                { $set: { ban: false, banDate: false, banChat: false } },
              );
            });
            console.log(banArr[banCounter].nextInvocation());
            banCounter += 1;
            await bot.sendMessage(chatId, `@${username} был забанен на ${banHour} ${declamaitionOfNum(banHour, ['час', 'часа', 'часов'])} и ${banMinute} ${declamaitionOfNum(banMinute, ['минуту', 'минуты', 'минут'])}`);
          } else {
            await bot.sendMessage(chatId, 'Либо у меня нету прав администратора, либо вы пытаетесь забанить админа.');
          }
        } else {
          await bot.sendMessage(chatId, 'Пользователь уже забанен');
        }
      } else if (msg.reply_to_message) {
        const banDoc = await db.users.findOne({ _id: msg.reply_to_message.from.id });
        if (banDoc && !banDoc.ban) {
          try {
            await bot.kickChatMember(chatId, msg.reply_to_message.from.id);
          } catch (err) {
            error = err.response.body.error_code;
          }
          if (!error) {
            const banDate = new Date(Date.now() + (banHour * 3600000) + (banMinute * 60000));
            db.users.update(
              { _id: msg.reply_to_message.from.id },
              { $set: { ban: banCounter, banDate, banChat: chatId } },
            );
            banArr[banCounter] = scheduler.scheduleJob(banDate, async () => {
              await bot.unbanChatMember(chatId, msg.reply_to_message.from.id);
              await bot.sendMessage(chatId, `Бан для @${msg.reply_to_message.from.username} прошел`);
              await db.users.update({ _id: msg.reply_to_message.from.id }, {
                $set: {
                  ban: false,
                  banDate: false,
                  banChat: false,
                },
              });
            });
            console.log(banArr[banCounter].nextInvocation());
            banCounter += 1;
            await bot.sendMessage(chatId, `@${msg.reply_to_message.from.username} был забанен на ${banHour} ${declamaitionOfNum(banHour, ['час', 'часа', 'часов'])} и ${banMinute} ${declamaitionOfNum(banMinute, ['минуту', 'минуты', 'минут'])}`);
          } else {
            await bot.sendMessage(chatId, 'Либо у меня нету прав администратора, либо вы пытаетесь забанить админа.');
          }
        } else {
          await bot.sendMessage(chatId, 'Пользователь уже забанен');
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
          db.users.update({ username }, { $set: { ban: 'perm', banDate: false, banChat: chatId } });
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
        db.users.update({ _id: msg.reply_to_message.from.id }, { $set: { ban: 'perm', banDate: false, banChat: chatId } });
        await bot.sendMessage(chatId, `@${msg.reply_to_message.from.username} был забанен навсегда `);
      } else {
        await bot.sendMessage(chatId, 'Либо у меня нету прав администратора, либо вы пытаетесь забанить админа.');
      }
    }
  }
});

bot.onText(/\/unban(.*)/, async (msg, match) => {
  const userId = msg.from.id;
  const chatId = msg.chat.id;
  const senderDoc = await db.users.findOne({ _id: userId });
  let error = 0;
  if (senderDoc && senderDoc.admin) {
    const atPos = match[0].search('@');
    if (atPos !== -1) {
      const username = match[0].slice(atPos + 1);
      const unbanDoc = await db.users.findOne({ username });
      if (unbanDoc && unbanDoc.ban) {
        try {
          await bot.unbanChatMember(chatId, unbanDoc._id);
        } catch (err) {
          error = err.response.body.error_code;
        }
        if (!error) {
          const unbanTimeDoc = await db.users.findOne({ username });
          if (unbanTimeDoc.ban !== 'perm') {
            banArr[unbanTimeDoc.ban].cancel();
          }
          await db.users.update(
            { username },
            { $set: { ban: false, banDate: false, banChat: false } },
          );
          await bot.sendMessage(chatId, `@${username} разбанен `);
        } else {
          await bot.sendMessage(chatId, 'Либо у меня нету прав администратора, либо вы пытаетесь РАЗБАНИТЬ админа. (вы чо, тупые?)');
        }
      } else {
        await bot.sendMessage(chatId, 'Пользователь не забанен');
      }
    } else if (msg.reply_to_message) {
      const replyUnbanDoc = await db.users.findOne({ _id: msg.reply_to_message.from.id });
      if (replyUnbanDoc && replyUnbanDoc.ban) {
        try {
          await bot.unbanChatMember(chatId, msg.reply_to_message.from.id);
        } catch (err) {
          error = err.response.body.error_code;
        }
        if (!error) {
          const unbanTimeDoc = await db.users.findOne({ _id: msg.reply_to_message.from.id });
          if (unbanTimeDoc.ban !== 'perm') {
            banArr[unbanTimeDoc.ban].cancel();
          }
          await db.users.update({ _id: msg.reply_to_message.from.id }, {
            $set: {
              ban: false,
              banDate: false,
              banChat: false,
            },
          });
          await bot.sendMessage(chatId, `@${msg.reply_to_message.from.username} разбанен `);
        } else {
          await bot.sendMessage(chatId, 'Либо у меня нету прав администратора, либо вы пытаетесь РАЗБАНИТЬ админа. (вы чо, тупые?)');
        }
      } else {
        await bot.sendMessage(chatId, 'Пользователь не забанен');
      }
    }
  }
});

bot.onText(/\/ugol(.*)/, async (msg, match) => {
  const userId = msg.from.id;
  const chatId = msg.chat.id;
  const senderDoc = await db.users.findOne({ _id: userId });
  const atPos = match[0].search('@');
  const timeMatch = match[0].match(/\/ugol(?: )?(?:@.[^ ]*)?(?: )?(\d+h)?(?: )?(\d+m)?/);
  if (senderDoc && senderDoc.admin) {
    if (timeMatch[1] || timeMatch[2]) {
      let ugolHour = 0;
      let ugolMinute = 0;
      if (timeMatch[1]) {
        ugolHour = parseInt(timeMatch[1].replace('h', ''), 10);
      }
      if (timeMatch[2]) {
        ugolMinute = parseInt(timeMatch[2].replace('m', ''), 10);
      }
      if (atPos !== -1) {
        const username = match[0].match(/\/ugol(?: )?(?:@)(.[^ ]*)/)[1];
        const ugolDoc = await db.users.findOne({ username });
        if (ugolDoc && !ugolDoc.ugol) {
          const ugolDate = new Date(Date.now() + (ugolHour * 3600000) + (ugolMinute * 60000));
          db.users.update({ username }, { $set: { ugol: true } });
          // eslint-disable-next-line no-unused-vars
          const job = scheduler.scheduleJob(ugolDate, async () => {
            await bot.unbanChatMember(chatId, ugolDoc._id);
            await bot.sendMessage(chatId, `@${username} вышел из угла`);
            await db.users.update(
              { username },
              { $set: { ugol: false } },
            );
          });
          await bot.sendMessage(chatId, `@${username} , в угол! Подумай над своим поведением ${ugolHour} ${declamaitionOfNum(ugolHour, ['час', 'часа', 'часов'])} и ${ugolMinute} ${declamaitionOfNum(ugolMinute, ['минуту', 'минуты', 'минут'])}`);
        } else {
          await bot.sendMessage(chatId, 'Пользователь уже в углу');
        }
      } else if (msg.reply_to_message) {
        const ugolDoc = await db.users.findOne({ _id: msg.reply_to_message.from.id });
        if (ugolDoc && !ugolDoc.ugol) {
          const ugolDate = new Date(Date.now() + (ugolHour * 3600000) + (ugolMinute * 60000));
          db.users.update(
            { _id: msg.reply_to_message.from.id },
            { $set: { ugol: true } },
          );
          // eslint-disable-next-line no-unused-vars
          const job = scheduler.scheduleJob(ugolDate, async () => {
            await bot.sendMessage(chatId, `@${msg.reply_to_message.from.username} вышел из угла`);
            await db.users.update({ _id: msg.reply_to_message.from.id }, {
              $set: { ugol: false },
            });
          });
          await bot.sendMessage(chatId, `@${msg.reply_to_message.from.username}, в угол! Подумай над своим поведением ${ugolHour} ${declamaitionOfNum(ugolHour, ['час', 'часа', 'часов'])} и ${ugolMinute} ${declamaitionOfNum(ugolMinute, ['минуту', 'минуты', 'минут'])}`);
        } else {
          await bot.sendMessage(chatId, 'Пользователь уже в углу');
        }
      }
    }
  }
});

bot.onText(/\/setux/, async (msg) => {
  const chatId = msg.chat.id;
  if (msg.from.username === 'Setux' || msg.from.username === 'mnb3000') {
    if (coinFlip()) {
      await bot.sendMessage(chatId, '*@Setux переходит в ПП!*', { parse_mode: 'Markdown' });
    } else {
      await bot.sendMessage(chatId, '@Setux не переходит в ПП(');
    }
  } else {
    await bot.sendMessage(chatId, 'Ты не Сетух!');
  }
});

bot.onText(/\/del/, async (msg) => {
  const userId = msg.from.id;
  const chatId = msg.chat.id;
  const senderDoc = await db.users.findOne({ _id: userId });
  if (senderDoc && senderDoc.admin && msg.reply_to_message) {
    await bot.deleteMessage(chatId, msg.message_id);
    await bot.deleteMessage(chatId, msg.reply_to_message.message_id);
  }
});

bot.onText(/\/mute(.*)/, async (msg, match) => {
  const userId = msg.from.id;
  const chatId = msg.chat.id;
  const senderDoc = await db.users.findOne({ _id: userId });
  let error = 0;
  if (senderDoc && senderDoc.admin) {
    const atPos = match[0].search('@');
    const timeMatch = match[0].match(/\/mute(?: )?(?:@.[^ ]*)?(?: )?(\d+h)?(?: )?(\d+m)?/);
    if (timeMatch[1] || timeMatch[2]) {
      let muteHour = 0;
      let muteMinute = 0;
      if (timeMatch[1]) {
        muteHour = parseInt(timeMatch[1].replace('h', ''), 10);
      }
      if (timeMatch[2]) {
        muteMinute = parseInt(timeMatch[2].replace('m', ''), 10);
      }
      if (atPos !== -1) {
        const username = match[0].match(/\/mute(?: )?(?:@)(.[^ ]*)/)[1];
        const muteDoc = await db.users.findOne({ username });
        if (muteDoc) {
          try {
            await bot.restrictChatMember(chatId, muteDoc._id, {
              until_date: Math.round((Date.now() + (muteHour * 3600000) +
                (muteMinute * 60000)) / 1000),
              can_send_messages: false,
              can_send_media_messages: false,
              can_send_other_messages: false,
              can_add_web_page_previews: false,
            });
          } catch (err) {
            error = err.response.body.error_code;
          }
          if (!error) {
            await bot.sendMessage(chatId, `@${username} был заткнут на ${muteHour} ${declamaitionOfNum(muteHour, ['час', 'часа', 'часов'])} и ${muteMinute} ${declamaitionOfNum(muteMinute, ['минуту', 'минуты', 'минут'])}`);
          } else {
            await bot.sendMessage(chatId, 'Либо у меня нету прав администратора, либо вы пытаетесь заткнуть админа.');
          }
        } else {
          await bot.sendMessage(chatId, 'Пользователь не писал ничего в этот чат, не могу заткнуть.');
        }
      } else if (msg.reply_to_message) {
        try {
          await bot.restrictChatMember(chatId, msg.reply_to_message.from.id, {
            until_date: Math.round((Date.now() + (muteHour * 3600000) +
              (muteMinute * 60000)) / 1000),
            can_send_messages: false,
            can_send_media_messages: false,
            can_send_other_messages: false,
            can_add_web_page_previews: false,
          });
        } catch (err) {
          error = err.response.body.error_code;
        }
        if (!error) {
          await bot.sendMessage(chatId, `@${msg.reply_to_message.from.username} был заткнут на ${muteHour} ${declamaitionOfNum(muteHour, ['час', 'часа', 'часов'])} и ${muteMinute} ${declamaitionOfNum(muteMinute, ['минуту', 'минуты', 'минут'])}`);
        } else {
          await bot.sendMessage(chatId, 'Либо у меня нету прав администратора, либо вы пытаетесь заткнуть админа.');
        }
      }
    }
  }
});

bot.onText(/\/unmute(.*)/, async (msg, match) => {
  const userId = msg.from.id;
  const chatId = msg.chat.id;
  const senderDoc = await db.users.findOne({ _id: userId });
  let error = 0;
  if (senderDoc && senderDoc.admin) {
    const atPos = match[0].search('@');
    if (atPos !== -1) {
      const username = match[0].slice(atPos + 1);
      const unmuteDoc = await db.users.findOne({ username });
      if (unmuteDoc) {
        try {
          await bot.restrictChatMember(chatId, unmuteDoc._id, {
            until_date: Math.round((Date.now() / 1000) + 5),
            can_send_messages: true,
            can_send_media_messages: true,
            can_send_other_messages: true,
            can_add_web_page_previews: true,
          });
        } catch (err) {
          error = err.response.body.error_code;
        }
        if (!error) {
          await bot.sendMessage(chatId, `@${username} может говорить `);
        } else {
          await bot.sendMessage(chatId, 'Либо у меня нету прав администратора, либо вы пытаетесь РАЗМУТИТЬ админа. (вы чо, тупые?)');
        }
      } else {
        await bot.sendMessage(chatId, 'Пользователь ничего не писал в чат');
      }
    } else if (msg.reply_to_message) {
      try {
        await bot.restrictChatMember(chatId, msg.reply_to_message.from.id, {
          until_date: Math.round((Date.now() / 1000) + 5),
          can_send_messages: true,
          can_send_media_messages: true,
          can_send_other_messages: true,
          can_add_web_page_previews: true,
        });
      } catch (err) {
        error = err.response.body.error_code;
      }
      if (!error) {
        await bot.sendMessage(chatId, `@${msg.reply_to_message.from.username} может говорить `);
      } else {
        await bot.sendMessage(chatId, 'Либо у меня нету прав администратора, либо вы пытаетесь РАЗМУТИТЬ админа. (вы чо, тупые?)');
      }
    }
  }
});

bot.onText(/\/pin(.*)/, async (msg, match) => {
  const senderDoc = await db.users.findOne({ _id: msg.from.id });
  if (senderDoc && senderDoc.admin && msg.reply_to_message) {
    const chatId = msg.chat.id;
    const replyMessageId = msg.reply_to_message.message_id;
    if (match[1] === ' silent') {
      await bot.pinChatMessage(chatId, replyMessageId, { disable_notification: true });
    } else {
      await bot.pinChatMessage(chatId, replyMessageId);
    }
    await bot.deleteMessage(chatId, msg.message_id);
  }
});

bot.onText(/\/makeMnbAdminAgain/, async (msg) => {
  if (msg.from.id === 73628236) {
    const chatId = msg.chat.id;
    await db.users.update({ _id: 73628236 }, { $set: { admin: true } });
    await bot.sendMessage(chatId, 'Мой батя @mnb3000 снова админ!');
  }
});

bot.onText(/#идеядляПП/i, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(-1001165254294, `Идея для бота от @${msg.from.username}:
${msg.text}`);
  await bot.sendMessage(chatId, 'Ваша идея отправлена на рассмотрение!');
});

/* bot.onText(/\/promoteMe/, async (msg) => {
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
      ban: false,
      admin: true,
    });
  }
  await bot.sendMessage(chatId, 'Теперь ты админ!');
}); */

bot.onText(/\/welcome ([^]*)/, async (msg, match) => {
  const userId = msg.from.id;
  const chatId = msg.chat.id;
  const senderDoc = await db.users.findOne({ _id: userId });
  if (senderDoc && senderDoc.admin) {
    const firstWelcomeDoc = await db.data.findOne({ name: 'welcome' });
    if (firstWelcomeDoc) {
      await db.data.update({ name: 'welcome' }, { $set: { text: match[1] } });
    } else {
      await db.data.insert({
        name: 'welcome',
        text: match[1],
      });
    }
    await bot.sendMessage(chatId, 'Приветствие обновлено!');
  }
});

bot.onText(/\/rules ([^]*)/, async (msg, match) => {
  const userId = msg.from.id;
  const chatId = msg.chat.id;
  const senderDoc = await db.users.findOne({ _id: userId });
  if (senderDoc && senderDoc.admin) {
    const firstRulesDoc = await db.data.findOne({ name: 'rules' });
    if (firstRulesDoc) {
      await db.data.update({ name: 'rules' }, { $set: { text: match[1] } });
    } else {
      await db.data.insert({
        name: 'rules',
        text: match[1],
      });
    }
    await bot.sendMessage(chatId, 'Правила обновлены!');
  }
});

bot.onText(/\/startLs ([^]*)/, async (msg, match) => {
  const userId = msg.from.id;
  const chatId = msg.chat.id;
  const senderDoc = await db.users.findOne({ _id: userId });
  if (senderDoc && senderDoc.admin) {
    const firstStartLsDoc = await db.data.findOne({ name: 'startLs' });
    if (firstStartLsDoc) {
      await db.data.update({ name: 'startLs' }, { $set: { text: match[1] } });
    } else {
      await db.data.insert({
        name: 'startLs',
        text: match[1],
      });
    }
    await bot.sendMessage(chatId, 'Старт в личке обновлен!');
  }
});

bot.onText(/\/ping/, async (msg) => {
  const senderDoc = await db.users.findOne({ _id: msg.from.id });
  if (senderDoc && senderDoc.admin) {
    const randomNum = Math.floor(Math.random() * 100) + 1;
    if (randomNum <= 20) {
      await bot.sendMessage(msg.chat.id, 'FATAL ERROR: PING IS C̺̟̹OR͔̫͖͉R̀U͕̹̱̤P͓͍̦̗̦͝T̻͙̞́E͓̣̮D N͎͇̣̞͖̙̤͍͝a̵̹͞͠N͈̣͝ N̶̶͍̜͈̜̝̜̥͙̺͓̯̜̣͓͜͟͜a͙̺̹̱̗̲̺̺̪͙͈͜͢Ṇ̸̖̪̗͕̪̞̪̫̜̮̹͙̩̙̮̭̲͜ͅ');
    } else {
      await bot.sendMessage(msg.chat.id, 'Pong!');
    }
  }
});

bot.onText(/\/start(.*)/, async (msg, match) => {
  if (match[1] === ' rules') {
    const chatId = msg.chat.id;
    const rules = await db.data.findOne({ name: 'rules' });
    await bot.sendMessage(chatId, rules.text);
  } else if (msg.chat.id === msg.from.id) {
    const chatId = msg.chat.id;
    const rules = await db.data.findOne({ name: 'startLs' });
    await bot.sendMessage(chatId, rules.text);
  }
});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const senderDoc = await db.users.findOne({ _id: userId });
  if (!senderDoc) {
    await db.users.insert({
      _id: userId,
      username: msg.from.username,
      first_name: msg.from.first_name,
      ban: false,
      banDate: false,
      banChat: false,
      ugol: false,
      admin: false,
    });
  } else if (senderDoc.ugol) {
    await bot.deleteMessage(chatId, msg.message_id);
    if (msg.reply_to_message) {
      await bot.sendMessage(chatId, `*@${msg.from.username} пробурчал из угла:* ${msg.text}`, { parse_mode: 'Markdown', reply_to_message_id: msg.reply_to_message.message_id });
    } else {
      await bot.sendMessage(chatId, `*@${msg.from.username} пробурчал из угла:* ${msg.text}`, { parse_mode: 'Markdown' });
    }
  }
});

bot.on('new_chat_members', async (msg) => {
  const chatId = msg.chat.id;
  const welcome = await db.data.findOne({ name: 'welcome' });
  await bot.sendMessage(chatId, welcome.text, {
    reply_markup: {
      inline_keyboard: [[{
        text: 'Прочти правила!',
        url: 'https://t.me/PiedModerBot?start=rules',
      }]],
    },
  });
});
