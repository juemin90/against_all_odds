const { getMongoClient } = require('./../../libs/db_mongo');
const debug = require('debug')('crawler:test');

const threshold = 0.75;

const COLLECTION_NAME = 'odds';

const getGames = () => new Promise((resolve, reject) => {
	getMongoClient().then((conn) => {
		conn.collection(COLLECTION_NAME).find().toArray((err, data) => {
			if (err) reject(err);
			else resolve(data);
		});
	});
});

const predictGame = (games) => {
	predict_result_item = { '胜负对': 0, '胜负错': 0, '大小对': 0, '大小错': 0 };
	let valid_game_num = 0;
	games.forEach((game, index) => {
		if (Math.abs(game.half_handicap_goal) < 0.5) return;
		const filtered_games = games.filter(g => g.half_home_score === game.half_home_score && g.half_away_score === game.half_away_score && g.half_goal === game.half_goal && g.half_handicap_goal === game.half_handicap_goal);
		if (filtered_games.length < 5) return;
		valid_game_num += 1;
		const item = { '主胜': 0, '客胜': 0, '大球': 0, '小球': 0 };
		filtered_games.forEach((filtered_game) => {
			if ((filtered_game.final_home_score - filtered_game.half_home_score + filtered_game.half_handicap_goal) > (filtered_game.final_away_score - filtered_game.half_away_score)) item['主胜'] += 1;
			if ((filtered_game.final_home_score - filtered_game.half_home_score + filtered_game.half_handicap_goal) < (filtered_game.final_away_score - filtered_game.half_away_score)) item['客胜'] += 1;
			if ((filtered_game.final_home_score + filtered_game.final_away_score) > filtered_game.half_goal) item['大球'] += 1;
			if ((filtered_game.final_home_score + filtered_game.final_away_score) < filtered_game.half_goal) item['小球'] += 1;
		});
		if (item['主胜'] / filtered_games.length > threshold && ((game.final_home_score - game.half_home_score + game.half_handicap_goal) > (game.final_away_score - game.half_away_score))) predict_result_item['胜负对'] += 1;
		if (item['主胜'] / filtered_games.length > threshold && ((game.final_home_score - game.half_home_score + game.half_handicap_goal) < (game.final_away_score - game.half_away_score))) predict_result_item['胜负错'] += 1;
		if (item['客胜'] / filtered_games.length > threshold && ((game.final_home_score - game.half_home_score + game.half_handicap_goal) < (game.final_away_score - game.half_away_score))) predict_result_item['胜负对'] += 1;
		if (item['客胜'] / filtered_games.length > threshold && ((game.final_home_score - game.half_home_score + game.half_handicap_goal) > (game.final_away_score - game.half_away_score))) predict_result_item['胜负错'] += 1;
		if (item['大球'] / filtered_games.length > threshold && (game.final_home_score + game.final_home_score > game.half_goal)) predict_result_item['大小对'] += 1;
		if (item['大球'] / filtered_games.length > threshold && (game.final_home_score + game.final_home_score < game.half_goal)) predict_result_item['大小错'] += 1;
		if (item['小球'] / filtered_games.length > threshold && (game.final_home_score + game.final_home_score < game.half_goal)) predict_result_item['大小对'] += 1;
		if (item['小球'] / filtered_games.length > threshold && (game.final_home_score + game.final_home_score > game.half_goal)) predict_result_item['大小错'] += 1;
		debug(index);
	});
	return predict_result_item;
};

const test = async () => {
	debug('start');
	const games = await getGames();
	debug(games[0]);
	debug(games.length);
	const predict_result = predictGame(games);
	debug(predict_result);
};

test();
