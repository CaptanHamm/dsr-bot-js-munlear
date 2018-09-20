// Check for a guild's HSTR readiness
const hstrTeams = require("../data/hstrTeams.json");
const MAX_HSTR_TEAMS_PER_EMBED = 28;

exports.run = async (client, message, args, level) => { // eslint-disable-line no-unused-vars
  await message.react("🖐");
  if (!args.length) {
    await message.channel.send(`\`\`\`js\nError: sithraid needs an ally code.\n\`\`\``);
    await message.react("☠");
    return;
  }

  const allycodes = [];
  let a = 0;
  while (args[a]) {
    let allycode = args[a].replace(/-/g, '');
    allycode = await client.checkOrGetAllyCode(allycode, message.author.id);
    if(allycode) {
      allycodes.push(allycode);
    } else if(args[a] === 'me') {
      await message.channel.send(`You are not registered (use "register <yourallycode>" to use "me")`);
      await message.react("☠");
      return;
    } else {
      break;
    }
    a++;
  }

  if (!allycodes.length) {
    await message.channel.send(`\`\`\`js\nError: sithraid needs an ally code.\n\`\`\``);
    await message.react("☠");
    return;
  }

  let options = 'g';
  if (a < args.length) {
    options = args[a];
    options = options.replace(new RegExp('-', 'g'), '');
    options = Array.from(options);
    if (options.indexOf('g') < 0 && options.indexOf('p') < 0 && options.indexOf('d') < 0 && options.indexOf('n') < 0) {
      await message.channel.send(`\`\`\`js\nError: Unrecognized option: ${options}.\n\`\`\``);
      await message.react("☠");
      return;
    }

    if (allycodes.length > 1 && options.indexOf('p') >= 0) {
      options.replace('p', 'g');
    } else if (options.indexOf('p') < 0 && options.indexOf('g') < 0) {
      options.push('g');
    }
  }

  const noCap = options.indexOf('n') >= 0;

  let title = 'HSTR Readiness';
  let msg;
  let breakdown;
  let roster;
  if (options.indexOf('g') >= 0 && allycodes.length == 1) {
    let guild;
    try {
      guild = await client.swapi.fetchGuild({
        allycode: allycodes
      });
    } catch(error) {
      await message.channel.send(`\`${error}\``);
      await message.react("☠");
      return;
    }
    let guildAllyCodes = guild.roster.map(r => r.allyCode);
    try {
      roster = await client.swapi.fetchPlayer({ allycode: guildAllyCodes });
    } catch(error) {
      await message.channel.send(`\`${error}\``);
      await message.react("☠");
      return;
    }
  } else {
    try {
      roster = await client.swapi.fetchPlayer({ allycode: allycodes });
    } catch(error) {
      await message.channel.send(`\`${error}\``);
      await message.react("☠");
      return;
    }
    if (!Array.isArray(roster)) {
      title = roster.name;
      roster = [roster];
    }
  }
  [msg, breakdown] = analyzeGuildHstrReadiness(client, roster, noCap);

  const fields = [];
  for (const m in msg) {
    if (!msg.hasOwnProperty(m)) {
      continue;
    }
    fields.push({ name: msg[m][0], value: msg[m][1] });
  }
  await message.reply("Here are the details of your personal or guild readiness:");
  await message.channel.send(client.createEmbed(title, fields));

  if (options.indexOf('d') >= 0) {
    let dm = await message.author;
    if (options.indexOf('c') >= 0) {
      dm = await message.channel;
    }
    Object.keys(breakdown)
      .sort()
      .forEach(function (v, i) {
        const teams = Object.keys(breakdown[v]).sort();
        if (teams.length < MAX_HSTR_TEAMS_PER_EMBED) {
          const fieldsBD = [];
          for (const t in teams) {
            const team = teams[t];
            if (!breakdown[v].hasOwnProperty(team)) {
              continue;
            }
            fieldsBD.push({ name: `${team} - ${breakdown[v][team]['comp']} (Goal: ${breakdown[v][team]['goal']}%) - eligibility: ${breakdown[v][team]['eligibility']}`, value: breakdown[v][team]['players'].join(", ") });
          }
          dm.send(client.createEmbed(`${title}'s HSTR ${v} Assignments`, fieldsBD));
        } else {
          const nb = Math.ceil(teams.length / MAX_HSTR_TEAMS_PER_EMBED);
          for (let i = 0; i < nb + 1; i++) {
            const fieldsBD = [];
            for (const teamName in teams.slice((i - 1) * MAX_HSTR_TEAMS_PER_EMBED, i * MAX_HSTR_TEAMS_PER_EMBED < teams.length ? MAX_HSTR_TEAMS_PER_EMBED : teams.length)) {
              fieldsBD.push({ name: `${teamName} - ${breakdown[v][teamName]['comp']} (Goal: ${breakdown[v][teamName]['goal']}%) - eligibility: ${breakdown[v][teamName]['eligibility']}`, value: breakdown[v][teamName]['players'].join(", ") });
            }
            dm.send(client.createEmbed(`${title}'s HSTR ${v} Assignments (${i}/${nb})`, fieldsBD));
          }
        }
      });

  }
  await message.react("👍");
};

