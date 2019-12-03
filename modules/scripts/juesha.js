const debug = require('debug')('crawler:juesha');
const { getData } = require('./../../libs/utils');

const low_odd_threshold = 2.00;
const buzzer_bitter_minute = 30;

const filterGames = games => games.filter((game) => {
  const { half_goal_high_odd, half_goal, home_score, away_score } = game.odds.find(odd => odd.game_last_time === buzzer_bitter_minute);
  if ((half_goal_high_odd < low_odd_threshold) && (half_goal - home_score - away_score === 0.5)) return true;
  return false;
});

const getBuzzerbitters = (games) => {
  const result = [];
  games.forEach((game) => {
    const { half_goal_high_odd, half_goal_low_odd, half_goal, home_score, away_score } = game.odds.find(odd => odd.game_last_time === buzzer_bitter_minute);
    const { half_home_score, half_away_score } = game;
    if ((home_score + away_score) < half_home_score + half_away_score) {
      result.push({
        home_score,
        away_score,
        half_goal_high_odd,
        half_goal_low_odd,
        half_goal,
        half_home_score,
        half_away_score,
      });
    };
  });
  return result;
}

const start = async () => {
  const games = await getData('odds_v2');
  debug(games.length);
  const filtered_games = filterGames(games);
  const buzzer_bitters = getBuzzerbitters(filtered_games);
  debug(buzzer_bitters);
  debug(filtered_games.length, buzzer_bitters.length);
};

start();
