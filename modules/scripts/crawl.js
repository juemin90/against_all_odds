const moment = require('moment');
const debug = require('debug')('crawler:odds');
const { crawl } = require('./crawler_v2');

const start_date = '20191128';
const end_date = '20191129';

const getDates = (start_date, end_date) => {
	const dates = [];
	for (let i = start_date; i <= end_date; i = moment(i).add(1, 'days').format('YYYYMMDD')) {
		dates.push(i);
	}
	return dates;
};

const start = async () => {
	const dates = getDates(start_date, end_date);
	debug(dates);
	for (const date of dates) {
		await crawl(date);
	}
	debug(`${start_date} to ${end_date} done`);
};

start();
