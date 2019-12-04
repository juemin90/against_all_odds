const async = require('async');
const debug = require('debug')('odds:odds');
const cheerio = require('cheerio');
const superagent = require('superagent');
const iconv = require('iconv-lite');
const moment = require('moment');
const { Parser } = require('json2csv');
const fs = require('fs');
const { getMongoClient } = require('./../../libs/db_mongo');
const { getGameLastTime, waitAMinute, getHtml, getDates, getDateAndTime, getAverage, getCookie } = require('./../../libs/utils');

const cookie = getCookie();

const COLLECTION_NAME = 'odds_v2';
const BASE_URL = 'https://www.dszuqiu.com';
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
	try {
		const html = await getHtml(url, cookie);
		const $ = cheerio.load(html);

		// 赛事信息抓取
		const teams = $('.analysisTeamName a');
		const home_team = $(teams[0]).text();
		const away_team = $(teams[1]).text();

		// 让球赔率抓取
		const full_handicap_trs = $($('.wincast table')[0]).find('tr');
		const half_handicap_trs = $($('.wincast table')[1]).find('tr');

		const full_handicap_odds = [];
		const half_handicap_odds = [];

		let crossbar_flag = false;
		for (let index = full_handicap_trs.length - 1; index >= 0; index -= 1) {
		// full_handicap_trs.each((index, full_handicap_tr) => {
			const tds = $(full_handicap_trs[index]).find('td');
			const item = {};
			tds.each((index, td) => {
				const field_value = $(td).text();
				if (index === 0) item.game_last_time = getGameLastTime(field_value);
				if (index === 1) [item.home_score, item.away_score] = field_value === '-' ? [0,0] : field_value.split(':').map(num => parseInt(num, 10));
				if (index === 2) item.handicap_home_odd = parseFloat(field_value, 10) || 0;
				if (index === 3) item.handicap_goal = getAverage(field_value) || 0;
				if (index === 4) item.handicap_away_odd = parseFloat(field_value, 10) || 0;
				if (item.game_last_time !== 0) crossbar_flag = true;
			});
			if (item.game_last_time !== 0 || (item.game_last_time === 0 && !crossbar_flag)) full_handicap_odds.push(item);
		};
		full_handicap_odds.reverse();

		crossbar_flag = false;
		for (let index = half_handicap_trs.length - 1; index >= 0; index -= 1) {
			const tds = $(half_handicap_trs[index]).find('td');
			const item = {};
			tds.each((index, td) => {
				const field_value = $(td).text();
				if (index === 0) item.game_last_time = getGameLastTime(field_value);
				if (index === 1) [item.home_score, item.away_score] = field_value === '-' ? [0,0] : field_value.split(':').map(num => parseInt(num, 10));
				if (index === 2) item.handicap_home_odd = parseFloat(field_value, 10) || 0;
				if (index === 3) item.handicap_goal = getAverage(field_value) || 0;
				if (index === 4) item.handicap_away_odd = parseFloat(field_value, 10) || 0;
				if (crossbar_flag === false && item.game_last_time !== 0) crossbar_flag = true;
			});
			if (item.game_last_time !== 0 || (item.game_last_time === 0 && !crossbar_flag)) half_handicap_odds.push(item);
		};
		half_handicap_odds.reverse();

		const full_goals_trs = $($('.daxiao table')[0]).find('tr');
		const half_goals_trs = $($('.daxiao table')[1]).find('tr');

		const full_goals_odds = [];
		const half_goals_odds = [];

		crossbar_flag = false;
		for (let index = full_goals_trs.length - 1; index >= 0; index -= 1) {
			const tds = $(full_goals_trs[index]).find('td');
			const item = {};
			tds.each((index, td) => {
				const field_value = $(td).text();
				if (index === 0) item.game_last_time = getGameLastTime(field_value);
				if (index === 1) [item.home_score, item.away_score] = field_value === '-' ? [0,0] : field_value.split(':').map(num => parseInt(num, 10));
				if (index === 2) item.goal_high_odd = parseFloat(field_value, 10) || 0;
				if (index === 3) item.goal = getAverage(field_value) || 0;
				if (index === 4) item.goal_low_odd = parseFloat(field_value, 10) || 0;
				if (item.game_last_time !== 0) crossbar_flag = true;
			});
			if (item.game_last_time !== 0 || (item.game_last_time === 0 && !crossbar_flag)) full_goals_odds.push(item);
		};
		full_goals_odds.reverse();

		crossbar_flag = false;
		for (let index = full_goals_trs.length - 1; index >= 0; index -= 1) {
			const tds = $(half_goals_trs[index]).find('td');
			const item = {};
			tds.each((index, td) => {
				const field_value = $(td).text();
				if (index === 0) item.game_last_time = getGameLastTime(field_value);
				if (index === 1) [item.home_score, item.away_score] = field_value === '-' ? [0,0] : field_value.split(':').map(num => parseInt(num, 10));
				if (index === 2) item.goal_high_odd = parseFloat(field_value, 10) || 0;
				if (index === 3) item.goal = getAverage(field_value) || 0;
				if (index === 4) item.goal_low_odd = parseFloat(field_value, 10) || 0;
				if (item.game_last_time !== 0) crossbar_flag = true;
			});
			if (item.game_last_time !== 0 || (item.game_last_time === 0 && !crossbar_flag)) half_goals_odds.push(item);
		};
		half_goals_odds.reverse();

		const odds = [];

		const first_half_minutes = Array.from(Array(46).keys());
		const second_half_minutes = Array.from(Array(45).keys()).map(item => item + 46);
		first_half_minutes.forEach((minute) => {
			const item = { game_last_time: minute };

			const { handicap_goal: half_handicap_goal, handicap_home_odd: half_handicap_home_odd, handicap_away_odd: half_handicap_away_odd } = (half_handicap_odds.filter(odd => odd.game_last_time <= minute))[0] || { handicap_goal: 0, handicap_home_odd: 0, handicap_away_odd: 0 };
			const { goal: half_goal, goal_high_odd: half_goal_high_odd, goal_low_odd: half_goal_low_odd } = (half_goals_odds.filter(odd => odd.game_last_time <= minute))[0] || { goal: 0, goal_high_odd: 0, goal_low_odd: 0 };

			const { home_score, away_score, handicap_goal: full_handicap_goal, handicap_home_odd: full_handicap_home_odd, handicap_away_odd: full_handicap_away_odd } = (full_handicap_odds.filter(odd => odd.game_last_time <= minute))[0] || { home_score: 0, away_score: 0, handicap_goal: 0, handicap_home_odd: 0, handicap_away_odd: 0 };
			const { goal: full_goal, goal_high_odd: full_goal_high_odd, goal_low_odd: full_goal_low_odd } = (full_goals_odds.filter(odd => odd.game_last_time <= minute))[0] || { goal: 0, goal_high_odd: 0, goal_low_odd: 0 };
			Object.assign(item, { home_score, away_score, half_handicap_goal, half_handicap_home_odd, half_handicap_away_odd, half_goal, half_goal_high_odd, half_goal_low_odd, full_handicap_goal, full_handicap_home_odd, full_handicap_away_odd, full_goal, full_goal_high_odd, full_goal_low_odd });
			odds.push(item);
		});

		const half_time_item = { game_last_time: '半', half_handicap_goal: 0, half_handicap_home_odd: 0, half_handicap_away_odd: 0, half_goal: 0, half_goal_high_odd: 0, half_goal_low_odd: 0 };
		const half_time_full_handicap_odds = full_handicap_odds.filter(odd => odd.game_last_time === '半');
		if (half_time_full_handicap_odds.length) {
			const { home_score, away_score, handicap_goal: full_handicap_goal, handicap_home_odd: full_handicap_home_odd, handicap_away_odd: full_handicap_away_odd } = (half_time_full_handicap_odds[0]) || { home_score: 0, away_score: 0, handicap_goal: 0, handicap_home_odd: 0, handicap_away_odd: 0 };
			Object.assign(half_time_item, { home_score, away_score, full_handicap_goal, full_handicap_home_odd, full_handicap_away_odd});
		} else {
			const second_half_data = full_handicap_odds.filter(odd => odd.game_last_time <= 45);
			const { home_score, away_score, handicap_goal: full_handicap_goal, handicap_home_odd: full_handicap_home_odd, handicap_away_odd: full_handicap_away_odd } = (second_half_data)[0] || { home_score: 0, away_score: 0, handicap_goal: 0, handicap_home_odd: 0, handicap_away_odd: 0 };
			Object.assign(half_time_item, { home_score, away_score, full_handicap_goal, full_handicap_home_odd, full_handicap_away_odd});
		}
		const half_time_full_goals_odds = full_goals_odds.filter(odd => odd.game_last_time === '半');
		if (half_time_full_goals_odds.length) {
			const { goal: full_goal, goal_high_odd: full_goal_high_odd, goal_low_odd: full_goal_low_odd } = (half_time_full_goals_odds)[0] || { goal: 0, goal_high_odd: 0, goal_low_odd: 0 };
			Object.assign(half_time_item, { full_goal, full_goal_high_odd, full_goal_low_odd});
		} else {
			const second_half_data = full_goals_odds.filter(odd => odd.game_last_time <= 45);
			const { goal: full_goal, goal_high_odd: full_goal_high_odd, goal_low_odd: full_goal_low_odd } = (second_half_data)[0] || { goal: 0, goal_high_odd: 0, goal_low_odd: 0 };
			Object.assign(half_time_item, { full_goal, full_goal_high_odd, full_goal_low_odd});
		}
		odds.push(half_time_item);

		second_half_minutes.forEach((minute) => {
			const item = { game_last_time: minute };

			const { handicap_goal: half_handicap_goal, handicap_home_odd: half_handicap_home_odd, handicap_away_odd: half_handicap_away_odd } = (half_handicap_odds.filter(odd => odd.game_last_time <= minute))[0] || { handicap_goal: 0, handicap_home_odd: 0, handicap_away_odd: 0 };
			const { goal: half_goal, goal_high_odd: half_goal_high_odd, goal_low_odd: half_goal_low_odd } = (half_goals_odds.filter(odd => odd.game_last_time <= minute))[0] || { goal: 0, goal_high_odd: 0, goal_low_odd: 0 };

			const { home_score, away_score, handicap_goal: full_handicap_goal, handicap_home_odd: full_handicap_home_odd, handicap_away_odd: full_handicap_away_odd } = (full_handicap_odds.filter(odd => odd.game_last_time <= minute))[0] || { home_score: 0, away_score: 0, handicap_goal: 0, handicap_home_odd: 0, handicap_away_odd: 0 };
			const { goal: full_goal, goal_high_odd: full_goal_high_odd, goal_low_odd: full_goal_low_odd } = (full_goals_odds.filter(odd => odd.game_last_time <= minute))[0] || { goal: 0, goal_high_odd: 0, goal_low_odd: 0 };
			Object.assign(item, { home_score, away_score, half_handicap_goal, half_handicap_home_odd, half_handicap_away_odd, half_goal, half_goal_high_odd, half_goal_low_odd, full_handicap_goal, full_handicap_home_odd, full_handicap_away_odd, full_goal, full_goal_high_odd, full_goal_low_odd });
			odds.push(item);
		});

		const goal_events = [];
		odds.forEach((odd, index) => {
			if (index === 0) return;
			if (odds[index].home_score - odds[index - 1].home_score > 0) {
				const event = {}
				event.score_team = '主';
				Object.assign(event, odd);
				goal_events.push(event);
			}
			if (odds[index].away_score - odds[index - 1].away_score > 0) {
				const event = {}
				event.score_team = '客';
				Object.assign(event, odd);
				goal_events.push(event);
			}
		});

		return {
			home_team,
			away_team,
			odds,
			goal_events,
		};
	} catch (e) {
		throw new Error(e);
	}
};

