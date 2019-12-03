const express = require('express');
const router = express.Router();

const games = require('./../modules/api/games');
router.get('/games', games.getGames);
router.get('/game/:game_id', games.getGame);

const half_predict = require('./../modules/api/half_predict');
router.get('/half_predict', half_predict.get);

module.exports = router;
