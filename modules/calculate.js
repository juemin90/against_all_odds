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
	const result = { '主胜': 0, '让走水': 0, '客胜': 0, '大': 0, '小': 0, '大小走水': 0 ,主进球: 0, 客进球: 0, 主客进球: 0, scores: [] };
	const { half_home_score, half_away_score, half_handicap_goal, half_goal } = half_data;
	games.forEach((game) => {
		const { final_home_score, final_away_score } = game;

		if (((final_home_score) - (half_home_score)) + half_handicap_goal > ((final_away_score) - (half_away_score))) result['主胜'] += 1;
		else if (((final_home_score) - (half_home_score)) + half_handicap_goal < ((final_away_score) - (half_away_score))) result['客胜'] += 1;
		else if (((final_home_score) - (half_home_score)) + half_handicap_goal === ((final_away_score) - (half_away_score))) result['让走水'] += 1;

		if (final_home_score + final_away_score > half_goal) result['大'] += 1;
		else if (final_home_score + final_away_score < half_goal) result['小'] += 1;
		else if (final_home_score + final_away_score === half_goal) result['大小走水'] += 1;

		if (final_home_score - half_home_score > 0) result['主进球'] += 1;
		if (final_away_score - half_away_score > 0) result['客进球'] += 1;
		if ((final_home_score + final_away_score) - (half_home_score + half_away_score) > 0) result['主客进球'] += 1;
		result.scores.push(`${final_home_score}:${final_away_score}`);
	});
	result['标本数量'] = games.length;
	result['主胜'] = `${(result['主胜'] / games.length) * 100}%`;
	result['客胜'] = `${(result['客胜'] / games.length) * 100}%`;
	result['让走水'] = `${(result['让走水'] / games.length) * 100}%`;
	result['大'] = `${(result['大'] / games.length) * 100}%`;
	result['小'] = `${(result['小'] / games.length) * 100}%`;
	result['大小走水'] = `${(result['大小走水'] / games.length) * 100}%`;
	result['主进球'] = `${(result['主进球'] / games.length) * 100}%`;
	result['客进球'] = `${(result['客进球'] / games.length) * 100}%`;
	result['主客进球'] = `${(result['主客进球'] / games.length) * 100}%`;
	return result;
};

exports.calculate = async (game) => {
	const conditions = {
		half_home_score: game.half_home_score,
		half_away_score: game.half_away_score,
		half_handicap_goal: game.half_handicap_goal,
		half_goal: game.half_goal,
	};
	try {
		const games = await getGames(conditions);
		const analyzed_data = analyzeGame(games, conditions);
		return analyzed_data;
	} catch (e) {
		debug(e.message);
	}
};

// const game = {
// 	half_home_score: 1,
// 	half_away_score: 0,
// 	half_handicap_goal: -0.5,
// 	half_goal: 2.75
// }

// exports.calculate(game);
