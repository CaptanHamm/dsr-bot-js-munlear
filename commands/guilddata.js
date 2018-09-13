const xl = require('excel4node');
const reducer = (accumulator, currentValue) => accumulator + currentValue;

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

  let allyCodes = guild.roster.map(r => r.allyCode);
  let roster;
  try {
    roster = await client.swapi.fetchPlayer({
      allycodes: allyCodes,
      enums: true
    });
  } catch(error) {
    await message.channel.send(`\`${error}\``);
    await message.react("☠");
    return;
  }
  
  if (roster.hasOwnProperty('response')) {
    await message.channel.send(`\`\`\`js\nError: Request time out\n\`\`\``);
    await message.react("☠");
    return;
  }
  // // get unit's list from: /swgoh/units
  // let units = await client.swapi.fetchUnits({ allycode: allyCodes });
  // // pass whole units object to crinolo's api
  // let rosterStats = await client.swapi.rosterStats(units);

  const stats = await getStats(client, roster);

  var wb = new xl.Workbook();
  var ws = wb.addWorksheet(guild.name);
  for (var i = 0; i < stats.length; i++) {
    for (var j = 0; j < stats[i].length; j++) {
      if (j === 0 || i === 0) {
        ws.cell(i + 1, j + 1).string(stats[i][j]);
      } else {
        ws.cell(i + 1, j + 1).number(stats[i][j]);
      }
    }
  }

  var ws2 = wb.addWorksheet('TW farm');
  const twFarm = await getTWFarm(client, roster);
  var i = 1;
  for (const [key, value] of Object.entries(twFarm)) {
    var j = 1;
    ws2.cell(j, i).string(key);
    for (const val of value) {
      j++;
      if (i === 1) {
        ws2.cell(j, i).string(val);
      } else {
        ws2.cell(j, i).number(val);
      }
    }
    i++;
  }

  var buffer = await wb.writeToBuffer();
  await message.channel.send('File:', {
    files: [{
      attachment: buffer,
      name: `${guild.name}.xlsx`
    }]
  });
  await message.react("👍");
};

