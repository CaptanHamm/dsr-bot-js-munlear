// This command has two usages:
// 1. with one argument: will return data for tw
// 2. with 2 arguments: will compare data between 2 allycode's guilds for tw
exports.run = async (client, message, args, level) => { // eslint-disable-line no-unused-vars
  if (!args.length) {
    message.channel.send(`\`\`\`js\nError: tw needs an ally code.\n\`\`\``);
    return;
  }
  allycode1 = args[0].replace(/-/g, '');
  if (!client.isAllyCode(allycode1)) {
    message.channel.send(`\`\`\`js\nError: ${args[0]} is not an ally code.\n\`\`\``);
    return;
  }

  const guild1 = await client.swapi.fetchGuild(args[0]);
  const zetaData = await client.swapi.fetchData('zetas');
  stats1 = getGuildStats(client, guild1.roster, guild1.members);
  // message.channel.send(`\`\`\`js\n${guild1.name}: ${JSON.stringify(stats1)}\n\`\`\``);
  if (args.length > 1) {
    allycode2 = args[1].replace(/-/g, '');
    if (!client.isAllyCode(allycode2)) {
      message.channel.send(`\`\`\`js\nError: ${args[1]} is not an ally code.\n\`\`\``);
      return;
    }
    const guild2 = await client.swapi.fetchGuild(allycode2);
    stats2 = getGuildStats(client, guild2.roster, guild2.members);
    // message.channel.send(`\`\`\`js\n${guild2.name}: ${JSON.stringify(stats2)}\n\`\`\``);

    fields = [];
    Object.keys(stats1).forEach(function (key) {
      let val = `${stats1[key]} vs ${stats2[key]}`;
      let lfill = (55 - val.length) / 2;
      if(lfill < 0) {
        lfill = 0;
      }
      val = `${' '.repeat(lfill)}${val}`;
      fields.push({ name: key, value: `\`\`\`js\n${val}\`\`\`` });
    });
    message.channel.send(client.createEmbed(guild1.name + " vs " + guild2.name, fields));
  }
  message.react("👍");
};

function getGuildStats(client, roster, nbMembers) {
  res = {};
  res['Members'] = nbMembers;
  res['Total GP'] = 0;
  res['Average Arena Rank'] = 0;
  res['Average Fleet Arena Rank'] = 0;
  res['Number of Trayas'] = 0;
  res['Number of zzTrayas'] = 0;
  res['Number of G11+ Magmatroopers'] = 0;
  res['Number of zBastilla'] = 0;
  res['Number of G11'] = 0;
  res['Number of G12'] = 0;
  res['Number of Zetas'] = 0;
  roster.forEach(element => {
    res['Total GP'] += element.gpFull;
    res['Average Arena Rank'] += element.arena.char.rank;
    res['Average Fleet Arena Rank'] += element.arena.ship.rank;

    element.roster.forEach(toon => {
      tempZetas = 0;
      isG11 = false;
      isG12 = false;
      if (toon.gear == 11) {
        res['Number of G11']++;
        isG11 = true;
      }
      if (toon.gear == 12) {
        res['Number of G12']++;
        isG12 = true;
      }

      toon.skills.forEach(skill => {
        if (skill.isZeta && skill.tier >= 8) {
          res['Number of Zetas']++;
          tempZetas++;
        }
      });

      switch (toon.defId) {
        case 'DARTHTRAYA':
          res['Number of Trayas']++;
          if (tempZetas >= 2) {
            res['Number of zzTrayas']++;
          }
          break;
        case 'MAGMATROOPER':
          if (isG11 || isG12) {
            res['Number of G11+ Magmatroopers']++;
          }
          break;
        case 'BASTILASHAN':
          if (tempZetas >= 1) {
            res['Number of zBastilla']++;
          }
          break;
      }
    });
  });
  res['Total GP'] = client.numberWithCommas(res['Total GP']);
  res['Average Arena Rank'] /= roster.length;
  res['Average Arena Rank'] = res['Average Arena Rank'].toFixed(2);
  res['Average Fleet Arena Rank'] /= roster.length;
  res['Average Fleet Arena Rank'] =res['Average Fleet Arena Rank'].toFixed(2);
  return res;
}

exports.conf = {
  enabled: true,
  guildOnly: false,
  aliases: [],
  permLevel: "Bot Owner"
};

exports.help = {
  name: "tw",
  category: "Arena",
  description: "Gives relevant stats about TW for your guild, or compares 2 guilds.",
  usage: "tw <allycode1> (Optional: <allycode2>)"
};