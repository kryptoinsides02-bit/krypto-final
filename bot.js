/**
 * bot.js — DEPRECATED STUB
 *
 * This file previously ran its own Telegram polling loop which conflicted
 * with telegrambot.js (causing "409 Conflict: terminated by other getUpdates
 * request" and the bot ignoring all /start commands).
 *
 * All Telegram logic now lives in telegrambot.js.
 * This file re-exports from there — NO polling loop is started here.
 */

const tg = require('./telegrambot');

module.exports = {
  sendTweetAlert:         tg.notifyTweet,
  sendNewsAlert:          tg.notifyBreakingNews,
  broadcastEmergency:     tg.notifyTweet,
  registerUser:           tg.registerUser,
  getUser:                tg.getUser,
  getBotInfo:             tg.getBotInfo,
  generateConnectionCode: function() { return null; },
  onConnected:            function() {},
  getUsersByUserId:       function() { return []; },
  telegramUsers:          {},
};

// pollUpdates() is intentionally NOT called here.
// It is called ONCE in index.js on server startup.
