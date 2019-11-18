const { getMongoClient } = require('./../libs/db_mongo');
const debug = require('debug')('odds:odds');
const fs = require('fs');
const axios = require('axios');
const moment = require('moment');

const COLLECTION_NAME = 'sports';
const API_KEY = '1196c5af5cf134b1649999c3706087cc';
const BASE_URL = 'https://api.the-odds-api.com/v3/sports';

// basic auth, 500 requests per month

const getInSeasonSports = () => new Promise((resolve, reject) => {
	const url = `${BASE_URL}?apiKey=${API_KEY}`;
	debug(url);
	axios.get(url).then((response) => {
		resolve(response);
	}).catch((e) => {
		reject(e);
	});
});

const getData = () => new Promise((resolve, reject) => {
	debug(COLLECTION_NAME);
	getMongoClient().then((db) => {
		db.collection(COLLECTION_NAME).find({}).toArray((err, data) => {
			if (err) reject(err);
			else resolve(data);
		});
	});
});

const removeData = date => new Promise((resolve, reject) => {
	const conditions = { date };
	getMongoClient().then((db) => {
		db.collection(COLLECTION_NAME).deleteMany(conditions, (err) => {
			if (err) reject(err);
			else resolve();
		});
	});
});

const insertData = data => new Promise((resolve, reject) => {
	getMongoClient().then((db) => {
		db.collection(COLLECTION_NAME).insertMany(data, (err) => {
			if (err) reject(err);
			else resolve();
		});
	});
});

const start = async (date) => {
	// try {
	// 	const { data } = (await getInSeasonSports()).data;
	// } catch (e) {
	// 	debug(`error message is "${e}"`);
	// }
	// const data = [{ a: 'b' }];
	try {
		// debug(data.length);
		const data = await getData();
		debug(data);
		// await removeData(date);
		debug('removed');
		await insertData(data);
		debug('inserted');
	} catch (e) {
		debug(`error message:"${e}"`)
	}
};

const date = moment().subtract(1, 'days').format('YYYY-MM-DD');
start(date);