function createGuildDict(client, roster) {
  const d = {};
  roster.forEach(player => {
    d[player.name] = {};
    d[player.name]['zetas'] = [];
    player.roster.forEach(toon => {
      if (toon.rarity >= 7) {
        d[player.name][toon.defId] = toon;
        toon.skills.forEach(skill => {
          if (skill.isZeta && skill.tier >= 8) {
            let zetaName = '';
            if (client.skillsDict.hasOwnProperty(skill.id)) {
              zetaName = client.skillsDict[skill.id].name;
            } else {
              zetaName = skill.id;
            }
            d[player.name]['zetas'].push(zetaName);
          }
        });
      }
    });
  });
  return d;
}

function analyzeGuildHstrReadiness(client, roster, noCap) {
  let globalDict = createGuildDict(client, roster);

  const readiness = {};
  for (let phase in hstrTeams) {
    let teams = hstrTeams[phase];
    let total = 100;
    if (phase == 'PHASE4_WITH_DN') {
      total = 95;
    }
    readiness[phase] = { 'remaining': total, 'teams': [] };
    let phaseReady = false;
    for (let player in globalDict) {
      if (phaseReady) {
        break;
      }
      const playerRoster = globalDict[player];

      let teamsLeft = true;
      while (teamsLeft) {
        let temp = {};
        for (let i in teams) {
          if (!teams.hasOwnProperty(i)) {
            continue;
          }
          const team = teams[i];
          let power = 0;
          let IDS = [];
          let playerZetas = playerRoster['zetas'];
          let teamZetas;
          if (team.hasOwnProperty('ZETAS')) {
            teamZetas = team.ZETAS;
          }

          if (teamZetas) {
            if (!playerZetas.length) {
              continue;
            }
            const setTeamZetas = new Set(teamZetas);
            const setPlayerZetas = new Set(playerZetas);
            const diff = new Set([...setTeamZetas].filter(x => !setPlayerZetas.has(x)));
            if (diff.size) {
              continue;
            }
          }
          for (let j in team['TOONS']) {
            const toon = team['TOONS'][j];
            if (!playerRoster.hasOwnProperty(toon)) {
              break;
            }
            let playerToon = playerRoster[toon];
            power += playerToon.gp;
            IDS.push(toon);
          }
          if (IDS.length !== team['TOONS'].length) {
            continue;
          }
          if (power > team['MIN_GP']) {
            let eligibility = `Min GP: ${team['MIN_GP']}`;
            if (team.hasOwnProperty('ZETAS')) {
              eligibility += ` / required zetas: ${team['ZETAS'].join(", ")}`;
            }
            temp[team['NAME']] = { 'power': power, 'IDS': IDS, 'name': team['NAME'], 'goal': team['GOAL'], 'eligibility': eligibility };
          }
        }

        let max_gp = 0;
        let goal = 0;
        let winner;
        for (let team_id in temp) {
          const data = temp[team_id];
          if (data['goal'] > goal) {
            winner = data;
            max_gp = data['power'];
            goal = data['goal'];
          } else if (data['goal'] == goal && data['power'] > max_gp) {
            winner = data;
            max_gp = data['power'];
          }
        }

        if (winner) {
          readiness[phase]['remaining'] -= winner['goal'];
          readiness[phase]['teams'].push(
            {
              'player_name': player, 'team_name': winner['name'], 'goal': winner['goal'],
              'eligibility': winner['eligibility']
            });
          for (let id in winner['IDS']) {
            const toonID = winner['IDS'][id];
            delete globalDict[player][toonID];
          }
          if (!noCap) {
            if (readiness[phase]['remaining'] <= 0) {
              readiness[phase]['remaining'] = 0;
              phaseReady = true;
              break;
            }
          }
        } else {
          teamsLeft = false;
        }
      }
    }
  }
  let msg = [];
  let sorted = [];
  for (let key in readiness) {
    sorted[sorted.length] = key;
  }
  sorted.sort();
  for (const k in sorted) {
    if (!readiness.hasOwnProperty(sorted[k])) {
      continue;
    }
    let phase = sorted[k];
    let rem = readiness[phase]['remaining'];
    if (phase == 'PHASE4_WITH_DN' && readiness[phase]['remaining'] > 0) {
      rem = rem + 5;
    }
    msg.push([phase, `${(100 - rem).toFixed(2)}% ready.`]);
  }

  let leftover_gp = 0;
  let nb_toons = 0;
  for (let player_name in globalDict) {
    const toons = globalDict[player_name];
    for (let toon_name in toons) {
      const toon_data = toons[toon_name];
      if (toon_data['gp'] > 10000) {
        leftover_gp += toon_data['gp'];
        nb_toons += 1;
      }
    }
  }
  msg.push(["Leftover GP for P4 (toons over 10k GP only):", client.numberWithCommas(leftover_gp)]);
  msg.push(["Number of toons left for P4 (toons over 10k GP only):", client.numberWithCommas(nb_toons)]);
  msg.push([
    "Average:",
    `${(leftover_gp / 50).toFixed(2)} GP left for P4 per player (${(leftover_gp / nb_toons * 5).toFixed(2)} gp per team, toons over 10k GP only).`]);
  msg.push(["Average:",
    `${(nb_toons / 50).toFixed(2)} toons left for P4 per player (${((nb_toons / 50) / 5).toFixed(2)} teams).`]);

  for (const phase in readiness) {
    const phase_data = readiness[phase];
    for (const dataTeam in phase_data['teams']) {
      const team = phase_data['teams'][dataTeam];
      for (const ht in hstrTeams[phase]) {
        const t = hstrTeams[phase][ht];
        if (t['NAME'] == team['team_name']) {
          const temp = t['TOONS'];
          let team_str = [];
          for (const te in temp) {
            const tem = temp[te];
            if (client.nameDict.hasOwnProperty(tem)) {
              team_str.push(client.nameDict[tem].nameKey);
              break;
            }
          }

          team_str[0] = `${team_str[0]} Lead`;
          team_str = team_str.join(", ");
          team['comp'] = team_str;
          break;
        }
      }
    }
  }
  return [msg, create_breakdown(readiness)];
}

