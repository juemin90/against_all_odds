const debug = require('debug')('odds:half_predict');
const { getData, getCurrentGames, toFixedNumber } = require('./../../libs/utils');

const getConditions = (current_game) => {
  const { half_home_score, half_away_score, half_handicap_goal, half_goal } = current_game;
  return { half_home_score, half_away_score, half_handicap_goal, half_goal };
};

const getPredictResult = (similar_games) => {
  const result = {
    home_win: 0,
    away_win: 0,
    high_goal: 0,
    low_goal: 0,
    home_scores: 0,
    away_scores: 0,
    sample_number: similar_games.length,
  };
  similar_games.forEach((similar_game) => {
    const { half_home_score, half_away_score, final_home_score, final_away_score, half_handicap_goal, half_goal } = similar_game;
    if (((final_home_score - half_home_score) + half_handicap_goal) > (final_away_score - half_away_score)) result.home_win += 1;
    if (((final_home_score - half_home_score) + half_handicap_goal) < (final_away_score - half_away_score)) result.away_win += 1;
    if (final_home_score + final_away_score > half_goal) result.high_goal += 1;
    if (final_home_score + final_away_score < half_goal) result.low_goal += 1;
    if (final_home_score - half_home_score > 0) result.home_scores += 1;
    if (final_away_score - half_away_score > 0) result.away_scores += 1;
  });
  result.home_win = toFixedNumber(result.home_win / result.sample_number);
  result.away_win = toFixedNumber(result.away_win / result.sample_number);
  result.high_goal = toFixedNumber(result.high_goal / result.sample_number);
  result.low_goal = toFixedNumber(result.low_goal / result.sample_number);
  result.home_scores = toFixedNumber(result.home_scores / result.sample_number);
  result.away_scores = toFixedNumber(result.away_scores / result.sample_number);

  return result;
};

const filterGames = games => games.filter(game => (game.game_last_time === '半' || (game.game_last_time >=43 && game.game_last_time <= 47)));

const predictGames = async (current_games) => {
  for (current_game of current_games) {
    const conditions = getConditions(current_game);
    debug(conditions);
    const similar_games = await getData('odds', conditions);
    const predict_result = getPredictResult(similar_games);
    Object.assign(current_game, predict_result);
  }
  return current_games.filter(game => game.sample_number > 0).sort((a1, a2) => a2.sample_number - a1.sample_number);
};

exports.get = async (req, res) => {
  try {
    const current_games = await getCurrentGames();
    const filtered_games = filterGames(current_games);
    const predicted_games = await predictGames(filtered_games);
    res.json({
      status: 10200,
      data: predicted_games,
    });
  } catch (e) {
    res.json({
      status: 10600,
      msg: e.message,
    });
  }

};
