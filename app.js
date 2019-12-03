const debug = require('debug')('odds:app');
const express = require('express');
const router = require('./routes/router');
const app = express();

app.use('/api', router);

app.listen(3000, function () {
  debug('app listening on port 3000');
});
