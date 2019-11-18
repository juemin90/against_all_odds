const debug = require('debug')('odds:odds');
const mongodb = require('mongodb');

const URL = 'mongodb://cmplay_dev:cmplay_dev_pwd@10.60.102.115:27017/cmplay_x3';
const { MongoClient } = mongodb;

MongoClient.connect(URL, (err, db) => {
	debug(db);
	db.collection('sports').find({}, (err, data) => {
		if (err) debug('err');
		else debug(data);
	});
});
