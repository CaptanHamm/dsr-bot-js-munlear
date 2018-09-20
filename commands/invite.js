exports.run = async (client, message, args, level) => {
  const Discord = require("discord.js");
  const embed = new Discord.RichEmbed()
    .setTitle("Invite DSR Bot to your server")
    .setColor(0xeda321)
    .setDescription("https://discordapp.com/oauth2/authorize?client_id=436693905736466432&scope=bot&permissions=515136")
    .setImage("https://cdn.discordapp.com/attachments/481121267404111882/486633840127901736/DSR_gold2_64.png");
  await message.channel.send({embed});
};

exports.conf = {
  enabled: true,
  guildOnly: false,
  aliases: ["inv"],
  permLevel: "User"
};

exports.help = {
  name: "invite",
  category: "Miscelaneous",
  description: "Invite this bot to your server",
  usage: "invite"
};
