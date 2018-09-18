const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');

// this directory stores all the rotations
exports.run = async (client, message, args, level) => { // eslint-disable-line no-unused-vars
  await message.react("🖐");

  if (!args.length) {
    await message.channel.send("Error: addrotation requires a list of names.");
    await message.react("☠");
    return;
  }

  // Connect to the db
  MongoClient.connect(client.config.mongodbConfig.url,
    function (err, client) {
      assert.equal(null, err);
      console.log("Connected successfully to server");

      const db = client.db('swgoh');

      const row = {
        channelId: message.channel.id,
        rotation: args,
        active: true,
        direction: 'left'
      };

      const collection = db.collection('rotations');
      collection.insertOne(row, function (err, result) {
        assert.equal(err, null);
      });

      client.close();
    });

  await message.channel.send(JSON.stringify(args));

  await message.react("👍");
};

exports.conf = {
  enabled: false,
  guildOnly: false,
  aliases: ['ar'],
  // permLevel: "Bot Owner"
  permLevel: "User"
};

exports.help = {
  name: "addrotation",
  category: "Miscelaneous",
  description: "Bind a shard rotation in the current channel.",
  usage: "addrotation <player1> <player2> ..."
};