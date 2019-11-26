const superagent = require('superagent');
const debug = require('debug')('crawler:utils');

exports.waitAMinute = () => new Promise((resolve) => {
	const mili_second = (Math.random() * 5000) + 3000;
	setTimeout(() => {
		resolve();
	}, mili_second);
});

exports.getHtml = (url, cookie) => new Promise((resolve, reject) => {
	const header = {
		'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.97 Safari/537.36',
	};
	if (cookie) header.cookie = cookie;
	superagent.get(url).set(header).end((err, html) => {
		resolve(html.text);
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
