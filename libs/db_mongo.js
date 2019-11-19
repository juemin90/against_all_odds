"use strict";

const mongodb = require('mongodb');
const MongoClient = mongodb.MongoClient;
const URL = 'mongodb://cmplay_dev:cmplay_dev_pwd@10.60.102.115:27017/cmplay_x3';
const DB_NAME = 'cmplay_x3';

exports.getMongoClient = () => new Promise((resolve, reject) => {
	MongoClient.connect(URL, { useNewUrlParser: true }, (err, db) => {
		if (err) reject(err);
		else resolve(db.db(DB_NAME));
	});
});
