// server.js
// where your node app starts

// init project
var express = require('express');
// init discord
var Discord = require('discord.io');
// setup a new database
var Datastore = require('nedb'), 
    // Security note: the database is saved to the file `datafile` on the local filesystem. It's deliberately placed in the `.data` directory
    // which doesn't get copied if someone remixes the project.
    db = new Datastore({ filename: '.data/datafile', autoload: true });
var app = express();

// Initialize Discord Bot
var bot = new Discord.Client({
   token: process.env.SECRET,
   autorun: true
});

db.servers = new Datastore('data/serversfile.db');
db.charas = new Datastore('data/charasfile.db');
db.servers.loadDatabase();
db.charas.loadDatabase();

// http://expressjs.com/en/starter/static-files.html
app.use(express.static('public'));

// http://expressjs.com/en/starter/basic-routing.html
app.get("/", function (request, response) {
  response.sendFile(__dirname + '/views/index.html');
});
app.get("/commands", function (request, response) {
  response.sendFile(__dirname + '/views/commands.html');
});
app.get("/about", function (request, response) {
  response.sendFile(__dirname + '/views/about.html');
});
app.get("/quickstart", function (request, response) {
  response.sendFile(__dirname + '/views/quickstart.html');
});
app.get("/test", function (request, response) {
  response.sendFile(__dirname + '/views/index_test.html');
});
app.get("/invite", function (request, response) {
  response.redirect('https://discordapp.com/oauth2/authorize?client_id=485569691910275083&scope=bot&permissions=2048.html');
});

// @COURTNEY TRIGGERS
var hiTriggers = ["hello", "hi", "hiya", "hewwo", "how are you"];
var gnTriggers = ["night", "nite", "sleep", "gn", "dreams"];
var iluTriggers = ["love you", "i love you", "<3", "<3 you", "wuv you", "i <3", "i <3 you", "i wuv you", "love u", "i love u", "<3 u", "wuv u", "i <3 u", "i wuv u", "ily", "ilu", "i love ya", "love ya", "i lov u", "<3 ya", "i lov ya", "i lov you"];
var stanTriggers = ["stan"];

// SEND A MESSAGE WITH THE BOTS NAME BEFORE IT (SELFDESTRUCTIVE)
function botMessage(message, serverUUID, channelID, timeout) {
  var msgID;
  db.servers.find({ UUID: serverUUID }, (err, server) => {
    bot.sendMessage({
      to: channelID,
      message: "[[ **" + server[0].botName.toUpperCase() + ":** " + message + " ]]"
    }, (err, sentMsg) => {
      if (timeout != 0 && timeout != undefined && timeout != null)
        setTimeout(() => {
          bot.deleteMessage({
            channelID: channelID,
            messageID: sentMsg.id
          });
        }, timeout);
    });
  });
}

// SHOW THE HEALTH BAR OF A CHARACTER
function showHealth(charaName, serverID, channelID) {
  var message = "";
  // Finds the first character with the given name on the given server.
  db.charas.find({ $and: [{ serverUUID: serverID }, { name: charaName.toUpperCase() }] }, function(err, chara) {
    if (!chara.length) {
      botMessage("I don't know who that is :T", serverID, channelID);
      return;
    }
    
    message = "[[ **" + charaName.toUpperCase() + ":** " + "|".repeat(Math.abs(chara[0].currentHealth)) + (chara[0].currentHealth <= 0 ? "0" : "") + " // " + chara[0].currentHealth + "/" + chara[0].maxHealth + " ]]"
    // If the message is too large, don't show the health markers.
		if (message.length > 400)
			message = "[[ **" + charaName.toUpperCase() + ":** " + chara[0].currentHealth + "/" + chara[0].maxHealth + " ]]";
    bot.sendMessage({
      to: channelID,
      message: message
    });
  })
}

// PARSE NAMES, WHETHER BETWEEN SINGLE QUOTES OR JUST A PLAIN STRING
function parseName(args, extraParams) {
  var charaName = "";
  // If the Name is enclosed within single quotes, then interpret that not as individual arguments.
  if (args[0] !== undefined && args[0].charAt(0) == "'" && args[args.length - extraParams - 1].slice(-1) == "'") {
    if (extraParams)
      charaName = args.slice(0, -extraParams).join(" ");
    else
      charaName = args.join(" ");
    charaName = charaName.substring(1, charaName.length - 1);
  }
  // Otherwise, just take the first argument.
  else charaName = args[0];
  
  return charaName;
}

// GREET GUILDS UPON JOINING THEM, UNLESS THEY ARE ALREADY REGISTERED
bot.on('guildCreate', function (server) {
  const INTRO_NAMES = ["introductions", "intros", "introduction", "intro", "intro-channel", "intros-channel", "intro_channel", "intros_channel"];
  var intro_channel = server.system_channel_id;
  if (bot.servers[server.id].channels != null)
    for (var id in bot.servers[server.id].channels) {
      var channel = bot.servers[server.id].channels[id];
      if (channel.type == 0 && INTRO_NAMES.includes(channel.name) && intro_channel == server.system_channel_id) intro_channel = channel.id;
    }
    
  db.servers.find({ UUID: server.id }, function(err, docs) {
    if (!docs.length)
      db.servers.insert({ UUID: server.id, partyName: "", DMName: "", botName: "Courtney" }, function (err, newServer) {
        bot.sendMessage({
          to: intro_channel,
          message: "[[ **COURTNEY:** Hello there! My name's **Courtney**, but you can call me however you want. I'm but a humble Discord bot whose mission is to help you all keep track of your OCs', D&Dsonas' —however you may call them— healthbars! Kinda niche, I know, but we all gotta start somewhere, and the Developer thought this might be fun.\n\nYou can issue me commands by just typing `c!`, followed of any allowed commands (type `c!help` to see them all).\n\nIf you need help with commands, be sure to type `c!help` into the chat and I'll be sure to help!\n\nYou can start by naming your party with `c!cfg party [NAME]` *and* your DM with `c!cfg DM [NAME]`!\n\nAnd I guess follow my Developer, *perpetuaReality*, on Tumblr, Twitter, DeviantArt, Instagram, YouTube, Wordpress, MySpace, or whatever.\n\nCyall around! ]]"
        });
      });
    });
  });

