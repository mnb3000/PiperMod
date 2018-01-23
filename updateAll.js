/* eslint-disable no-underscore-dangle,no-console,no-eval,no-await-in-loop,no-loop-func */
const Datastore = require('nedb-promise').datastore;

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

async function init() {
  const users = await db.users.find({});
  users.forEach(async (user) => {
    await db.users.update({ _id: user._id }, {
      $set: {
        bet: false,
        betPoints: 0,
        betResult: false,
      },
    });
  });
}
init();
