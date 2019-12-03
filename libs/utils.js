const superagent = require('superagent');
const debug = require('debug')('odds:utils');
const { getMongoClient } = require('./../libs/db_mongo');

exports.waitAMinute = () => new Promise((resolve) => {
	const mili_second = (Math.random() * 5000) + 3000;
	setTimeout(() => {
		resolve();
	}, mili_second);
});

const header = {
	'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.97 Safari/537.36',
};

exports.getHtml = (url, cookie) => new Promise((resolve, reject) => {
	if (cookie) header.cookie = cookie;
	superagent.get(url).set(header).end((err, html) => {
		if (!html) reject(html);
		else resolve(html.text);
	});
});

exports.getDates = (start_date, end_date) => {
	const dates = [];
	for (let date = start_date; date <= end_date; date = moment(date).add(1, 'days').format('YYYYMMDD')) {
		dates.push(date);
	}
	return dates;
};

exports.getDateAndTime = (str) => {
	const [origin_date, time] = str.split(' ');
	const [year, month, day] = origin_date.split('/');
	const date = `${year.length === 4 ? `${year}` : `20${year}`}-${month}-${day}`;
	return [date, time];
}

exports.getAverage = (data) => {
	const splitted_data = data.split(',');
	return (splitted_data.map(item => parseFloat(item, 10)).reduce((a1, a2) => (a1 + a2))) / splitted_data.length;
};

exports.getCookie = () => 'Hm_lvt_a68414d98536efc52eeb879f984d8923=1573461414,1573905751; ds_session=r4h5b8qdfjbhrc7j27p0odl350; Hm_lpvt_a68414d98536efc52eeb879f984d8923=1574059831; uid=R-546490-8fd497af05dd23f4ea4027';


exports.getGameLastTime = (str) => {
	let result = '';
	if (str === '半') result = str;
	else if (str === '-') result = 0;
	else result = parseInt(str, 10);
	return result;
};

exports.getPeriod = (str) => {
	let result = '';
	if (str === '半' || str === '未') result = str;
	else if (str === '-' || parseInt(str, 10) < 25) result = 1;
	else if (parseInt(str, 10) < 45) result = 2;
	else if (parseInt(str, 10) < 75) result = 3;
	else if (parseInt(str, 10) < 90) result = 4;

	return result;
};

exports.getData = (collection_name, conditions, options) => new Promise((resolve, reject) => {
	getMongoClient().then((conn) => {
		conn.collection(collection_name).find(conditions, options).toArray((err, data) => {
			if (err) reject(err);
			else resolve(data);
		});
	});
});

exports.getCount = (collection_name, conditions) => new Promise((resolve, reject) => {
	getMongoClient().then((conn) => {
		conn.collection(collection_name).countDocuments(conditions, (err, count) => {
			if (err) reject(err);
			else resolve(count);
		});
	});
});

const parseCurrentGame = data => data.rs.filter(item => item.f_ld && item.rd).map(item => ({
    game_name: item.league.fn,
    game_last_time: item.status,
    home_team: item.host.sbn,
    half_home_score: parseInt(item.rd.hg, 10),
    half_away_score: parseInt(item.rd.gg, 10),
    away_team: item.guest.sbn,
    game_id: item.id,
    half_handicap_home_odd: parseFloat(item.f_ld.hrfsp, 10),
    half_handicap_goal: parseFloat(item.f_ld.hrf, 10),
    half_handicap_away_odd: parseFloat(item.f_ld.grfsp, 10),
    half_goal_high_odd: parseFloat(item.f_ld.hdxsp, 10),
    half_goal: parseFloat(item.f_ld.hdx, 10),
    half_goal_low_odd: parseFloat(item.f_ld.gdxsp, 10),
}));

exports.getCurrentGames = () => new Promise((resolve, reject) => {
	const url = 'https://live.dszuqiu.com/ajax/score/data?mt=0';
	superagent.get(url).set(header).end((err, res) => {
    resolve(parseCurrentGame(res.body));
	});
});

exports.toFixedNumber = (num, digit = 6) => parseFloat(num.toFixed(6), 10);
