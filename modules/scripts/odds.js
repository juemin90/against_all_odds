const cheerio = require('cheerio');
const superagent = require('superagent');
const moment = require('moment');
const debug = require('debug')('crawler:odds');

const BASE_URL = 'https://www.dszuqiu.com';

const getHtml = url => new Promise((resolve, reject) => {
	superagent.get(url).end((err, html) => {
		resolve(html.text);
	});
});

const getGameIds = async (date) => {
	const url = `${BASE_URL}/diary/${date}`;
	const html = await getHtml(url);
	const $ = cheerio.load(html);
	const game_ids = [];
	const games = $('tbody tr');
	games.each((game) => {
		const link_td = $(game).find('td').eq(11);
		debug(link_td);
		const id = $(link_td).find('a').attr('href').split('/')[2];
		game_ids.push(id);
	});
	return game_ids;
};

const start = async() => {
	const { date } = process.env || moment().subtract(1, 'days').format('YYYYMMDD');
	const game_ids = await getGameIds(date);
	debug(game_ids);
	// const game_odds = await getGameOdds(games);
	// const csv_data = getCsvData(game_odds);
	// saveData(csv_data);
};

start();
