const debug = require('debug')('odds:games');
const { getData, getCount } = require('./../../libs/utils');

const getConditions = (query) => {
  const conditions = {};
  const { date } = query;
  if (date) conditions.date = date;

  return conditions;
}

const summarizeGames = games => games.map(game => ({
  game_name: game.game_name,
  date: game.date,
  time: game.time,
  final_home_score: game.final_home_score,
  final_away_score: game.final_away_score,
  half_home_score: game.half_home_score,
  half_away_score: game.half_away_score,
  game_id: game.game_id,
  home_team: game.home_team,
  away_team: game.away_team,
}));

const getOptions = (query) => {
  const options = {};
  const size = query.size || 10;
  const current_page = query.current_page || 1;
  options.skip = size * (current_page - 1);
  options.limit = parseInt(size, 10);
  options.sort = { date: 1, time: 1 };
  return options;
};

const getPageData = (query) => {
  const size = query.size || 10;
  const current_page = query.current_page || 1;
  return {
    current_page,
    size,
  };
};

exports.getGame = async (req, res) => {
  try {
    const { game_id } = req.params;
    const conditions = { game_id };
    const games = await getData('odds_v2', conditions);
    if (games.length) {
      res.json({
        status: 10200,
        data: games[0],
      });
    } else {
      res.json({
        status: 10600,
        msg: 'Game not found',
      });
    }
  } catch (e) {
    res.json({
      status: 10600,
      msg: e.message,
    });
  }
};

exports.getGames = async (req, res) => {
  try {
    const conditions = getConditions(req.query);
    const options = getOptions(req.query);
    debug(1);
    const games = await getData('odds_v2', conditions, options);
    debug(2);
    const summarized_games = summarizeGames(games);
    const total = await getCount('odds_v2', conditions);
    const page_data = getPageData(req.query);
    page_data.total = total;
    res.json({
      status: 10200,
      data: {
        data: summarized_games,
        page: page_data,
      }
    });
  } catch (e) {
    res.json({
      status: 10600,
      msg: e.message,
    });
  }
};