const deleteMongo = date => new Promise((resolve, reject) => {
	const formatted_data = moment(date).format('YYYY-MM-DD');
	getMongoClient().then((conn) => {
		conn.collection(COLLECTION_NAME).deleteMany({ date: formatted_data }, (err) => {
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

const filterData = data => data.filter(item => Math.abs(item.half_handicap_goal) >= 0.5);

const getInfos = data => new Promise((resolve, reject) => {
	async.eachLimit(data, 1, (item, next) => {
		getInfo(item.game_id).then((info) => {
			Object.assign(item, info);
			waitAMinute(500).then(() => {
				debug(`game id: ${item.game_id}, ${counter++} / ${data.length}`);
				next(null);
			});
		});
	}, (err) => {
		if (err) reject(err);
		else {
			counter = 1;
			resolve(data);
		}
	});
});

exports.crawl = async (d) => {
	try {
		const date = d || process.env.date || moment().subtract(1, 'days').format('YYYYMMDD');
		debug(`${date} start`);
		const data = (await getData(date)) // .slice(0, 1);
		debug(data.length);
		await waitAMinute();
		const got_info_data = await getInfos(data);
		// debug(got_info_data);
		const filtered_data = filterData(got_info_data);
		await deleteMongo(date);
		await insertMongo(got_info_data);
		debug(`${date} ok`);
	} catch (e) {
		debug('continue', e);
	}
}
