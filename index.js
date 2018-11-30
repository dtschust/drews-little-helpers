const express = require('express');
const bodyParser = require('body-parser');
const addFwProxyRoute = require('./src/fw-proxy-route');
const addFemFreqPodcastRoute = require('./src/fem-freq-podcast-route');
const addRecDiffsPodcastRoute = require('./src/recdiffs-podcast-route');
const addPtpSlackRoute = require('./src/ptp-slack-route');
const addPlausWanRoute = require('./src/plaus-wan-route');

const app = express();

app.set('port', process.env.PORT || 8000);

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use((req, res, next) => {
	res.header('Access-Control-Allow-Origin', '*');
	res.header(
		'Access-Control-Allow-Headers',
		'Origin, X-Requested-With, Content-Type, Accept',
	);
	next();
});

addFwProxyRoute(app);
addFemFreqPodcastRoute(app);
addRecDiffsPodcastRoute(app);
addPtpSlackRoute(app);
addPlausWanRoute(app);

app.listen(app.get('port'), () => {
	console.log('Node app is running on port', app.get('port'));
});
