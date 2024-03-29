// This command analyzes a roster for recruitment
var Jimp = require('jimp');
const rp = require('request-promise');
const romanNumerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII'];
exports.run = async (client, message, args, level) => { // eslint-disable-line no-unused-vars
  await message.react("🖐");
  if (!args.length) {
    await message.channel.send(`\`\`\`js\nError: recruit needs an ally code.\n\`\`\``);
    await message.react("☠");
    return;
  }
  let allyCode = args[0].replace(/-/g, '');
  allyCode = await client.checkOrGetAllyCode(allyCode, message.author.id);
  if (!client.isAllyCode(allyCode)) {
    await message.channel.send(`\`\`\`js\nError: ${args[0]} is not an ally code.\n\`\`\``);
    await message.react("☠");
    return;
  }
  allyCode = Number(allyCode);

  let data;
  try {
    data = await client.swapi.fetchPlayer({
      allycode: allyCode,
      enums: true,
      project: {
        allyCode: 1,
        name: 1,
        level: 1,
        guildName: 1,
        stats: 1,
        roster: 1,
        arena: 1,
        type: 1,
        categoryIdList: 1
      }
    });
  } catch (error) {
    await message.channel.send(`\`${error}\``);
    await message.react("☠");
    return;
  }

  if (data.hasOwnProperty('error')) {
    await message.channel.send(`\`\`\`js\nError: ${data.error}.\n\`\`\``);
    await message.react("☠");
    return;
  }

  if (data.hasOwnProperty('response')) {
    await message.channel.send(`\`\`\`js\nError: Request time out requesting roster for ${allyCode}\n\`\`\``);
    await message.react("☠");
    return;
  }

  const stats = getPlayerStats(client, data[0]);
  const playerMods = client.getModsFromPlayer(data[0].roster);
  const nbSpeedMods = getPlayerMods(client, playerMods, 'Speed', 10)[1];
  // message.channel.send(`\`\`\`js\n${guild1.name}: ${JSON.stringify(stats1)}\n\`\`\``);
  const fields = [];
  Object.keys(stats).forEach(function (key) {
    let val = `${stats[key]}`;
    fields.push({ name: key, value: val });
  });
  fields.push({ name: 'Number of 10+ speed mods', value: nbSpeedMods });
  await message.channel.send(client.createEmbedInDescription(data[0].name, fields));

  let options = [];
  if (args.length > 1) {
    options = args[args.length - 1];
    options = options.replace(new RegExp('-', 'g'), '');
    options = Array.from(options);
    if (options.indexOf('a') < 0 && options.indexOf('s') < 0 && options.indexOf('o') < 0 && options.indexOf('t') < 0 && options.indexOf('l') < 0 && options.indexOf('d') < 0) {
      await message.channel.send(`\`\`\`js\nError: Unrecognized option: ${options}.\n\`\`\``);
      await message.react("☠");
      return;
    }
  }
  // [ a | t | l | d | s | o ]
  if (options.indexOf('a') >= 0 || options.indexOf('s') >= 0 || options.indexOf('o') >= 0) {
    if (options.indexOf('a') >= 0 || options.indexOf('s') >= 0) {
      const speedMods = getPlayerMods(client, playerMods, 'Speed', 15)[0];
      if (speedMods.length) {
        await message.channel.send(client.createEmbed(`${data[0].name}'s Top 6 Speed Mods`, speedMods));
      } else {
        await message.channel.send(client.createEmbed(`${data[0].name}'s Top 6 Speed Mods`, { name: '😦', value: 'No mods with speed secondary above 15.', inline: true }));
      }
    }
    if (options.indexOf('a') >= 0 || options.indexOf('o') >= 0) {
      const offMods = getPlayerMods(client, playerMods, 'Offense', 100)[0];
      if (offMods.length) {
        await message.channel.send(client.createEmbed(`${data[0].name}'s Top 6 Offense Mods`, offMods));
      } else {
        await message.channel.send(client.createEmbed(`${data[0].name}'s Top 6 Ofense Mods`, { name: '😦', value: 'No mods with offense secondary above 100.', inline: true }));
      }
    }
  }

  if (options.indexOf('a') >= 0 || options.indexOf('t') >= 0) {
    await message.channel.send('🚧 Sorry, TW is a work in progress 🚧');
  }

  if (options.indexOf('a') >= 0 || options.indexOf('l') >= 0) {
    const buffers = await getTbStats(client, data[0], 'l');
    for(const b of buffers) {
      await message.channel.send(b.name, { files: [{ attachment: b.buffer }] });
    }
  }

  if (options.indexOf('a') >= 0 || options.indexOf('d') >= 0) {
    const buffers = await getTbStats(client, data[0], 'd');
    for(const b of buffers) {
      await message.channel.send(b.name, { files: [{ attachment: b.buffer }] });
    }
    // await message.channel.send('🚧 Sorry, DSTB is a work in progress 🚧');
    // await message.channel.send(dstbStat);
  }

  if (options.length <= 0) {
    await message.channel.send('Check `help recruit` for more options');
  }
  await message.react("👍");
};

