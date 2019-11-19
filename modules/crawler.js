const async = require('async');
const debug = require('debug')('crawler:odds');
const cheerio = require('cheerio');
const superagent = require('superagent');
const iconv = require('iconv-lite');
const moment = require('moment');
const { Parser } = require('json2csv');
const fs = require('fs');
const { getMongoClient } = require('./../libs/db_mongo');

const COLLECTION_NAME = 'odds';
const BASE_URL = 'https://www.dszuqiu.com';
const cookie = 'Hm_lvt_a68414d98536efc52eeb879f984d8923=1573461414,1573905751; ds_session=r4h5b8qdfjbhrc7j27p0odl350; Hm_lpvt_a68414d98536efc52eeb879f984d8923=1574059831; uid=R-546490-8fd497af05dd23f4ea4027';
let counter = 1;

const field_map = {
	game_name: '赛事名称',
	date: '日期',
	time: '时间',
	home_team: '主队',
	away_team: '客队',
	half_home_score: '半场主队分数',
	half_away_score: '半场客队分数',
	final_home_score: '完场主队分数',
	final_away_score: '完场客队分数',
	first_handicap_goal: '初盘让球分数',
	first_handicap_home_odd: '初盘让球主胜',
	first_handicap_away_odd: '初盘让球客胜',
	half_handicap_goal: '半场让球',
	half_handicap_home_odd: '半场让球主胜',
	half_handicap_away_odd: '半场让球客胜',
	first_goal: '初盘大小球',
	first_goal_high_odd: '初盘大球',
	first_goal_low_odd: '初盘小球',
	half_goal: '半场大小球',
	half_goal_high_odd: '半场大球',
	half_goal_low_odd: '半场小球',
};

const waitAMinute = () => new Promise((resolve) => {
	const mili_second = (Math.random() * 5000) + 3000;
	setTimeout(() => {
		resolve();
	}, mili_second);
});

const getHtml = (url, cookie) => new Promise((resolve, reject) => {
	const header = {
		'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.97 Safari/537.36',
	};
	if (cookie) header.cookie = cookie;
	superagent.get(url).set(header).end((err, html) => {
		resolve(html.text);
	});
});

const getDates = (start_date, end_date) => {
	const dates = [];
	for (let date = start_date; date <= end_date; date = moment(date).add(1, 'days').format('YYYYMMDD')) {
		dates.push(date);
	}
	return dates;
};

const getDateAndTime = (str) => {
	const [origin_date, time] = str.split(' ');
	const [year, month, day] = origin_date.split('/');
	const date = `20${year}-${month}-${day}`;
	return [date, time];
}

const getAverage = (data) => {
	const splitted_data = data.split(',');
	return (splitted_data.map(item => parseFloat(item, 10)).reduce((a1, a2) => (a1 + a2))) / splitted_data.length;
};

const parseHtml = ($) => {
	const games = $('tbody tr');
	const result = [];
	const game_infos = games.map((index, game) => {
		const item = {};
		const tds = $(game).find('td');
		tds.each((index, td) => {
			const a = $(td).find('a');
			const field_value = a.length ? $(a).text() : $(td).text();
			if (index === 0) item.game_name = field_value.trim();
			if (index === 2) [item.date, item.time] = getDateAndTime(field_value.trim());
			if (index === 4) [item.final_home_score, item.final_away_score] = field_value.replace(/\s/g, '').split(':').map(item => Number(item));
			if (index === 6) [item.half_home_score, item.half_away_score] = field_value.replace(/\s/g, '').split(':').map(item => Number(item));
			if (index === 11) item.game_id = $(a).attr('href').split('/')[2];
		});
		result.push(item);
	});
	return result;
}

const getData = async (date) => {
	const url = `${BASE_URL}/diary/${date}`;
	const html = await getHtml(url);
	await waitAMinute();
	const $ = cheerio.load(html);
	let result = parseHtml($);

	const page_num = $('#pager ul li').length;
	debug(page_num);
	const pages = Array.from(Array(page_num - 2).keys()).map(item => item + 2);
	for (const page of pages) {
		const page_url = `${BASE_URL}/diary/${date}/p.${page}`
		const page_html = await getHtml(page_url);
		const page_$ = cheerio.load(page_html);
		const page_result = parseHtml(page_$);
		result = [...result, ...page_result];
		debug('page', page, page_result.length)
		await waitAMinute();
	}
	return result;
};

