const debug = require('debug')('crawler:predict');
const cheerio = require('cheerio');
const { waitAMinute, getHtml, getDates, getDateAndTime, getAverage, getCookie } = require('./../libs/utils');
const { calculate } = require('./calculate');

const BASE_URL = 'https://www.dszuqiu.com';
const cookie = getCookie();
const fields = ['主胜', '让走水', '客胜', '大', '小', '大小走水'];
// , '主进球', '客进球', '主客进球'];

const getGames = async () => {
	const result = [];
	const html = await getHtml(BASE_URL);
	const $ = cheerio.load(html);
	const trs = $('.indexV6LiveTable tbody tr');

	const game_length = trs.length / 2;
	for (let i = 0; i < game_length; i++) {
		const item = {};
		const game_info = trs[2 * i];
		item.game_name = $(game_info).find('.liveTable2LeagueTrName').text();
		[item.date, item.time] = getDateAndTime($(game_info).find('.liveTable2LeagueTrTime').text());

		const game_stat = trs[(2 * i) + 1];
		const game_stat_tds = $(game_stat).find('td');
		item.game_last_time = $($(game_stat_tds[0]).find('span')).text().replace('\'', '');
		item.home_team = $($(game_stat_tds[1]).find('a')).text();
		[item.half_home_score, item.half_away_score] = $($(game_stat_tds[2]).find('span')).text().split(':').map(num => Number(num));
		item.away_team = $($(game_stat_tds[3]).find('a')).text();
		item.game_id = $($(game_stat_tds[8]).find('a')).attr('href').split('/')[2];;
		result.push(item);
	}
	return result.filter(item => (Number(item.game_last_time) <= 60 && Number(item.game_last_time) >= 43) || item.game_last_time === '半');
};

const getGameDetail = async (game) => {
	const { game_id } = game;
	const url = `${BASE_URL}/race_sp/${game_id}`;
	const html = await getHtml(url, cookie);
	const $ = cheerio.load(html);

	const team_cast_trs = $('.wincast table tbody tr');
	const team_cast_tr = team_cast_trs[0];
	const handicap_tds = $(team_cast_tr).find('td');
	handicap_tds.each((index, td) => {
		const field_value = $(td).text();
		if (index === 2) game.half_handicap_home_odd = parseFloat(field_value, 10);
		if (index === 3) game.half_handicap_goal = getAverage(field_value);
		if (index === 4) game.half_handicap_away_odd = parseFloat(field_value, 10);
	});

	const goals_tr = $($('.daxiao table')[0]).find('tbody tr')[0];
	const goals_tds = $(goals_tr).find('td');
	goals_tds.each((index, td) => {
		const field_value = $(td).text();
		if (index === 2) game.half_goal_high_odd = parseFloat(field_value, 10);
		if (index === 3) game.half_goal = getAverage(field_value);
		if (index === 4) game.half_goal_low_odd = parseFloat(field_value, 10);
	});

	return game;
};

const getFullData = async (selected_games) => {
	for (const selected_game of selected_games) {
		const game_detail = await getGameDetail(selected_game);
		debug(`got ${selected_game.game_id}`);
		await waitAMinute();
	}
	return selected_games
};

const getBestOdd = (game) => {
	let best_odd_item = { field: '', odd: 0 };
	fields.forEach((field) => {
		if (parseInt(game[field], 10) > best_odd_item.odd) {
			best_odd_item.field = field;
			best_odd_item.odd = parseInt(game[field], 10);
		}
	});
	return best_odd_item;
}

const getString = (games) => games.map(game => {
	const game_info = `${game.home_team}对阵${game.away_team}`;
	const half_score = `半场比分${game.half_home_score}:${game.half_away_score}`;
	const item_str = `标本数量为${game['标本数量']}个`;
	const fields_str = fields.map(field => `${field}概率${game[field]}`).join('，');
	const best_odd = getBestOdd(game);
	const best_odd_str = `最佳投注方式为：${best_odd.field}, 概率为：${best_odd.odd}%`;
	return `${game_info}。 ${half_score}。 ${item_str}。${fields_str}, ${best_odd_str}`;
});

const predictData = async (games) => {
	for (const game of games) {
		const calculated_data = await calculate(game);
		Object.assign(game, calculated_data);
	}
	debug(getString(games));
	return getString(games);
}

const start = async () => {
	const selected_games = await getGames();
	await waitAMinute();
	debug(`got ${selected_games.length} games`);
	const full_data = await getFullData(selected_games);
	const filtered_data = full_data.filter(game => Math.abs(game.half_handicap_goal) >= 0.5);
	const predicted_data = await predictData(filtered_data);
	debug(full_data);
};

const game = [{
	game_name: '罗马尼亚Liga II',
	date: '2019-11-20',
	time: '20:02',
	game_last_time: '55',
	home_team: '布加勒斯特快速',
	half_home_score: 20,
	half_away_score: 0,
	away_team: 'UTA阿拉德',
	game_id: '698222',
	half_handicap_home_odd: 1.975,
	half_handicap_goal: -0.5,
	half_handicap_away_odd: 1.825,
	half_goal_high_odd: 1.75,
	half_goal: 2,
	half_goal_low_odd: 2.05 }
];

predictData(game);
// start();