function getPlayerStats(client, data) {
  const res = {};
  res['Level'] = data.level;
  res['GP'] = client.numberWithCommas(data.stats.filter(o => o.nameKey === 'STAT_GALACTIC_POWER_ACQUIRED_NAME')[0].value);
  res['Character GP'] = client.numberWithCommas(data.stats.filter(o => o.nameKey === 'STAT_CHARACTER_GALACTIC_POWER_ACQUIRED_NAME')[0].value);
  res['Ship GP'] = client.numberWithCommas(data.stats.filter(o => o.nameKey === 'STAT_SHIP_GALACTIC_POWER_ACQUIRED_NAME')[0].value);
  res['Arena ranks (squad/fleet)'] = `Rank ${data.arena.char.rank} / Rank ${data.arena.ship.rank}`;
  res['Arena team'] = '\n';
  for (const toon in data.arena.char.squad) {
    if (!data.arena.char.squad.hasOwnProperty(toon)) {
      continue;
    }
    res['Arena team'] += client.nameDict[data.arena.char.squad[toon].defId].nameKey + ', ';
    if (data.arena.char.squad[toon].type === 'UNITTYPELEADER') {
      res['Arena team'] = res['Arena team'].slice(0, -2);
      res['Arena team'] += ` (Leader), `;
    }
  }
  res['Arena team'] = res['Arena team'].slice(0, -2);
  let capShip = null;
  let startShips = [];
  let reinforcements = [];
  for (const ship in data.arena.ship.squad) {
    if (!data.arena.ship.squad.hasOwnProperty(ship)) {
      continue;
    }
    if (data.arena.ship.squad[ship].type === 'UNITTYPECOMMANDER') {
      capShip = client.nameDict[data.arena.ship.squad[ship].defId].nameKey;
    }
    if (data.arena.ship.squad[ship].type === 'UNITTYPEDEFAULT') {
      startShips.push(client.nameDict[data.arena.ship.squad[ship].defId].nameKey);
    }
    if (data.arena.ship.squad[ship].type === 'UNITTYPEREINFORCEMENT') {
      reinforcements.push(client.nameDict[data.arena.ship.squad[ship].defId].nameKey);
    }
  }
  res['Arena Fleet'] = `\n*Capital Ship*: ${capShip}\n*Starting lineup*: `;
  for (const ship in startShips) {
    if (!startShips.hasOwnProperty(ship)) {
      continue;
    }
    res['Arena Fleet'] += `${startShips[ship]}, `;
  }
  res['Arena Fleet'] = res['Arena Fleet'].slice(0, -2);
  res['Arena Fleet'] += '\n*Reinforcements*: ';
  for (const ship in reinforcements) {
    if (!reinforcements.hasOwnProperty(ship)) {
      continue;
    }
    res['Arena Fleet'] += `${reinforcements[ship]}, `;
  }
  res['Arena Fleet'] = res['Arena Fleet'].slice(0, -2);
  res['Traya'] = "No";
  res['Number of G11'] = 0;
  res['Number of G12'] = 0;
  data.roster.forEach(toon => {
    let tempZetas = 0;
    let isG11 = false;
    let isG12 = false;
    if (toon.gear == 11) {
      res['Number of G11']++;
      isG11 = true;
    }
    if (toon.gear == 12) {
      res['Number of G12']++;
      isG12 = true;
    }

    let zetas = [];
    toon.skills.forEach(skill => {
      if (skill.isZeta && skill.tier >= 8) {
        zetas.push(`${client.skillsDict[skill.id].name} (${client.skillsDict[skill.id].type})`);
      }
    });

    switch (toon.defId) {
      case 'DARTHTRAYA':
        res['Traya'] = `Yes: Gear ${toon.gear}, ${toon.rarity} ⭐.`;
        if (zetas.length) {
          res['Traya'] += 'Zetas: ';
          for (const z in zetas) {
            if (!zetas.hasOwnProperty(z)) {
              continue;
            }
            if (!zetas.hasOwnProperty(z)) {
              continue;
            }
            res['Traya'] += `${zetas[z]}, `;
          }
          res['Traya'] = res['Traya'].slice(0, -2);
          res['Traya'] += '.';
        }
        break;
    }
  });
  return res;
}