const getInfo = async (game_id) => {
	const url = `${BASE_URL}/race_sp/${game_id}`;
	const html = await getHtml(url, cookie);
	const $ = cheerio.load(html);

	// 赛事信息抓取
	const teams = $('.analysisTeamName a');
	const home_team = $(teams[0]).text();
	const away_team = $(teams[1]).text();

	// 让球赔率抓取
	const team_cast_trs = $($('.wincast table')[0]).find('tr');
	const team_cast_odds = [];
	team_cast_trs.each((index, team_cast_tr) => {
		const tds = $(team_cast_tr).find('td');
		const item = {};
		tds.each((index, td) => {
			const field_value = $(td).text();
			if (index === 0) item.game_last_time = parseFloat(field_value.replace('\'', ''), 10);
			if (index === 2) item.handicap_home_odd = parseFloat(field_value, 10);
			if (index === 3) item.handicap_goal = getAverage(field_value);
			if (index === 4) item.handicap_away_odd = parseFloat(field_value, 10);
		});
		team_cast_odds.push(item);
	});
	const { handicap_home_odd: first_handicap_home_odd, handicap_away_odd: first_handicap_away_odd, handicap_goal: first_handicap_goal } = team_cast_odds[team_cast_odds.length - 1];

	const filtered_team_cast_odds = team_cast_odds.filter(cast_odd => cast_odd.game_last_time > 45);
	const { handicap_home_odd: half_handicap_home_odd, handicap_away_odd: half_handicap_away_odd, handicap_goal: half_handicap_goal } = filtered_team_cast_odds[filtered_team_cast_odds.length - 1] || {};

	// 大小球赔率抓取
	const goals_trs = $($('.daxiao table')[0]).find('tr');
	const goal_odds = [];
	goals_trs.each((index, goals_tr) => {
		const tds = $(goals_tr).find('td');
		const item = {};
		tds.each((index, td) => {
			const field_value = $(td).text();
			if (index === 0) item.game_last_time = parseFloat(field_value.replace('\'', ''), 10);
			if (index === 2) item.goal_high_odd = parseFloat(field_value, 10);
			if (index === 3) item.goal = getAverage(field_value);
			if (index === 4) item.goal_low_odd = parseFloat(field_value, 10);
		});
		goal_odds.push(item);
	});
	const { goal_high_odd: first_goal_high_odd, goal_low_odd: first_goal_low_odd, goal: first_goal } = goal_odds[goal_odds.length - 1];

	const filtered_goal_odds = goal_odds.filter(goal_odd => goal_odd.game_last_time > 45);
	const { goal_high_odd: half_goal_high_odd, goal_low_odd: half_goal_low_odd, goal: half_goal } = filtered_goal_odds[filtered_goal_odds.length - 1] || {};

	return {
		home_team,
		away_team,
		first_handicap_home_odd,
		first_handicap_away_odd,
		first_handicap_goal,
		half_handicap_home_odd,
		half_handicap_away_odd,
		half_handicap_goal,
		first_goal_high_odd,
		first_goal_low_odd,
		first_goal,
		half_goal_high_odd,
		half_goal_low_odd,
		half_goal,
	};
};

const deleteMongo = date => new Promise((resolve, reject) => {
	const formatted_data = moment(date).format('YYYY-MM-DD');
	getMongoClient().then((conn) => {
		conn.collection(COLLECTION_NAME).deleteMany({ date }, (err) => {
			debug('test');
			if (err) {
				console.log(err);
				reject(err);
			}
			else resolve();
		});
	});
});

const insertMongo = data => new Promise((resolve, reject) => {
	if (!data.length) {
		resolve();
		return;
	}
	getMongoClient().then((conn) => {
		conn.collection(COLLECTION_NAME).insertMany(data, (err) => {
			debug('test');
			if (err) {
				console.log(err);
				reject(err);
			}
			else resolve();
		});
	});
});

const getCsvData = (data) => {
	const fields = Object.values(field_map);
	const opts = { fields };
	const parser = new Parser(opts);
	const translated_obj = data.map(item => {
		const new_item = {};
		Object.keys(field_map).forEach((field) => {
			new_item[field_map[field]] = item[field];
		});
		return new_item;
	});
	const csv = parser.parse(translated_obj);
	const decoded_csv = Buffer.concat([new Buffer('\xEF\xBB\xBF','binary'),new Buffer(csv)]);
	return decoded_csv;
};

const filterData = data => data.filter(item => Math.abs(item.half_handicap_goal) >= 0.5);

const getInfos = data => new Promise((resolve, reject) => {
	async.eachLimit(data, 1, (item, next) => {
		getInfo(item.game_id).then((info) => {
			Object.assign(item, info);
			waitAMinute().then(() => {
				debug(`game id: ${item.game_id}, ${counter++} / ${data.length}`);
				next(null);
			});
		});
	}, (err) => {
		if (err) reject(err);
		else resolve(data);
	});
});

const saveCsv = (csv_data, date) => {
	const file_name = `./cache_data/${date}.csv`;
	fs.writeFileSync(file_name, csv_data);
}

const start = async () => {
	const date = process.env.date || moment().subtract(1, 'days').format('YYYYMMDD');
	debug(`${date} start`);
	const data = (await getData(date)); // .slice(85, 90);
	debug(data.length);
	await waitAMinute();
	const got_info_data = await getInfos(data);
	const filtered_data = filterData(got_info_data);
	await deleteMongo(date);
	await insertMongo(filtered_data);
	const csv_data = getCsvData(filtered_data);
	await saveCsv(csv_data, date);
	debug(`${date} ok`);
}

start();
