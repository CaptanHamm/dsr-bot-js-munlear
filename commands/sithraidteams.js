const fuzz = require('fuzzball');
// Returns the list of HSTR teams
const hstrTeams = require("../data/hstrTeams.json");
const MAX_HSTR_TEAMS_PER_EMBED = 20;
const ALL_PHASES = ['PHASE1', 'PHASE2', 'PHASE3', 'PHASE4_WITH_DN'];

exports.run = async (client, message, args, level) => { // eslint-disable-line no-unused-vars
  await message.react("🖐");
  let options = 'p';
  if (args.length) {
    options = args[0];
    options = options.replace(new RegExp('-', 'g'), '');
    options = Array.from(options);
    if (options.indexOf('p') < 0 && options.indexOf('c') < 0) {
      await message.channel.send(`\`\`\`js\nError: Please use option p or c.\n\`\`\``);
      await message.react("☠");
      return;
    }
    if (options.indexOf('p') < 0 && options.indexOf('c') && options.indexOf('s') < 0 && options.indexOf('1') < 0 && options.indexOf('2') < 0 && options.indexOf('3') < 0 && options.indexOf('4') < 0 ) {
      await message.channel.send(`\`\`\`js\nError: Unrecognized option: ${options}.\n\`\`\``);
      await message.react("☠");
      return;
    }
  }

  let search = null;
  console.log(args);
  console.log(options.indexOf('s'));
  if (options.indexOf('s') >= 0 && args.length < 1) {
    await message.channel.send(`\`\`\`js\nError: "search" option requires a search keyword.\n\`\`\``);
    await message.react("☠");
    return;
  } 
  
  if (options.indexOf('s') < 0 && args.length > 1) {
    await message.channel.send(`\`\`\`js\nWarning: if you are trying to filter by character, please use option "s".\n\`\`\``);
    await message.react("⚠");
  } 
  
  if (options.indexOf('s') >= 0) {
    search = args[1];
    const options = {scorer: fuzz.partial_token_sort_ratio};
    const fuzz_res = fuzz.extract(search, getToonsFromHstrTeams(client), options);
    console.log(fuzz_res);
    if (fuzz_res[0][1] < 59) {
      await message.channel.send(`\`\`\`js\nError: Could not find this character or this character is not commonly used in the raid.\n\`\`\``);
      await message.react("☠");
      return;      
    }
    search = Object.keys(client.nameDict).find(key => client.nameDict[key].nameKey === fuzz_res[0][0]);
  }
  
  let dm = await message.channel;
  if (options.indexOf('p') >= 0) {
    dm = await message.author;
  }

  let phases = [];
  for (const o of options) {
    if (Number(o) && Number(o) >= 1 && Number(o) <= 4) {
      phases.push(ALL_PHASES[Number(o) - 1]);
    }
  }
  if (!phases.length) {
    for (const o of options) {
      if (Number(o)) {
        await message.channel.send(`\`\`\`js\nError: There is no phase ${o}.\n\`\`\``);
        await message.react("☠");
        return;
      }
    }
    phases = ALL_PHASES;
  }

  const msg = getHstrTeams(client.nameDict, phases, search);
  if (Object.keys(msg).length === 0) {
      await message.channel.send(`\`\`\`js\nNo team or phase found.\n\`\`\``);
      await message.react("☠");
      return;      
  }
  const sortedPhases = Object.keys(msg).sort();
  for(const phase of sortedPhases) {
    const teams = Object.keys(msg[phase]).sort();
    if (teams.length < MAX_HSTR_TEAMS_PER_EMBED) {
      const fields = [];
      for (const t in teams) {
        if (!teams.hasOwnProperty(t)) {
          continue;
        }
        const team = teams[t];
        fields.push({ name: team, value: msg[phase][teams[t]] });
      }
      dm.send(client.createEmbed(`HSTR ${phase} Assignments`, fields));
    } else {
      const nb = Math.ceil(teams.length / MAX_HSTR_TEAMS_PER_EMBED);
      for (let i = 1; i < nb + 1; i++) {
        const fields = [];
        let start = (i - 1) * MAX_HSTR_TEAMS_PER_EMBED;
        let end = i * MAX_HSTR_TEAMS_PER_EMBED < teams.length ? MAX_HSTR_TEAMS_PER_EMBED : teams.length;
        for (const teamidx of teams.slice(start, end)) {
          fields.push({ name: teamidx, value: msg[phase][teamidx] });
        }
        await dm.send(client.createEmbed(`HSTR Teams for ${phase} (${i}/${nb})`, fields));
      }
    }
  }
  await message.react("👍");
};

function getHstrTeams(charMedia, phaseFilter, search) {
  let dontsearch = false;
  if (search === null) {
    dontsearch = true;
  }
  const result = {};
  for (const phase of Object.keys(hstrTeams)) {
    if (phaseFilter.indexOf(phase) < 0) {
      continue;
    }
    const teams = hstrTeams[phase];
    result[phase] = {};
    for (const t1 of Object.keys(teams)) {
      const team = teams[t1];
      let s = '';
      let search_found = false;
      for (const t2 in team['TOONS']) {
        if (!team['TOONS'].hasOwnProperty(t2)) {
          continue;
        }
        const toon = team['TOONS'][t2];
        if (!dontsearch && search === toon) {
          search_found = true;
        }
        if (charMedia.hasOwnProperty(toon)) {
          s += charMedia[toon].nameKey + ', ';
        } else {
          s += toon + ', ';
        }
      }
      if (!dontsearch && !search_found) {
        continue;
      }
      s = s.slice(0, -2);
      if (team['ZETAS']) {
        s += '. Mandatory zetas: ';
        for (const z in team['ZETAS']) {
          if (team['ZETAS'].hasOwnProperty(z)) {
            s += team['ZETAS'][z] + ', ';
          }
        }
        s = s.slice(0, -2);
      }
      s += `. Goal: ${team['GOAL']}%`;
      result[phase][team['NAME']] = s;
    }
    if (Object.keys(result[phase]).length === 0) {
      delete result[phase];
    }
  }
  return result;
}

function getToonsFromHstrTeams(client) {
  let toons = [];
  for (const phase in hstrTeams) {
    for (const team of hstrTeams[phase]) {
      toons = toons.concat(team.TOONS);
    }
  }
  return [...new Set(toons)].map(x => client.nameDict[x].nameKey);
}

exports.conf = {
  enabled: true,
  guildOnly: false,
  aliases: ['srt'],
  // permLevel: "Bot Owner"
  permLevel: "User"
};

exports.help = {
  name: "sithraidteams",
  category: "Raid",
  description: "List of HSTR teams.",
  usage: "sithraidteams (Options: [ p | c | s | 1 | 2 | 3 | 4 ])\nExamples: srt c\nsrt p134\nsrt s wampa\np: private (sent via DM)\nc: channel (display in current channel)\ns: search for a characted (must provide a name)\n1, 2, 3, 4: show teams for each phase"
};