// IF YOU LEAVE A GUILD, DELETE THE ENTRY ON THE DATABASE
bot.on('guildDelete', function (server) {
  db.servers.remove({ UUID: server.id }, {});
});

var cooldowns = [];

bot.on('message', function (user, userID, channelID, message, evt) {
  var serverID = bot.channels[channelID].guild_id.toString();
  
  // HELLO, @COURTNEY
  var hiFunction = function () {
    var res = false, i = 0;
    while (!res && i < hiTriggers.length) {
      if (message.toLowerCase().includes(hiTriggers[i])) res = true;
      i++;
    }
    return res;
  }
  
  // GOODNIGHT, @COURTNEY
  var gnFunction = function () {
    var res = false, i = 0;
    while (!res && i < gnTriggers.length) {
      if (message.toLowerCase().includes(gnTriggers[i])) res = true;
      i++;
    }
    return res;
  }
  
  // LOVE YOU, @COURTNEY
  var iluFunction = function () {
    var res = false, i = 0;
    while (!res && i < iluTriggers.length) {
      if (message.toLowerCase().startsWith(iluTriggers[i])) res = true;
      i++;
    }
    return res;
  }
  
  // STAN, @COURTNEY
  var stanFunction = function () {
    var res = false, i = 0;
    while (!res && i < stanTriggers.length) {
      if (message.toLowerCase().includes(stanTriggers[i])) res = true;
      i++;
    }
    return res;
  }
  
  if (message.includes("<@!485569691910275083>") || message.includes("<@485569691910275083>")) {
    var flag = 0;
    if (hiFunction()) flag = 1;
    else if (gnFunction()) flag = 2;
    else if (iluFunction()) flag = 3;
    else if (stanFunction()) flag = 4;
    
    if (flag != 0) {
      // COOLDOWN LOGIC
      // If the user is NOT on the cooldown list:
      if (cooldowns.find((user) => { return user.UUID == userID; }) === undefined) {
        var tickerID = 0;
        // In five seconds...
        var timerID = setTimeout(() => {
          console.log(cooldowns.find((user) => { return user.UUID == userID; }).messageIDs);
          // Erase the cooldown entry on the array for the specified user.
          cooldowns.splice(cooldowns.findIndex((user) => { return user.UUID == userID; }), 1);
          // Destroy the timer and ticker.
          clearTimeout(timerID);
          clearInterval(tickerID);
        }, 5000);

        // Enter the user into the cooldown array.
        cooldowns.push({ timerID: timerID, UUID: userID, secsRemaining: 5 });

        // Start the timer.
        tickerID = setInterval(() => {
          // Every second, decrease the timer on the user's cooldown array entry by one.
          cooldowns.find((user) => { return user.UUID == userID; }).secsRemaining--;
        }, 1000);
      }
      // If the user IS on the cooldown list, send the message, and then don't do anything else.
      else {
        botMessage("Please, **" + user + "**, don't type so fast. Wait another " + cooldowns.find((user) => { return user.UUID == userID; }).secsRemaining + " seconds ;n;", serverID, channelID, 5000);
        return;
      }
      
      // If the Cooldown hasn't stopped execution, find the appropriate message to send due to the flag.
      switch (flag) {
        case 1: botMessage("Hello, <@" + userID + ">!", serverID, channelID); break;
        case 2: botMessage("Good night, <@" + userID + ">!", serverID, channelID); break;
        case 3: botMessage("Love you too, <@" + userID + ">!", serverID, channelID); break;
        case 4: botMessage("I stan you too, <@" + userID + ">!", serverID, channelID); break;
      }
    }
  }
  
	// It will listen for messages that will start with `c!`
  if (message.substring(0, 2) == "c!") {
    // COOLDOWN LOGIC
    // If the user is NOT on the cooldown list:
    if (cooldowns.find((user) => { return user.UUID == userID; }) === undefined) {
      var tickerID = 0;
      // In five seconds...
      var timerID = setTimeout(() => {
        console.log(cooldowns.find((user) => { return user.UUID == userID; }).messageIDs);
        // Erase the cooldown entry on the array for the specified user.
        cooldowns.splice(cooldowns.findIndex((user) => { return user.UUID == userID; }), 1);
        // Destroy the timer and ticker.
        clearTimeout(timerID);
        clearInterval(tickerID);
      }, 5000);
      
      // Enter the user into the cooldown array.
      cooldowns.push({ timerID: timerID, UUID: userID, secsRemaining: 5 });
      
      // Start the timer.
      tickerID = setInterval(() => {
        // Every second, decrease the timer on the user's cooldown array entry by one.
        cooldowns.find((user) => { return user.UUID == userID; }).secsRemaining--;
      }, 1000);
    }
    // If the user IS on the cooldown list, send the message, and then don't do anything else.
    else {
      botMessage("Please, **" + user + "**, don't type so fast. Wait another " + cooldowns.find((user) => { return user.UUID == userID; }).secsRemaining + " seconds ;n;", serverID, channelID, 5000);
      return;
    }
    
    var args = message.substring(2).split(' ');
    var cmd = args[0];
       
		args = args.splice(1);
    switch(cmd) {
      // HEARTBEAT
			case 'heartbeat':
				bot.sendMessage({
					to: channelID,
					message: "[[ ドキドキ ]]"
				});
				break;
        
      // REGISTERING CHARACTERS
			case 'new':
			case 'newCharacter':
      case 'newChara':
      case 'add':
      case 'addCharacter':
      case 'addChara':
        var charaName = parseName(args, 1), maxHP = 0, error = false;
        // Try to take the last argument as the Max HP.
        maxHP = parseInt(args[args.length - 1]);
        // Throw an error if the Max HP is bigger than 50 million or lower than 0, OR if it's not a number at all.
        if (isNaN(maxHP) || maxHP > 50000000 || maxHP < 0) { error = true; }
        
        // Show an error message if there we no inputs, the input is longer than 32 characters, or another error.
				if (charaName == "" || charaName === undefined || error == true) {
					botMessage("That's not how this command works. You gotta type `c!" + cmd + " [CHARACTER NAME] [MAX HP]` for it to work.\n\nRemember that to use spaces on your name, please *surround it by single quotes*! As such: `'Very Cool Character'` or `'Pam, Who Death Forgot'`. Also, please *keep your Max HP between 0 and 50 million.*", serverID, channelID);
					break;
				} else if (charaName.length > 32) {
					botMessage("Please choose a name shorter than 32 characters.", serverID, channelID);
					break;
        }
        
        // See if a character with the name provided is already registered under this server.
        db.servers.find({ UUID: serverID }, (err, server) => {
          db.charas.find({ $and: [{ serverUUID: serverID }, { name: charaName.toUpperCase() }] }, (err, results) => {
            if (!results.length)
              // If the character is brand new, register them!
              db.charas.insert({ serverUUID: serverID, name: charaName.toUpperCase(), maxHealth: maxHP, currentHealth: maxHP, summoned: false }, (err, newChara) => {
                if (!err)
                 botMessage("***" + newChara.name + "*** has joined the " + (server[0].partyName != "" ? "*" + server[0].partyName + "*" : "") + " Roster!", serverID, channelID);
              });
            // If there IS another character with that name on this Roster, alert the user.
            else
              botMessage("There's already a Roster member with that name!", serverID, channelID);
          });
        });
				break;
        
      // CALL FOR BATTLE
      case 'call':
      case 'callforBattle':
      case 'callForBattle':
      case 'summon':
        var charaName = parseName(args, 0);
        
				if (charaName == "" || charaName === undefined) {
          // Show an error message if there we no inputs.
					botMessage("That's not how this command works. You gotta type `c!" + cmd + " [CHARACTER]` for it to work.\n\nRemember that to use spaces on your name, please *surround it by single quotes*! As such: `'Very Cool Character'` or `'Pam, Who Death Forgot'`.", serverID, channelID);
				} else {
          db.charas.find({ $and: [{ serverUUID: serverID }, { name: charaName.toUpperCase() }] }, (err, results) => {
            if (results.length) {
              if (results[0].summoned) botMessage("**" + charaName.toUpperCase() + "** was already summoned.", serverID, channelID);
              else
                db.charas.update({ _id: results[0]._id }, { $set: { summoned: true } }, {}, (err) => {
                  botMessage("**" + charaName.toUpperCase() + "** has been summoned for battle!", serverID, channelID);
                });
            } else
              botMessage("I don't know who that is :T", serverID, channelID);
          });
        }
				break;
        
      // DISMISS
      case 'dismiss':
        var charaName = parseName(args, 0);
        
				if (charaName == "" || charaName === undefined) {
          // Show an error message if there we no inputs.
					botMessage("That's not how this command works. You gotta type `c!" + cmd + " [CHARACTER]` for it to work.\n\nRemember that to use spaces on your name, please *surround it by single quotes*! As such: `'Very Cool Character'` or `'Pam, Who Death Forgot'`.", serverID, channelID);
				} else {
          db.charas.find({ $and: [{ serverUUID: serverID }, { name: charaName.toUpperCase() }] }, (err, results) => {
            if (results.length) {
              if (!results[0].summoned) botMessage("**" + charaName.toUpperCase() + "** wasn't summoned yet.", serverID, channelID);
              else
                db.charas.update({ _id: results[0]._id }, { $set: { summoned: false, currentHealth: results[0].maxHealth } }, {}, (err) => {
                  if (err) console.log(err);
                  botMessage("**" + charaName.toUpperCase() + "** has been dismissed!", serverID, channelID);
                });
            } else
              botMessage("I don't know who that is :T", serverID, channelID);
          });
        }
				break;
        
      // DISMISS EVERYONE
      case 'dismissAll':
        db.charas.find({ $and: [{ serverUUID: serverID }, { summoned: true }] }, (err, charas) => {
          if (charas.length) {
            charas.forEach((chara) => {
              db.charas.update({ _id: chara._id }, { $set: { summoned: false, currentHealth: chara.maxHealth } }, {});
            });
            botMessage("The entire party has been dismissed!", serverID, channelID);
          }
          else botMessage("There was no-one to dismiss, but I dismissed them anyway.", serverID, channelID);
        });
				break;
        
      // SETTING HEALTH
			case 'set':
			case 'setHealth':
        var charaName = parseName(args, 1), newHP = 0, error = false;
        // Try to take the last argument as the Max HP.
        newHP = parseInt(args[args.length - 1]);
        // Throw an error if the New HP's absolute value is bigger than 50 million, OR if it's not a number at all.
        if (isNaN(newHP) || newHP > 50000000 || newHP < -50000000) { error = true; }
        
        // Show an error message if there we no inputs or another error.
				if (charaName == "" || charaName === undefined || error == true) {
					botMessage("That's not how this command works. You gotta type `c!" + cmd + " [CHARACTER] [NEW HEALTH]` for it to work.\n\nRemember that to use spaces on your name, please *surround it by single quotes*! As such: `'Very Cool Character'` or `'Pam, Who Death Forgot'`. Also, please *keep your New HP between negative and positive 50 million.*", serverID, channelID);
					break;
				}
        
        db.charas.update({ $and: [{ serverUUID: serverID }, { name: charaName.toUpperCase() }] }, { $set: { currentHealth: newHP } }, {}, (err, numAffected) => {
          if (numAffected) botMessage("Set **" + charaName.toUpperCase() + "**'s health to " + newHP + "HP!", serverID, channelID);
          showHealth(charaName.toUpperCase(), serverID, channelID);
        });
				break;
        
      // SETTING MAX HEALTH
			case 'setMax':
			case 'setMaxHealth':
        var charaName = parseName(args, 1), maxHP = 0, error = false;
        // Try to take the last argument as the Max HP.
        maxHP = parseInt(args[args.length - 1]);
        // Throw an error if the Max HP's is larger than 50 million, negative, OR if it's not a number at all.
        if (isNaN(maxHP) || maxHP > 50000000 || maxHP <= 0) { error = true; }
        
        // Show an error message if there we no inputs or another error.
				if (charaName == "" || charaName === undefined || error == true) {
					botMessage("That's not how this command works. You gotta type `c!" + cmd + " [CHARACTER] [MAX HP]` for it to work.\n\nRemember that to use spaces on your name, please *surround it by single quotes*! As such: `'Very Cool Character'` or `'Pam, Who Death Forgot'`. Also, please *keep your new MAX HP between 0 and 50 million.*", serverID, channelID);
					break;
				}
        
        db.charas.update({ $and: [{ serverUUID: serverID }, { name: charaName.toUpperCase() }] }, { $set: { maxHealth: maxHP } }, {}, (err, numAffected) => {
          if (numAffected) botMessage("Set **" + charaName.toUpperCase() + "**'s Max health to " + maxHP + "HP!", serverID, channelID);
          showHealth(charaName.toUpperCase(), serverID, channelID);
        });
				break;
        
      // MODIFY HEALTH
			case 'modify':
			case 'modifyHealth':
      case 'mod':
      case 'modHeath':
      // HEAL / INCREASE HEALTH
			case 'heal':
			case 'give':
			case 'giveHealth':
			case 'addHealth':
      // DAMAGE / REDUCE HEALTH
			case 'damage':
			case 'sub':
			case 'subHealth':
			case 'take':
			case 'takeHealth':
			case 'subtract':
			case 'subtractHealth':
        var charaName = parseName(args, 1), newHP = 0, error = false;
        var command = 0;
        var dictionary = [["CHANGE", "HEALING", "DAMAGE"], ["Modified **", "Healed **", "**"], ["** health's by ", "** for ", "** took "], [" HP!", " HP!", " points of damage!"]];
        
        // Assess which kind of modifier is being applied.
        switch (cmd) {
          case 'modify': case 'modifyHealth': case 'mod': case 'modHeath':
            command = 0; break;
          case 'heal': case 'give': case 'giveHealth': case 'addHealth':
            command = 1; break;
          case 'damage': case 'sub': case 'subHealth': case 'take': case 'takeHealth': case 'substract': case 'substractHealth':
            command = 2; break;
        }
        
        // Try to take the last argument as the Max HP.
        newHP = parseInt(args[args.length - 1]);
        // Throw an error if the HP change's absolute value is greater tan 1 million, OR if it's not a number at all.
        if (isNaN(newHP) || newHP > 1000000 || newHP < -1000000) { error = true; }
        
        if (charaName == "" || charaName === undefined || error == true) {
          botMessage("That's not how this command works. You gotta type `c!" + cmd + " [CHARACTER] [" + dictionary[0][command] + "]` for it to work.\n\nRemember that to use spaces on your name, please *surround it by single quotes*! As such: `'Very Cool Character'` or `'Pam, Who Death Forgot'`. Also, please *keep the change to HP between negative and positive 1 million* and *your current health at all times between positive and negative 50 million.*", serverID, channelID);
          break;
        }
        
        // This whole chunk of code is inside the promise function because I can't reliably update external variables from within. All other chunks that need to check with the database should be written like this.
        db.charas.find({ $and: [{ serverUUID: serverID }, { name: charaName.toUpperCase() }] }, (err, results) => {
          if (!results.length) {
            botMessage("I don't know who that is :T", serverID, channelID);
            return;
          }
          // Throw an error if the new result HP's absolute value would be greater than 50 million.
          if (results[0].currentHealth + newHP > 50000000 || results[0].currentHeath + newHP < -50000000) error = true;
          
          // Show an error message if there we no inputs or another error.
          if (error == true) {
            botMessage("That's not how this command works. You gotta type `c!" + cmd + " [CHARACTER] [" + dictionary[0][command] + "]` for it to work.\n\nRemember that to use spaces on your name, please *surround it by single quotes*! As such: `'Very Cool Character'` or `'Pam, Who Death Forgot'`. Also, please *keep the change to HP between negative and positive 1 million* and *your current health at all times between positive and negative 50 million.*", serverID, channelID);
            // Normally, here there would be a break statement, but since this is inside a promise function, that wouldn't work.
            // Rather, I'll use an else statement.
				  } else {
            var change;
            // If the command was to damage the Character, then increment inversely. Otherwise, increment normally.
            if (command == 0 || command == 1) change = { $inc: { currentHealth: newHP } }
            else change = { $inc: { currentHealth: -newHP } }
            
            // Show the appropriate success message.
            db.charas.update({ $and: [{ serverUUID: serverID }, { name: charaName.toUpperCase() }] }, change, {}, (err, numAffected) => {
              if (numAffected) botMessage(dictionary[1][command] + charaName.toUpperCase() + dictionary[2][command] + newHP + dictionary[3][command], serverID, channelID);
              showHealth(charaName.toUpperCase(), serverID, channelID);
            });
          }
        });
				break;
        
      // HYPERDEATH
			case "hyperdeath":
        var charaName = parseName(args, 0);
        var errorCodes = ["0xDEAD00F", "0x617600D", "0xDD8DA00", "0x0056820"];
        
				if (charaName == "" || charaName === undefined) {
          // Show an error message if there we no inputs.
					botMessage("That's not how this command works. You gotta type `c!" + cmd + " [CHARACTER]` for it to work.\n\nRemember that to use spaces on your name, please *surround it by single quotes*! As such: `'Very Cool Character'` or `'Pam, Who Death Forgot'`.", serverID, channelID);
				} else {
          // Otherwise, show the healthbar.
          botMessage("Excuse me for a second while I apply the damage. CALCULATING...", serverID, channelID);
          setTimeout(() => bot.sendMessage({
            message: "[[ **Program COURTNEY.js exited with error code " + errorCodes[parseInt(Math.random() * errorCodes.length)] + ".** ]]\n[[ **ERROR DESCRIPTION:** Damage too great. ]]\n[[ *Please restart your Courtney or contact your system administrator.* ]]",
            to: channelID
          }), 2000)
        }
				break;
        
      // SHOW HEALTH MANUALLY
			case "show":
			case "showHealth":
      case "healthBar":
      case "bar":
        var charaName = parseName(args, 0);
        
				if (charaName == "" || charaName === undefined) {
          // Show an error message if there we no inputs.
					botMessage("That's not how this command works. You gotta type `c!" + cmd + " [CHARACTER]` for it to work.\n\nRemember that to use spaces on your name, please *surround it by single quotes*! As such: `'Very Cool Character'` or `'Pam, Who Death Forgot'`.", serverID, channelID);
				} else {
          // Otherwise, show the healthbar.
          showHealth(charaName.toUpperCase(), serverID, channelID);
        }
				break;
        
      // SHOW WHOLE PARTY
			case "showAll":
			case "showAllHealth":
			case "list":
			case "listHealth":
			case "partyHealth":
			case "showParty":
      case "party":
        db.servers.find({ UUID: serverID }, (err, server) => {
          db.charas.find({ $and: [{ serverUUID: serverID }, { summoned: true }] }, (err, results) => {
            var message = "[[" + (server[0].partyName != "" ? "***" + server[0].partyName + "***" : "") + " **CURRENT PARTY HEALTHS** ]]\n\n"
            if (results) 
              results.forEach((character) => {
                message += "[[ **" + character.name.toUpperCase() + ":** " + character.currentHealth + "/" + character.maxHealth + " ]]\n";
              });
            if (!results.length)  message += "[[ There are no characters currently on this party! Have you `c!summon`'d or `c!call`'d them? ]]";
            // Send the message
            bot.sendMessage({
              to: channelID,
              message: message
            })
          });
        });
				break;
        
      // SHOW WHOLE ROSTER
      case "roster":
      case "showRoster":
      case "listRoster":
        db.servers.find({ UUID: serverID }, (err, server) => {
          db.charas.find({ serverUUID: serverID }, (err, results) => {
            var message = "[[" + (server[0].partyName != "" ? "***" + server[0].partyName + "***" : "") + " **ROSTER** ]]\n\n"
            if (results) 
              results.forEach((character) => {
                message += "[[ **" + character.name.toUpperCase() + ":** " + character.currentHealth + "/" + character.maxHealth + " ]]\n";
              });
            if (!results.length)  message += "[[ There are no characters on this Roster. Add some with `c!add`. ]]";
            // Send the message
            bot.sendMessage({
              to: channelID,
              message: message
            })
          });
        });
				break;
        
      // ERASE CHARACTER FROM ROSTER
			case "erase":
			case "delete":
			case "rachel":
        var charaName = parseName(args, 0);
        
				if (charaName == "" || charaName === undefined) {
          // Show an error message if there we no inputs.
					botMessage("That's not how this command works. You gotta type `c!" + cmd + " [CHARACTER]` for it to work.\n\nRemember that to use spaces on your name, please *surround it by single quotes*! As such: `'Very Cool Character'` or `'Pam, Who Death Forgot'`.", serverID, channelID);
				} else {
          // Otherwise, try to erase the entry.
          db.charas.remove({ $and: [{ serverUUID: serverID }, { name: charaName.toUpperCase() }] }, {}, (err, numAffected) => {
            if (numAffected) botMessage("**" + charaName.toUpperCase() + "** was erased from the Roster. Pour one out.", serverID, channelID);
            else botMessage("I don't know who that is :T", serverID, channelID);
          });
        }
				break;
        
      // CONFIGURATIONS
      case "cfg":
      case "config":
        switch (args[0]) {
          case "party":
            var partyName = parseName(args.slice(1), 0);
            console.log(parseName(args.slice(1), 0));
            if (partyName == "" || partyName === undefined) {
              // Show an error message if there we no inputs.
              botMessage("That's not how this command works. You gotta type `c!" + cmd + " partyName [NAME]` for it to work.\n\nRemember that to use spaces on your name, please *surround it by single quotes*! As such: `'The Party'` or `'Party Number 9 Donut Steel'`.", serverID, channelID);
            } else if (partyName.length > 32) {
					    botMessage("Please choose a name shorter than 32 characters.", serverID, channelID);
					    break;
            } else {
              // Otherwise, update the database.
              db.servers.update({ UUID: serverID }, { $set: { partyName: partyName } }, {}, () => {
                botMessage("Your party is now called *" + partyName + "*", serverID, channelID);
              });
            }
            break;
          case "DM":
            var DMName = parseName(args.slice(1), 0);
            if (DMName == "" || DMName === undefined) {
              // Show an error message if there we no inputs.
              botMessage("That's not how this command works. You gotta type `c!" + cmd + " DMName [NAME]` for it to work.\n\nRemember that to use spaces on your name, please *surround it by single quotes*! As such: `'The Party'` or `'Party Number 9 Donut Steel'`.", serverID, channelID);
            } else if (DMName.length > 32) {
					    botMessage("Please choose a name shorter than 32 characters.", serverID, channelID);
					    break;
            } else {
              // Otherwise, update the database.
              db.servers.update({ UUID: serverID }, { $set: { DMName: DMName } }, {}, () => {
                botMessage("All hail the great *" + DMName + "*", serverID, channelID);
              });
            }
            break;
          case "bot":
            var botName = parseName(args.slice(1), 0);
            if (botName == "" || botName === undefined) {
              // Show an error message if there we no inputs.
              botMessage("That's not how this command works. You gotta type `c!" + cmd + " botName [NAME]` for it to work.\n\nRemember that to use spaces on your name, please *surround it by single quotes*! As such: `'The Party'` or `'Party Number 9 Donut Steel'`.", serverID, channelID);
            } else if (botName.length > 32) {
					    botMessage("Please choose a name shorter than 32 characters.", serverID, channelID);
					    break;
            } else {
              // Otherwise, update the database.
              db.servers.update({ UUID: serverID }, { $set: { botName: botName } }, {}, () => {
                botMessage("I'm *" + botName + "* now", serverID, channelID);
              });
            }
            break;
          default:
            botMessage("Not sure what you meant. Check you wrote the right command.", serverID, channelID);
            break;
        }
        break;
        
      // HELP
			case "help":
			case "listCommands":
			case "commands":
        // OPTIMIZE THIS VIA JSON ON-DISK READING
        var commandList = [ [ "", undefined ], [ "new", "newCharacter", "newChara", "add", "addCharacter", "addChara" ], [ "summon", "call", "callforBattle", "callForBattle" ], [ "dismiss" ], [ "dismissAll" ], [ "set", "setHealth" ], [ "setMax", "setMaxHealth" ], [ "modify", "modifyHealth", "mod", "modHealth" ], [ "heal", "give", "giveHealth", "addHealth" ], [ "damage", "sub", "subHealth", "subtract", "subtractHealth", "take", "takeHealth" ], [ "show", "showHealth", "healthBar", "bar" ], [ "showAll", "showAllHealth", "list", "listHealth", "partyHealth", "showParty", "party" ], [ "roster", "showRoster", "listRoster" ], [ "erase", "delete", "rachel" ], ["hyperdeath", "hyperkill"], [ "cfg", "config" ], [ "help", "commands", "listCommands" ], [ "heartbeat" ], [ "perp" ] ];
        var cmdNumber = commandList.findIndex((element) => { return element.findIndex((elem) => { return elem == args[0]; }) != -1; });
        switch (cmdNumber) {
          case 0:
            botMessage("Hello. I'm Courtney. I'm a healer and I keep tabs on the entire party's health status. You can tell me to do stuff using commands. Below are all the commands currently available.\n\nType `c!help ` followed by the name of any command to obtain more info on how to use it.```" +
                       " COMMAND      | ALIASES (equivalent)\n" +
                       "==============+==============================================================\n" +
                       " new          | newCharacter || newChara || add || addCharacter || addChara \n" +
                       " summon       | call || callforBattle || callForBattle \n" +
                       " dismiss      | \n" +
                       " dismissAll   | \n" +
                       " set          | setHealth \n" +
                       " setMax       | setMaxHealth \n" +
                       " modify       | modifyHealth || mod || modHealth \n" +
                       " heal         | give || giveHealth || addHealth \n" +
                       " damage       | sub || subHealth || subtract || subtractHealth || take || takeHealth \n" +
                       " show         | showHealth || healthBar || bar \n" +
                       " showAll      | party || showAllHealth || list || listHealth || partyHealth || showParty \n" +
                       " roster       | showRoster || listRoster \n" +
                       " erase        | delete || rachel \n" +
                       " hyperdeath   | hyperkill \n" +
                       " cfg          | config \n" +
                       " help         | commands || listCommands \n" +
                       " heartbeat    | \n" +
                       " perp         |```", serverID, channelID);
            break;
          case 1:
            botMessage("`c!new`\nRegister a new character into the roster. If there is already a character with that name on the Roster, throws an error.\n\n**Aliases:** `newCharacter`, `newChara`, `add`, `addCharacter`, `addChara`\n\n**Usage:**\n`c!new [CHARACTER] [MAX HP]`\n`[CHARACTER]` The name of your new character. Less than 32 characters. If you want to use spaces, surround the name by single quotes. Case-insensitive.\n`[MAX HP]` Your character's Max (or Base) HP. Has to be an integer between 0 and 50 million.\n\n**Examples:**\n`c!new Courtney 20` Adds a character named *Courtney* to the Roster with 20 base HP.\n`c!new COURTNEY 20` Does the same as the command above.\n`c!new 'The Chosen One' 10000` Adds a character name *The Chosen One* to the Roster with 10000 base HP.", serverID, channelID);
            break;
          case 2:
            botMessage("`c!summon`\nSummons a character from the Roster into the active Party. If the character isn't on the Roster, or was already summoned, throws an error.\n\n**Aliases:** `call`, `callforBattle`, `callForBattle`\n\n**Usage:**\n`c!summon [CHARACTER]`\n`[CHARACTER]` The name of your character. If you want to use spaces, surround the name by single quotes (`'`). Case-insensitive.\n\n**Examples:**\n`c!summon Courtney` Summons *Courtney* from the Roster into the active Party.\n`c!summon COURTNEY` Does the same as the command above.\n`c!summon 'The Chosen One'` Summons *The Chosen One* from the Roster into the active Party.", serverID, channelID);
            break;
          case 3:
            botMessage("`c!dismiss`\nDismisses a character from the active Party and restores their health back to their Max HP. If the character isn't on the Roster, or wasn't summoned on the first place, throws an error.\n\n**Usage:**\n`c!dismiss [CHARACTER]`\n`[CHARACTER]` The name of your character. If you want to use spaces, surround the name by single quotes (`'`). Case-insensitive.\n\n**Examples:**\n`c!dismiss Courtney` Dismisses *Courtney* from the active Party.\n`c!dismiss COURTNEY` Does the same as the command above.\n`c!dismiss 'The Chosen One'` Dismisses *The Chosen One* from the active Party.", serverID, channelID);
            break;
          case 4:
            botMessage("`c!dismissAll`\nDismisses everyone from the active Party and restores their health back to their Max HP. If no one was summoned in the first place, throws an error.\n\n**Usage:**\n`c!dismissAll`", serverID, channelID);
            break;
          case 5:
            botMessage("`c!set`\nSet a character's current HP (doesn't need to have been summoned). If the character isn't on the Roster, throws an error.\n\n**Aliases:** `setHealth`\n\n**Usage:**\n`c!set [CHARACTER] [NEW HP]`\n`[CHARACTER]` The name of your character. If you want to use spaces, surround the name by single quotes. Case-insensitive.\n`[NEW HP]` Your character's new HP. Has to be an integer between -50 million and +50 million.\n\n**Examples:**\n`c!set Courtney 70` Sets *Courtney*'s health to 70 HP.\n`c!set COURTNEY 70` Does the same as the command above.\n`c!set 'The Chosen One' 10000` Sets *The Chosen One*'s health to 10000 HP.\n`c!set Weakling -10` Sets *Weakling*'s health to -10 HP.", serverID, channelID);
            break;
          case 6:
            botMessage("`c!setMax`\nChange the Max (or Base) HP of a character on the Roster. If the character isn't on the Roster, throws an error.\n\n**Aliases:** `setMaxHealth`\n\n**Usage:**\n`c!setMax [CHARACTER] [MAX HP]`\n`[CHARACTER]` The name of your character. If you want to use spaces, surround the name by single quotes. Case-insensitive.\n`[MAX HP]` Your character's Max (or Base) HP. Has to be an integer between 0 and 50 million.\n\n**Examples:**\n`c!setMax Courtney 50` Set's *Courtney* Max Health to 50 HP.\n`c!setMax COURTNEY 50` Does the same as the command above.\n`c!setMax 'The Chosen One' 50000` Sets *The Chosen One*'s Max Health to 50000 HP.", serverID, channelID);
            break;
          case 7:
            botMessage("`c!modify`\nModifies a character's HP by a certain amount (doesn't need to have been summoned). If the character isn't on the Roster, throws an error.\n\n**Aliases:** `modifyHealth`, `mod`, `modHealth`\n\n**Usage:**\n`c!modify [CHARACTER] [CHANGE]`\n`[CHARACTER]` The name of your character. If you want to use spaces, surround the name by single quotes. Case-insensitive.\n`[CHANGE]` The change to your character's HP. Has to be an integer between -1 million and +1 million.\n\n**Examples:**\n`c!modify Lucky 200` Increases health for/heals *Lucky* for 200HP.\n`c!modify Unlucky -200` Decreases health for/damages *Unlucky* for 200 points of damage.\n`c!modify Meh 0` Modifies *Meh*'s health by 0. Basically, nothing happens.", serverID, channelID);
            break;
          case 8:
            botMessage("`c!heal`\nIncreases a character's HP by a certain amount (doesn't need to have been summoned). If the character isn't on the Roster, throws an error.\n\n**Aliases:** `give`, `giveHealth`, `addHealth`\n\n**Usage:**\n`c!heal [CHARACTER] [HEALING]`\n`[CHARACTER]` The name of your new character. If you want to use spaces, surround the name by single quotes. Case-insensitive.\n`[HEALING]` The increase to your character's HP. Has to be an integer between -1 million and +1 million.\n\n**Examples:**\n`c!heal Lucky 200` Heals *Lucky* for 200HP.\n`c!heal Unlucky -200` Heals *Unlucky* for -200 HP, essentially **dealing them 200 points of damage**.\n`c!heal Meh 0` Heals *Meh*'s for 0HP. Basically, nothing happens.", serverID, channelID);
            break;
          case 9:
            botMessage("`c!damage`\nDecreases a character's HP by a certain amount (doesn't need to have been summoned). If the character isn't on the Roster, throws an error.\n\n**Aliases:** `sub`, `subHealth`, `take`, `takeHealth`, `subtract`, `subtractHealth`\n\n**Usage:**\n`c!damage [CHARACTER] [DAMAGE]`\n`[CHARACTER]` The name of your character. If you want to use spaces, surround the name by single quotes. Case-insensitive.\n`[DAMAGE]` The decrease to your character's HP. Has to be an integer between -1 million and +1 million.\n\n**Examples:**\n`c!damage Unlucky 200` Deals *Unlcky* 200 points of damage.\n`c!damage Lucky -200` Deals *Lucky* -200 points of damage, essentially **healing them for 200HP**.\n`c!damage Meh 0` Deals *Meh* 0 points of damage. Basically, nothing happens.", serverID, channelID);
            break;
          case 10:
            botMessage("`c!show`\nShows the healthbar of a character (doesn't need to have been summoned). If the character isn't on the Roster, throws an error.\n\n**Aliases:** `showHealth`, `healthBar`, `bar`\n\n**Usage:**\n`c!show [CHARACTER]`\n`[CHARACTER]` The name of your character. If you want to use spaces, surround the name by single quotes. Case-insensitive.\n\n**Examples:**\n`c!show Courtney` Shows *Courtney*'s healthbar.\n`c!show COURTNEY` Does the same as the command above.\n`c!show 'The Chosen One'` Shows *The Chosen One*'s healthbar.", serverID, channelID);
            break;
          case 11:
            botMessage("`c!showAll`\nShows the whole summoned party's healthbars.\n\n**Aliases:** `showAllHealth`, `list`, `listHealth`, `partyHealth`, `showParty`\n\n**Usage:**\n`c!showAll`", serverID, channelID);
            break;
          case 12:
            botMessage("`c!roster`\nShows the whole Roster's healthbars.\n\n**Aliases:** `showRoster`, `listRoster`\n\n**Usage:**\n`c!roster`", serverID, channelID);
            break;
          case 13:
            botMessage("`c!erase`\nErases a character from the Roster. If the character isn't on the Roster, throws an error.\n\n**Aliases:** `delete`, `rachel`\n\n**Usage:**\n`c!erase [CHARACTER]`\n`[CHARACTER]` The name of your character. If you want to use spaces, surround the name by single quotes. Case-insensitive.\n\n**Examples:**\n`c!erase Forsaken` Erases *Forsaken* from the Roster.\n`c!erase FORSAKEN` Does the same as the command above.\n`c!erase 'The Forsaken One'` Erases *The Forsaken One* from the Roster.", serverID, channelID);
            break;
          case 14:
            botMessage("`c!hyperdeath`\nDestroys someone with an unfathomable amount of damage. Doesn't actually do anything to your Party or Roster records. Just for fun.\n\n**Aliases:** `hyperkill`\n\n**Usage:**\n`c!hyperdeath [NAME]`\n`[NAME]` Some name. If you want to use spaces, surround the name by single quotes. Case-insensitive.\n\n**Examples:**\n`c!show Martyr` Hyperkills *Martyr*.\n`c!hyperdeath MARTYR` Does the same as the command above.\n`c!show 'Press F For Respects'` Hyperkills *Press F For Respects*.", serverID, channelID);
            break;
          case 15:
            botMessage("`c!cfg`\nConfigurate the bot's preferences for your server.\n\n**Aliases:** `config`\n\n**Usage:**\n`c!cfg [PROPERTY] [ARGUMENT/S]`\n`[PROPERTY]` The name of the property or attribute you want to modify for your server. Use `bot` to change Courtney's name, `party` to change the name of your Party and Roster, and `DM` so that Courtney knows what your DM is called.\n`[ARGUMENT/S]` The value/values you want to change the Property or Attribute to. If you want to use spaces, surround the name by single quotes.\n\n**Examples:**\n`c!cfg bot healthbot` Changes Courtney's name to *healthbot*.\n`c!cfg party 'Party 2: Party Harderer'` Changes the party's name to *Party 2: Party Harderer*.\n`c!cfg DM God` Changes the DM's name to *God*.", serverID, channelID);
            break;
          case 16:
            botMessage("`c!help`\nGives help about how to use Courtney and her commands.\n\n**Aliases:** `listCommands`, `commands`\n\n**Usage:**\n`c!help [COMMAND (optional)]`\n`[COMMAND (optional)]` **Optional** parameter. A command you want to know more about. Case-sensitive.\n\n**Examples:**\n`c!help` Lists all the commands available.\n`c!help summon` Gives help with the `summon` command.", serverID, channelID);
            break;
          case 17:
            botMessage("`c!heartbeat`\nDoki doki.\n\n**Usage:**\n`c!heartbeat`", serverID, channelID);
            break;
          case 18:
            botMessage("`c!perp`\nPerp.\n\n**Usage:**\n`c!perp`", serverID, channelID);
            break;
          default:
            botMessage("I can't recognize that command. Check you wrote the right one. Type `c!help` to see the command list again.", serverID, channelID);
            break;
        }
        if (cmdNumber != 0 && cmdNumber != -1)
          botMessage("Remember to not include the square brackets (`[]`) when typing something. The whole thing wrapped on [] should be replaced by whatever arguments you desire.", serverID, channelID);
				break;
        
      // PERP
			case "perp":
				var image = ""
				var rand = parseInt(Math.random() * 10)
				switch (rand) {
					case 0: image = "https://vignette.wikia.nocookie.net/mspaintadventures/images/8/81/Vriska_Serket.png/revision/latest?cb=20130323192126&path-prefix=es"
					break;
					case 1: image = "https://vignette.wikia.nocookie.net/unanything/images/6/6b/VriskaSerket.png/revision/latest?cb=20170330132249"
					break;
					case 2: image = "https://vignette.wikia.nocookie.net/mspaintadventures/images/a/a7/Vriska_cooldrawing.gif/revision/latest?cb=20100714004131"
					break;
					case 3: image = "https://pa1.narvii.com/6238/d957a537afe367b01d58bb971535f1eddf595893_hq.gif"
					break;
					case 4: image = "https://www.homestuck.com/images/storyfiles/hs2/07783.gif"
					break;
					case 5: image = "https://vignette.wikia.nocookie.net/vsbattles/images/3/3e/Vriska_god_tier.gif/revision/latest?cb=20150823051041"
					break;
					case 6: image = "https://i.ytimg.com/vi/44Kl6zq9n3M/hqdefault.jpg"
					break;
					case 7: image = "https://vignette.wikia.nocookie.net/mspaintadventures-en-espanol/images/8/87/Homosuck_Vriska.png/revision/latest?cb=20141021155822&path-prefix=es"
					break;
					case 8: image = "https://static.tumblr.com/a948293cd5e5c6a20255b41c196ebbb9/z8nvfkx/ujPozmu57/tumblr_static_27m4xtnwzg4kwowwsg4o40888.png [[ credit tumblr user milkyol ]]"
					break;
					case 9: image = "http://www.mspaintadventures.com/storyfiles/hs2/04837.gif"
					break;
					case 10: image = "https://media.giphy.com/media/ZHN5FSJKeMQ9y/source.gif"
					break;
				}
        // Send the message
        botMessage("I'm sorry, but I didn't understand that command. Trying to interpret your query, I arrived to this conclusion: " + image, serverID, channelID);
				break;
        
      // DEFAULT CASE
			default:
				botMessage("I heard my name, but no orders afterwards. Do you just want to chat or do you not remember the keywords?", serverID, channelID);
				break;
        }
     }
});

// listen for requests :)
var listener = app.listen(process.env.PORT, function () {
  console.log('Your app is listening on port ' + listener.address().port);
});
