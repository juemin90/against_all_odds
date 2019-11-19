const debug = require('debug')('crawler:calculate');
const { getMongoClient } = require('./../libs/db_mongo');

const COLLECTION_NAME = 'odds';

const getGames = conditions => new Promise((resolve, reject) => {
	getMongoClient().then((conn) => {
		conn.collection(COLLECTION_NAME).find(conditions).toArray((err, data) => {
			if (err) reject(err);
			else resolve(data);
		});
	});
});

const analyzeGame = (games, half_data) => {
	const result = { '让胜': 0, '让走水': 0, '受让胜': 0, '大': 0, '小': 0, '大小走水': 0 };
	const { half_home_score, half_away_score, half_handicap_goal, half_goal } = half_data;
	games.forEach((game) => {
		const { final_home_score, final_away_score } = game;
		debug(final_home_score, final_away_score);

		if (((final_home_score) - (half_home_score)) + half_handicap_goal > ((final_away_score) - (half_away_score))) result['让胜'] += 1;
		else if (((final_home_score) - (half_home_score)) + half_handicap_goal < ((final_away_score) - (half_away_score))) result['受让胜'] += 1;
		else if (((final_home_score) - (half_home_score)) + half_handicap_goal === ((final_away_score) - (half_away_score))) result['让走水'] += 1;

		if (final_home_score + final_away_score > half_goal) result['大'] += 1;
		else if (final_home_score + final_away_score < half_goal) result['小'] += 1;
		else if (final_home_score + final_away_score === half_goal) result['大小走水'] += 1;
	});
	return result;
};

const start = async (conditions) => {
	debug(conditions);
	try {
		const games = await getGames(conditions);
		debug(games.length);
		const analized_data = analyzeGame(games, conditions);
		debug(analized_data);
	} catch (e) {
		debug(e.message);
	}
};

const half_data = {
	half_home_score: 0,
	half_away_score: 0,
	half_handicap_goal: 1,
	half_goal: 1.5,
};

start(half_data);
