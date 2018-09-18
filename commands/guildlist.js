exports.run = async (client, message, args, level) => { // eslint-disable-line no-unused-vars
  await message.react("🖐");
  if (!args.length) {
    await message.channel.send(`\`\`\`js\nError: gdata needs an ally code.\n\`\`\``);
    await message.react("☠");
    return;
  }
  let allycode = args[0].replace(/-/g, '');
  allycode = await client.checkOrGetAllyCode(allycode, message.author.id);
  if (!client.isAllyCode(allycode)) {
    await message.channel.send(`\`\`\`js\nError: ${args[0]} is not an ally code.\n\`\`\``);
    await message.react("☠");
    return;
  }
  allycode = Number(allycode);
  
  let guild;
  try {
    guild = await client.swapi.fetchGuild({
      allycode: allycode
    });
  } catch(error) {
    await message.channel.send(`\`${error}\``);
    await message.react("☠");
    return;
  }
  
  if (guild.hasOwnProperty('error')) {
    await message.channel.send(`\`\`\`js\nError: ${guild.error}.\n\`\`\``);
    await message.react("☠");
    return;
  }

  if (guild.hasOwnProperty('response')) {
    await message.channel.send(`\`\`\`js\nError: Request time out requesting roster for ${allycode}\n\`\`\``);
    await message.react("☠");
    return;
  }

  let roster = guild.roster.map(r => `${r.name}: ${r.allyCode}`);
  
  await message.channel.send(`\`\`\`js\n${guild.name}\nMembers: ${roster.length}/50\n${roster.join('\n')}\n\`\`\``);
  
  await message.react("👍");
};

exports.conf = {
  enabled: true,
  guildOnly: false,
  aliases: ['gl'],
  permLevel: "User"
};

exports.help = {
  name: "guildlist",
  category: "Miscelaneous",
  description: "Gives a guild's list of players + allycode.",
  usage: "guildlist <allycode>"
};