function create_breakdown(readiness) {
  const breakdown = {};
  const sorted = [];
  for (let key in readiness) {
    sorted[sorted.length] = key;
  }
  sorted.sort();
  for (const k in sorted) {
    if (!readiness.hasOwnProperty(sorted[k])) {
      continue;
    }
    let v = sorted[k];
    breakdown[v] = {};
    for (const t in readiness[v]['teams']) {
      if (!readiness[v]['teams'].hasOwnProperty(t)) {
        continue;
      }
      const team = readiness[v]['teams'][t];
      if (!breakdown[v].hasOwnProperty(team['team_name'])) {
        breakdown[v][team['team_name']] = {
          'goal': team['goal'].toFixed(2), 'comp': team['comp'], 'eligibility': team['eligibility'],
          'players': []
        };
      }
      breakdown[v][team['team_name']]['players'].push(team['player_name']);
    }
  }
  return breakdown;
}

exports.conf = {
  enabled: true,
  guildOnly: false,
  aliases: ['sr'],
  permLevel: "User"
};

exports.help = {
  name: "sithraid",
  category: "Raid",
  description: "Check for a guild or players' readiness to the HSTR.",
  usage: "sithraid <allycodes> (Options: [ g | p | d | c | n ])\nExample: \nsithraid 123456789 gdc\nsithraid 123456789 p\n sithraid 123456789 012345678 dc\ng: guild (default)\np: player\nd: details\nc: channel (display details in current channel)\nn: no cap (don't cap each phase to 100%)"
};
