const express = require('express');
const bodyParser = require('body-parser');
const addFbProxyRoute = require('./src/fb-proxy-route');
const addPtpSlackRoute = require('./src/ptp-slack-route');
const addDrewsHelpfulRobotRoute = require('./src/drews-helpful-robot-route');
const addIFlicksRoute = require('./src/iflicks-route');
const addLetterboxdFeedRoute = require('./src/letterboxd-feed-route');
const addSuperlightRoute = require('./src/superlight-route');
const addPodcastFeedRoute = require('./src/podcast-feed-route');
const addMoviesRoute = require('./src/movies-route');

const app = express();

app.set('port', process.env.PORT || 8000);

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use((req, res, next) => {
	res.header('Access-Control-Allow-Origin', '*');
	res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
	next();
});

addFbProxyRoute(app);
addPtpSlackRoute(app);
addIFlicksRoute(app);
addDrewsHelpfulRobotRoute(app);
addLetterboxdFeedRoute(app);
addSuperlightRoute(app);
addPodcastFeedRoute(app);
addMoviesRoute(app);

app.listen(app.get('port'), () => {
	console.log('Node app is running on port', app.get('port'));
});