function getPlayerMods(client, data, type, minVal) {
  let mods = [];
  let nb = 0;
  for (const d in data) {
    if (!data.hasOwnProperty(d)) {
      continue;
    }

    if (data[d].secondary_1[0] === type) {
      if (Number(data[d].secondary_1[1]) >= minVal) {
        // mods.push(modToField(data[d], type));
        mods.push(data[d]);
        nb++;
        continue;
      }
    }
    if (data[d].secondary_2[0] === type) {
      if (Number(data[d].secondary_2[1]) >= minVal) {
        mods.push(data[d]);
        nb++;
        continue;
      }
    }
    if (data[d].secondary_3[0] === type) {
      if (Number(data[d].secondary_3[1]) >= minVal) {
        mods.push(data[d]);
        nb++;
        continue;
      }
    }
    if (data[d].secondary_4[0] === type) {
      if (Number(data[d].secondary_4[1]) >= minVal) {
        mods.push(data[d]);
        nb++;
        continue;
      }
    }
  }
  switch (type) {
    case 'Speed':
      mods.sort(modSortSpeed);
      break;
    case 'Offense':
      mods.sort(modSortOffense);
      break;
  }
  mods = mods.reverse();
  mods = mods.slice(0, 6);
  let res = [];
  for (const m of Object.keys(mods)) {
    res.push(modToField(client, mods[m], type));
  }
  return [res, nb];
}

function modToField(client, mod, type) {
  let slot = null;
  switch (mod.slot.toLowerCase()) {
    case 'diamond':
      slot = '◆';
      break;
    case 'circle':
      slot = '●';
      break;
    case 'cross':
      slot = '+';
      break;
    case 'square':
      slot = '■';
      break;
    case 'arrow':
      slot = '➚';
      break;
    case 'triangle':
      slot = '▲';
      break;
  }

  let value = `\`\`\`asciidoc\n= ${client.nameDict[mod.unit].nameKey} =\n`;
  if (mod.secondary_1[0] === type) {
    value += `[${mod.secondary_1[0]} ${mod.secondary_1[1]}]\n`;
  } else {
    value += `${mod.secondary_1[0]} ${mod.secondary_1[1]}\n`;
  }
  if (mod.secondary_2[0] === type) {
    value += `[${mod.secondary_2[0]} ${mod.secondary_2[1]}]\n`;
  } else {
    value += `${mod.secondary_2[0]} ${mod.secondary_2[1]}\n`;
  }
  if (mod.secondary_3[0] === type) {
    value += `[${mod.secondary_3[0]} ${mod.secondary_3[1]}]\n`;
  } else {
    value += `${mod.secondary_3[0]} ${mod.secondary_3[1]}\n`;
  }
  if (mod.secondary_4[0] === type) {
    value += `[${mod.secondary_4[0]} ${mod.secondary_4[1]}]\n`;
  } else {
    value += `${mod.secondary_4[0]} ${mod.secondary_4[1]}\n`;
  }
  value += `\`\`\``;
  return { name: `${mod.pips} dot ${mod.set} ${slot} ${mod.primary[0]} primary`, value: value, inline: true };
}

function modSortSpeed(a, b) {
  return modSort(a, b, 'Speed');
}

function modSortOffense(a, b) {
  return modSort(a, b, 'Offense');
}

function modSort(a, b, type) {
  let valA = 0;
  let valB = 0;
  if (a.secondary_1[0] === type) {
    valA = Number(a.secondary_1[1]);
  }
  if (a.secondary_2[0] === type) {
    valA = Number(a.secondary_2[1]);
  }
  if (a.secondary_3[0] === type) {
    valA = Number(a.secondary_3[1]);
  }
  if (a.secondary_4[0] === type) {
    valA = Number(a.secondary_4[1]);
  }
  if (b.secondary_1[0] === type) {
    valB = Number(b.secondary_1[1]);
  }
  if (b.secondary_2[0] === type) {
    valB = Number(b.secondary_2[1]);
  }
  if (b.secondary_3[0] === type) {
    valB = Number(b.secondary_3[1]);
  }
  if (b.secondary_4[0] === type) {
    valB = Number(b.secondary_4[1]);
  }

  return valA - valB;
}