async function getStats(client, roster) {

  const data = [];
  data.push(['Name', 'Total GP', 'Character GP', 'Fleet GP', 'Arena', 'Fleet Arena', 'G11', 'G12', 'Zetas', 'Mods +10 speed', 'Mods +15 speed']);
  data[0].push(...['Qi\'ra', 'L3-37', 'Vandor Chewie', 'Big Z', 'Enfys Nest', 'Scoundrels GP']);
  data[0].push(...['Bossk', 'Boba Fett', 'IG88', 'Dengar', 'Greedo', 'BH GP']);
  data[0].push(...['KRU', 'Kylo', 'fost', 'foe', 'foo', 'FO GP']);
  data[0].push(...['Traya', 'Sion', 'DN', 'SithT', 'Dooku', 'Sith GP']);
  for (const r of Object.keys(roster)) {
    const element = roster[r];
    let d = [];
    d.push(element.name);
    d.push(element.stats.filter(o => o.nameKey == 'STAT_GALACTIC_POWER_ACQUIRED_NAME')[0].value);
    d.push(element.stats.filter(o => o.nameKey == 'STAT_CHARACTER_GALACTIC_POWER_ACQUIRED_NAME')[0].value);
    d.push(element.stats.filter(o => o.nameKey == 'STAT_SHIP_GALACTIC_POWER_ACQUIRED_NAME')[0].value);
    d.push(element.arena.char.rank);
    d.push(element.arena.ship.rank);
    let g11 = 0;
    let g12 = 0;
    let zetas = 0;
    let mod10 = 0;
    let mod15 = 0;
    let scoundrels = Array(6).fill(0);
    let bh = Array(6).fill(0);
    let fo = Array(6).fill(0);
    let sith = Array(6).fill(0);

    for (const t of Object.keys(element.roster)) {
      const toon = element.roster[t];
      let tempZetas = 0;
      if (toon.gear === 11) {
        g11++;
      }
      if (toon.gear === 12) {
        g12++;
      }

      for (const s of Object.keys(toon.skills)) {
        const skill = toon.skills[s];
        if (skill.isZeta && skill.tier >= 8) {
          zetas++;
        }
      }

      for (const m of Object.keys(toon.mods)) {
        const mod = toon.mods[m];
        if (mod.secondaryType_1 === 'UNITSTATSPEED') {
          if (mod.secondaryValue_1 >= 1000000000) {
            mod10++;
          }
          if (mod.secondaryValue_1 >= 1500000000) {
            mod15++;
            continue;
          }
        }
        if (mod.secondaryType_2 === 'UNITSTATSPEED') {
          if (mod.secondaryValue_2 >= 1000000000) {
            mod10++;
          }
          if (mod.secondaryValue_2 >= 1500000000) {
            mod15++;
            continue;
          }
        }
        if (mod.secondaryType_3 === 'UNITSTATSPEED') {
          if (mod.secondaryValue_3 >= 1000000000) {
            mod10++;
          }
          if (mod.secondaryValue_3 >= 1500000000) {
            mod15++;
            continue;
          }
        }
        if (mod.secondaryType_4 === 'UNITSTATSPEED') {
          if (mod.secondaryValue_4 >= 1000000000) {
            mod10++;
          }
          if (mod.secondaryValue_4 >= 1500000000) {
            mod15++;
            continue;
          }
        }
      }

      if (toon.defId === 'QIRA') {
        scoundrels[0] = toon.gp;
      } else if (toon.defId === 'L3_37') {
        scoundrels[1] = toon.gp;
      } else if (toon.defId === 'YOUNGCHEWBACCA') {
        scoundrels[2] = toon.gp;
      } else if (toon.defId === 'ZAALBAR') {
        scoundrels[3] = toon.gp;
      } else if (toon.defId === 'ENFYSNEST') {
        scoundrels[4] = toon.gp;
      }

      if (toon.defId === 'BOSSK') {
        bh[0] = toon.gp;
      } else if (toon.defId === 'DENGAR') {
        bh[1] = toon.gp;
      } else if (toon.defId === 'IG88') {
        bh[2] = toon.gp;
      } else if (toon.defId === 'GREEDO') {
        bh[3] = toon.gp;
      } else if (toon.defId === 'BOBAFETT') {
        bh[4] = toon.gp;
      }

      if (toon.defId === 'KYLORENUNMASKED') {
        fo[0] = toon.gp;
      } else if (toon.defId === 'KYLOREN') {
        fo[1] = toon.gp;
      } else if (toon.defId === 'FIRSTORDERTROOPER') {
        fo[2] = toon.gp;
      } else if (toon.defId === 'FIRSTORDEREXECUTIONER') {
        fo[3] = toon.gp;
      } else if (toon.defId === 'FIRSTORDEROFFICERMALE') {
        fo[4] = toon.gp;
      }

      if (toon.defId === 'DARTHTRAYA') {
        sith[0] = toon.gp;
      } else if (toon.defId === 'DARTHSION') {
        sith[1] = toon.gp;
      } else if (toon.defId === 'DARTHNIHILUS') {
        sith[2] = toon.gp;
      } else if (toon.defId === 'SITHTROOPER') {
        sith[3] = toon.gp;
      } else if (toon.defId === 'COUNTDOOKU') {
        sith[4] = toon.gp;
      }
    }
    d.push(g11);
    d.push(g12);
    d.push(zetas);
    d.push(mod10);
    d.push(mod15);
    scoundrels[5] = scoundrels.slice(0, 4).reduce(reducer);
    bh[5] = bh.slice(0, 4).reduce(reducer);
    fo[5] = fo.slice(0, 4).reduce(reducer);
    sith[5] = sith.slice(0, 4).reduce(reducer);
    d.push(...scoundrels);
    d.push(...bh);
    d.push(...fo);
    d.push(...sith);
    data.push(d);
  }
  return data;
}

async function getTWFarm(client, roster) {
  // Initialize temp
  const data = { Name: [] };
  for (const toonId of Object.keys(client.nameDict)) {
    data[client.nameDict[toonId]] = [];
    data[`${client.nameDict[toonId]} zetas`] = [];
  }
  
  // counts number of players, aka which row we're at
  var i = 0;
  for (const player of roster) {
    data.Name.push(player.name);
    
    // for each toon, put a 0. That way, even if the player doesn't have a 
    // certain toon, we have a value.
    for (const toonId of Object.keys(client.nameDict)) {
      data[client.nameDict[toonId]].push(0);
      data[`${client.nameDict[toonId]} zetas`].push(0);
    }
  
    for (const toon of player.roster) {
      // replace 0 with actual gear level
      data[client.nameDict[toon.defId]][i] = toon.gear;
      let nbZetas = 0;
      for (const skill of toon.skills) {
        if (skill.isZeta && skill.tier >= 8) {
          nbZetas++;
        }
      }
      data[`${client.nameDict[toon.defId]} zetas`][i] = nbZetas;
    }
    i++;
  }

  return data;
}

exports.conf = {
  enabled: true,
  guildOnly: false,
  aliases: ['gd'],
  permLevel: "Bot Support"
};

exports.help = {
  name: "guilddata",
  category: "Miscelaneous",
  description: "Gives relevant stats about your roster.",
  usage: "guilddata <allycode>"
};
