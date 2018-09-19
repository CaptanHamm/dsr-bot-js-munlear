const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');

// this directory stores all the rotations
exports.run = async (client, message, args, level) => { // eslint-disable-line no-unused-vars
  await message.react("🖐");

  if (!args.length) {
    await message.channel.send(`\`\`\`js\nError: register needs an ally code.\n\`\`\``);
    await message.react("☠");
    return;
  }
  let allycode = args[0].replace(/-/g, '');
  if (!client.isAllyCode(allycode)) {
    await message.channel.send(`\`\`\`js\nError: ${args[0]} is not an ally code.\n\`\`\``);
    await message.react("☠");
    return;
  }
  allycode = Number(allycode);

  // Connect to the db
  MongoClient.connect(client.config.mongodbConfig.url,
    function (err, client) {
      assert.equal(null, err);
      console.log("Connected successfully to server");

      const db = client.db('swgoh');

      const user = {
        id: message.author.id,
        tag: message.author.tag,
        allycode: allycode
      };

      const collection = db.collection('users');
      collection.updateOne(
        { id: message.author.id },
        { $set: user },
        { upsert: true },
        function (err, result) {
          assert.equal(err, null);
        });

      client.close();
    });

  await message.channel.send(`<@${message.author.id}>, your allycode has been registered!`);

  await message.react("👍");
};

exports.conf = {
  enabled: true,
  guildOnly: false,
  aliases: ['reg'],
  // permLevel: "Bot Owner"
  permLevel: "User"
};

exports.help = {
  name: "register",
  category: "Miscelaneous",
  description: "Register your allycode! Never type it again! Maybe..",
  usage: "register <allycode>"
};