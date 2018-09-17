// This will check if the node version you are running is the required
// Node version, if it isn't it will throw the following error to inform
// you.
if (process.version.slice(1).split(".")[0] < 8) throw new Error("Node 8.0.0 or higher is required. Update Node on your system.");

// Load up the discord.js library
const Discord = require("discord.js");
// We also load the rest of the things we need in this file:
const { promisify } = require("util");
const readdir = promisify(require("fs").readdir);
const Enmap = require("enmap");
const EnmapLevel = require("enmap-level");

// This is your client. Some people call it `bot`, some people call it `self`,
// some might call it `cootchie`. Either way, when you see `client.something`,
// or `bot.something`, this is what we're refering to. Your client.
const client = new Discord.Client();

// Here we load the config file that contains our token and our prefix values.
client.config = require("./config.js");
// client.config.token contains the bot's token
// client.config.prefix contains the message prefix

const ApiSwgohHelp = require('api-swgoh-help');
client.swapi = new ApiSwgohHelp(client.config.swapiConfig);

// Require our logger
client.logger = require("./util/Logger");

// Let's start by getting some useful functions that we'll use throughout
// the bot, like logs and elevation features.
require("./modules/functions.js")(client);

// custom swgoh utils
require("./modules/utils.js")(client);

// custom swapi utils
require("./modules/swapiUtils.js")(client);

// Aliases and commands are put in collections where they can be read from,
// catalogued, listed, etc.
client.commands = new Enmap();
client.aliases = new Enmap();

// Now we integrate the use of Evie's awesome Enhanced Map module, which
// essentially saves a collection to disk. This is great for per-server configs,
// and makes things extremely easy for this purpose.
client.settings = new Enmap({provider: new EnmapLevel({name: "settings"})});

// We're doing real fancy node 8 async/await stuff here, and to do that
// we need to wrap stuff in an anonymous function. It's annoying but it works.

const init = async () => {

  const unitsList = await client.swapi.fetchData({
    collection: 'unitsList',
    match: { rarity: 7 },
    language: 'eng_us',
    project: {
      baseId: 1,
      nameKey: 1,
      categoryIdList: 1
    }
  });
  
  let skills = await client.swapi.fetchData({
    collection: 'skillList',
    language: 'eng_us',
    project: {
      id: 1,
      abilityReference: 1,
      isZeta: 1
    }
  });

  const abilities = await client.swapi.fetchData({
    collection: 'abilityList',
    language: 'eng_us',
    project: {
      id: 1,
      nameKey: 1,
      type: 1
    }
  });

  client.nameDict = {};
  for (const u of unitsList) {
    client.nameDict[u.baseId] = {nameKey: u.nameKey, categoryIdList: u.categoryIdList};
  }

  client.skillsDict = {};
  for(const a of skills) {
    client.skillsDict[a.id] = {name: abilities.filter(y => y.id === skills.filter(x => x.id === a.id)[0].abilityReference)[0].nameKey, type:a.id.split('skill_')[0]};
  }

  // Here we load **commands** into memory, as a collection, so they're accessible
  // here and everywhere else.
  const cmdFiles = await readdir("./commands/");
  client.logger.log(`Loading a total of ${cmdFiles.length} commands.`);
  cmdFiles.forEach(f => {
    if (!f.endsWith(".js")) return;
    const response = client.loadCommand(f);
    if (response) console.log(response);
  });

  // Then we load events, which will include our message and ready event.
  const evtFiles = await readdir("./events/");
  client.logger.log(`Loading a total of ${evtFiles.length} events.`);
  evtFiles.forEach(file => {
    const eventName = file.split(".")[0];
    const event = require(`./events/${file}`);
    // This line is awesome by the way. Just sayin'.
    client.on(eventName, event.bind(null, client));
    const mod = require.cache[require.resolve(`./events/${file}`)];
    delete require.cache[require.resolve(`./events/${file}`)];
    for (let i = 0; i < mod.parent.children.length; i++) {
      if (mod.parent.children[i] === mod) {
        mod.parent.children.splice(i, 1);
        break;
      }
    }
  });

  // Generate a cache of client permissions for pretty perms
  client.levelCache = {};
  for (let i = 0; i < client.config.permLevels.length; i++) {
    const thisLevel = client.config.permLevels[i];
    client.levelCache[thisLevel.name] = thisLevel.level;
  }

  // Here we login the client.
  client.login(client.config.token);

// End top-level async/await function.
};

init();