async function getTbStats(client, data, side) {
  let tags = [];
  let alignment = null;
  let images = null;
  let tagToName = null;
  if(side === 'd') {
    tags = new Set(['affiliation_empire', 'profession_bountyhunter']);
    alignment = 'alignment_dark';
    images = { Empire: [], 'Bounty Hunter': [] };
    tagToName = {
      affiliation_empire: 'Empire',
      profession_bountyhunter: 'Bounty Hunter'
    }
  } else {
    tags = new Set(['affiliation_rogue_one', 'affiliation_phoenix']);
    alignment = 'alignment_light';
    images = { 'Rogue One': [], 'Phoenix': [] };
    tagToName = {
      affiliation_rogue_one: 'Rogue One',
      affiliation_phoenix: 'Phoenix'
    }    
  }

  var options = {
    headers: {
      'User-Agent': 'Request-Promise'
    },
    uri: 'https://swgoh.gg/api/characters/?format=json',
    json: true // Automatically parses the JSON string in the response
  };

  let media = await rp(options);

  const mask = await Jimp.read('./assets/img/mask.png');
  const bglevel = await Jimp.read('./assets/img/levelbg-2.png');
  const bggear = await Jimp.read('./assets/img/gearbg.png');
  const star = await Jimp.read('./assets/img/star.png');
  const starInactive = await Jimp.read('./assets/img/star-inactive.png');
  const zeta = await Jimp.read('./assets/img/tex.skill_zeta.png');
  const font = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);
  mask.resize(80, 80);
  bglevel.resize(25, 25);
  bggear.resize(25, 25);
  star.resize(18, 18);
  starInactive.resize(18, 18);
  zeta.resize(40, 40);

  
  for (const toon of data.roster) {
    const categoryIdList = client.nameDict[toon.defId].categoryIdList;
    const setCatList = new Set(categoryIdList);
    let intersection = new Set([...tags].filter(x => setCatList.has(x)));
    intersection = [...intersection];
    if (categoryIdList.filter(x => x.includes('specialmission')).length) {
      console.log(categoryIdList);
    }
    if (intersection.length) {
      const med = media.filter(x => x.base_id === toon.defId);
      if(!med.length) {
        continue;
      }
      const imgLink = media.filter(x => x.base_id === toon.defId)[0].image;
      const image = await Jimp.read(`https:${imgLink}`);
      const gear = await Jimp.read(`./assets/img/gear-icon-g${toon.gear}.png`);
      image.resize(80, 80);
      image.mask(mask, 0, 0);
      image.blit(gear, 0, 0);
      const nbZetas = toon.skills.filter(x => x.tier === 8 && x.isZeta).length;
      if (nbZetas) {
        image.blit(zeta, -5, 43);
        image.print(font, 10, 51, nbZetas);
      }
      image.blit(bglevel, 50, 50); // gear
      image.print(font, 52, 53, romanNumerals[toon.gear - 1]);
      for(const t of tags) {
        if (categoryIdList.filter(x => x.includes(t)).length) {
          images[tagToName[t]].push({ img: image, level: toon.level, rarity: toon.rarity });
        }
      }
      // if (categoryIdList.filter(x => x.includes('affiliation_empire')).length) {
      //   images['Empire'].push({ img: image, level: toon.level, rarity: toon.rarity });
      // } else if (categoryIdList.filter(x => x.includes('profession_bountyhunter')).length) {
      //   images['Bounty Hunter'].push({ img: image, level: toon.level, rarity: toon.rarity });
      // }
    }
  }

  const buffers = [];
  for (const [key, values] of Object.entries(images)) {
    const background = await Jimp.read('./assets/img/background.png');
    background.resize(100 * values.length, 100);
    let imgX = 10, imgY = 10;
    let bglevelX = 36, bglevelY = 72;
    let levelfontX = 39, levelfontY = 77;
    let starX = [-2, 9, 24, 40, 56, 71, 82], starY = [25, 11, 3, 0, 3, 11, 25];
    for (const i of values) {
      background.blit(i.img, imgX, 10);
      background.blit(bglevel, bglevelX, 72); // level
      background.print(font, levelfontX, 77, i.level); // level    
      for (var r = 0; r < i.rarity; r++) {
        background.blit(star, starX[r], starY[r]);
      }
      for (r; r < 7; r++) {
        background.blit(starInactive, starX[r], starY[r]);
      }
      imgX += 100;
      bglevelX += 100;
      levelfontX += 100;
      starX = starX.map(x => x + 100);
    }
    const b = await background.getBufferAsync(Jimp.MIME_JPEG);
    buffers.push({name: key, buffer: b});
  }
  return buffers;
}

exports.conf = {
  enabled: true,
  guildOnly: false,
  aliases: ['r'],
  // permLevel: "Bot Owner"
  permLevel: "User"
};

exports.help = {
  name: "recruit",
  category: "Miscelaneous",
  description: "Gives relevant stats about a potential recruit.",
  usage: "recruit <allycode> (Options: [ a | t | l | d | s | o ])\nExample: \nrecruit 123456789\nrecruit 123456789 a\na: all stats\nt: tw stats\nl: lstb stats\nd: dstb stats\ns: speed mods stats\no: offense mods stats"
};
