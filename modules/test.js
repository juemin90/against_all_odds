const debug = require('debug')('crawler:calculate');
const { calculate } = require('./calculate');

const half_data = {
	half_home_score: 0,
	half_away_score: 0,
	half_handicap_goal: 0.75,
	half_goal: 2
};


const start = async () => {
	debug(await calculate(half_data));
};
start();
