require('dotenv').config();

function pubDate(date = new Date()) {
	const pieces = date.toString().split(' ');

	const offsetTime = pieces[5].match(/[-+]\d{4}/);

	const offset = offsetTime || pieces[5];

	const parts = [`${pieces[0]},`, pieces[2], pieces[1], pieces[3], pieces[4], offset];

	return parts.join(' ');
}

const eps = [
	{
		title: 'No More Email',
		description:
			'This week Max and Old Man Rothfuss talk about post-apocalyptic life with no email and give some advice. Help us out by subscribing to the show on iTunes. Thanks to Mac Schubert for our podcast artwork and Pete Danilchuck for our theme music!By max.temkin@gmail.com (Patrick Rothfuss and Max Temkin).',
		url: 'https://audio.simplecast.com/55919.mp3',
		pubdate: '2016-12-27T20:42:00Z',
	},
	{
		title: "President of the Don't F*ck It Up Committee",
		description:
			"This week Max and Pat talk about Lin Manuel Miranda, Lord of the Rings, and Dr. Strange. Help us out by subscribing to the show on iTunes. Show notes: WorldBuilders has begun - learn more and get incredible items here Thanks to Molly Lewis for the beautiful Ukelele cover of You'll Be Back Thanks to Mac Schubert for our podcast artwork and Pete ...…",
		url: 'https://audio.simplecast.com/54616.mp3',
		pubdate: '2016-12-07T02:10:00Z',
	},
	{
		title: 'Pookadook',
		description:
			'This week Max and Pat talk about names, Overwatch, and cornholing. Help us out by subscribing to the show on iTunes. Show notes: WorldBuilders has begun - learn more and get incredible items here Thanks to Mac Schubert for our podcast artwork and Pete Danilchuck for our theme music!By max.temkin@gmail.com (Patrick Rothfuss and Max Temkin).',
		url: 'https://audio.simplecast.com/53505.mp3',
		pubdate: '2016-11-21T22:37:00Z',
	},
	{
		title: 'Keep Your Powder Dry',
		description:
			'This week Max and Pat are talk about the rise of authoritarian fascism in the United States. Help us out by subscribing to the show on iTunes. Show notes: WorldBuilders has begun - learn more and get incredible items here Thanks to Mac Schubert for our podcast artwork and Pete Danilchuck for our theme music!…',
		url: 'https://audio.simplecast.com/53139.mp3',
		pubdate: '2016-11-17T00:29:00Z',
	},
	{
		title: "I'm Not Here to Judge You Chickenf*ckers",
		description:
			"This week Max and Pat are LIVE from NerdCon Stories. Help us out by subscribing to the show on iTunes. Show notes: Jonathan Haidt's The Righteous Mind Max's Plato notes are heavily cribbed from Michael Sugrue's Plato Lectures Thanks to Mac Schubert for our podcast artwork and Pete Danilchuck for our theme music!…",
		url: 'https://audio.simplecast.com/50539.mp3',
		pubdate: '2016-10-24T22:06:00Z',
	},
	{
		title: 'A Foot Rub from Lord Krishna',
		description:
			'This week Max and Pat talk about Fun Home, conventions, scheduling, giving advice, and saying no. Help us out by subscribing to the show on iTunes. Thanks to Mac Schubert for our podcast artwork and Pete Danilchuck for our theme music!By max.temkin@gmail.com (Patrick Rothfuss and Max Temkin).',
		url: 'https://audio.simplecast.com/49945.mp3',
		pubdate: '2016-10-16T23:01:00Z',
	},
	{
		title: 'Derrida is the Biggest Wanker',
		description:
			"This week Max and Pat are joined by special guest Zach Gage to talk about The Witness and deconstruction. Help us out by subscribing to the show on iTunes. Show notes: Zach's portfolio Zach's talk on learning in games Thanks to Mac Schubert for our podcast artwork and Pete Danilchuck for our theme music!…",
		url: 'https://audio.simplecast.com/46481.mp3',
		pubdate: '2016-09-07T22:15:00Z',
	},
	{
		title: 'Corral Your Spawn',
		description:
			"This week Max and Pat are joined by special guest Zach Gage to talk about Harry Potter, writing rules, and game design. Help us out by subscribing to the show on iTunes. Show notes: Zach's portfolio Zach's talk on learning in games Harry Potter and the Methods of Rationality Thanks to Mac Schubert for our podcast artwork and Pete Danilchuck for ...…",
		url: 'https://audio.simplecast.com/45560.mp3',
		pubdate: '2016-08-30T01:22:00Z',
	},
	{
		title: 'I Sure Maybe Did Some Word Movings',
		description:
			"This week Max and Pat talk about No Man's Sky, Overwatch, the Olympics, and game design. DISCLAIMER: This is a bad episode where we just talk about video games for an hour. Help us out by subscribing to the show on iTunes. Show notes: The website Max built his PC on INSIDE by Playdead, the game Max suggested to Pat Thanks to Mac Schubert for ou ...…",
		url: 'https://audio.simplecast.com/45025.mp3',
		pubdate: '2016-08-22T14:49:00Z',
	},
	{
		title: 'I Want Milk! Now! In My Mouth!',
		description:
			'This week Max and Pat talk about ask vs. guess, live chickens, pranks, and deadlines. Help us out by subscribing to the show on iTunes. Show notes: Website we mention: http://Twitter.com Max finding the chickens (video): https://twitter.com/MaxTemkin/status/762059701605523456 The chickens in their bathtub home: https://twitter.com/MaxTemkin/sta ...…',
		url: 'https://audio.simplecast.com/44353.mp3',
		pubdate: '2016-08-10T18:49:00Z',
	},
	{
		title: 'Blast Myself In the Nose',
		description:
			'This week Max and Pat talk about fancy soaps, brain amoebas, and sluicing vs. blasting. Help us out by subscribing to the show on iTunes. Show notes: Sinucles micro-filtered nasal blast system CDC warning about brain amoebas in netipots Thanks to Mac Schubert for our podcast artwork and Pete Danilchuck for our theme music!…',
		url: 'https://audio.simplecast.com/42461.mp3',
		pubdate: '2016-07-18T15:16:00Z',
	},
	{
		title: 'Manure Digester',
		description:
			'This week Max and Pat talk about vacations, nuclear deterrence, what happiness feels like, and whether the world is getting any better. Help us out by subscribing to the show on iTunes. Show notes: Pat was a guest on the funniest podcast in the world, My Brother, My Brother, and Me Hank Green on the world getting better Planet Money on the cost ...…',
		url: 'https://audio.simplecast.com/42238.mp3',
		pubdate: '2016-07-11T21:52:00Z',
	},
	{
		title: 'Friends of the Show',
		description:
			"This week Max and Pat are joined by FRIENDS OF THE SHOW Paul and Storm, and they discuss renting a car, labor, entertainment, and spoons. Please send in photos of your favorite silverware at http://YourFavoriteFork.biz! Some alternate titles for this week's episode: Helpless Man-Babies The Asimov Horn A smallpox blanket of entertainment A Yogur ...…",
		url: 'https://audio.simplecast.com/40722.mp3',
		pubdate: '2016-06-27T14:01:00Z',
	},
	{
		title: 'Desiring 100 Cakes',
		description:
			'This week Max and Pat talk about environmentalism, meditation, and going to the gym. Help us out by subscribing to the show on iTunes. Show notes: Sony RX1 Should We Ban College Football? Ego Depletion Theory Replication Crisis in Psych Thoughts Without a Thinker by Mark Epstein Thanks to Mac Schubert for our podcast artwork and Pete Danilchuck ...…',
		url: 'https://audio.simplecast.com/40465.mp3',
		pubdate: '2016-06-20T18:12:00Z',
	},
	{
		title: 'No One Enjoys Half a Dog',
		description:
			"This week Max and Pat talk about torahs, circumcision, Hamilton, and what theater is for. CONTENT ADVISORY: This episode contains a decent amount of boy penis anecdotes from Pat. Help us out by subscribing to the show on iTunes. Show notes: The Art of Letting Others Be Right Max's Zine I think this is the fruit Pat was talking about ¯_(ツ)_/¯ Th ...…",
		url: 'https://audio.simplecast.com/40287.mp3',
		pubdate: '2016-06-16T20:46:00Z',
	},
	{
		title: 'Gettin’ Denatured',
		description:
			'This week Max and Pat talk about silverware, parents, delitainers, and saving some ducks. Help us out by subscribing to the show on iTunes. Show notes: Inga Sempé’s silverware set for Alessi 8oz Delitainers on Amazon 16oz Delitainers on Amazon 32oz Delitainers on Amazon Worldbuilders on IndieGoGo Thanks to Mac Schubert for our podcast artwork a ...…',
		url: 'https://audio.simplecast.com/39130.mp3',
		pubdate: '2016-06-07T19:48:00Z',
	},
	{
		title: 'Big Mucus Boys',
		description:
			'This week Max and Pat talk about reading books, writing torahs, and regulating rogue Iron Man suits. Help us out by subscribing to the show on iTunes. Show notes: This American Life on First Contact Superman Red Son The Superman Paradox Thanks to Mac Schubert for our podcast artwork and Pete Danilchuck for our theme music!…',
		url: 'https://audio.simplecast.com/38820.mp3',
		pubdate: '2016-06-02T23:38:00Z',
	},
	{
		title: 'And Also He Got An Extra Shirt, The End',
		description:
			"This week Max and Pat talk about the Marvel Cinematic Universe, story structure, and staying on message. Help us out by subscribing to the show on iTunes. Show notes: Hello From the Magic Tavern Cards Against Humanity's Donald Trump Bugout Bag James Carville's book Buck Up, Suck Up . . . and Come Back When You Foul Up Mary Robinette Kowal expla ...…",
		url: 'https://audio.simplecast.com/38150.mp3',
		pubdate: '2016-05-23T15:44:00Z',
	},
	{
		title: 'Well Actually...',
		description:
			'This week Max and Pat talk about narcissism, empathy, and (regretfully) Donald Trump. Help us out by subscribing to the show on iTunes. Show notes: Tak, on Kickstarter this week E Unibus Pluram by David Foster Wallace The Dark Triad Barack Obama in conversation with Bryan Cranston Instapaper, the "read later" button for your phone Max\'s favorit ...…',
		url: 'https://audio.simplecast.com/37718.mp3',
		pubdate: '2016-05-16T14:54:00Z',
	},
	{
		title: 'I Know It Wasn’t Because of the Taco Dip',
		description:
			'This week Max and Pat talk about the Worldbuilders charity. Show notes: Cash, Cows And The Rise Of Nerd Philanthropy A Story about My Mom, Haiti, and Irresistible Math JJ Abrams’ TED Talk about the Mystery Box Cutie Meeting Cinder Secret Hitler Thanks to Mac Schubert for our podcast artwork and Pete Danilchuck for our theme music!…',
		url: 'https://audio.simplecast.com/21832.mp3',
		pubdate: '2015-12-04T23:41:00Z',
	},
	{
		title: 'Gandalf Already Knows Prismatic Spray',
		description:
			"This week Max and Pat talk about childhood. Magician: Apprentice by Raymond Feist (recommended by Pat) Zen Mind, Beginner's Mind (recommended by Max) Mr. Rogers testifies to Congress Thank you to our sponsor Backblaze - claim a free two-week trail here Thanks to Mac Schubert for our podcast artwork and Pete Danilchuck for our theme music!…",
		url: 'https://audio.simplecast.com/17045.mp3',
		pubdate: '2015-09-09T20:23:00Z',
	},
	{
		title: 'So I Tried That and It Was Not a Success',
		description:
			"LIVE from PAX - this week Max and Pat talk about surviving. The Really Big One Ana's links about the New Madrid Seismic Zone: 1, 2, and 3 Numenera Thanks to our sponsor Backblaze! Thanks to Mac Schubert for our podcast artwork and Pete Danilchuck for our theme music!By max.temkin@gmail.com (Patrick Rothfuss and Max Temkin).",
		url: 'https://audio.simplecast.com/16294.mp3',
		pubdate: '2015-09-02T16:58:00Z',
	},
	{
		title: 'Fake Congratulatory Fanmail',
		description:
			'This week Max and Pat talk about distractions. Ira Glass on PRI Nobel Prize genius Crick was high on LSD when he discovered the secret of life Thank you to our sponsor Backblaze - claim a free two-week trail here Thanks to Mac Schubert for our podcast artwork and Pete Danilchuck for our theme music!By max.temkin@gmail.com (Patrick Rothfuss and Max Temkin).',
		url: 'https://audio.simplecast.com/15597.mp3',
		pubdate: '2015-08-18T19:43:00Z',
	},
	{
		title: 'Squashes Out The Wazoo',
		description:
			'This week Max and Pat talk about solving problems. Chicago style hot dog "Fuck beets." Adam Leith Gollner\'s article about apricots Dan Barber on Chef’s Table Backblaze remote backup Max\'s pseudo-raid array, the Drobo 5D Encrypted drives and futuristic self-destructing drives Private alternative to Dropbox Thanks to Mac Schubert for our podcast ...…',
		url: 'https://audio.simplecast.com/15253.mp3',
		pubdate: '2015-08-11T18:38:00Z',
	},
	{
		title: "You're Gonna See Some Hogs",
		description:
			"This week Max and Pat talk about procrastination. Show Notes: John Scalzi's backstage photos of our concert The Chicago Podcast Co-op A Prairie Home Companion Book on mindfulness recommended by Max Thanks to Mac Schubert for our podcast artwork and Pete Danilchuck for our theme music!By max.temkin@gmail.com (Patrick Rothfuss and Max Temkin).",
		url: 'https://audio.simplecast.com/14924.mp3',
		pubdate: '2015-08-05T00:24:00Z',
	},
	{
		title: 'You Are Egregious Fu$%ers and I Will Destroy You!',
		description:
			'This week Max and Pat talk about working with other people. Show Notes: Pat’s busted website Dr. Bronner’s Peppermint Pure-Castile One-World Liquid Soap Thanks to Mac Schubert for our podcast artwork and Pete Danilchuck for our theme music!By max.temkin@gmail.com (Patrick Rothfuss and Max Temkin).',
		url: 'https://audio.simplecast.com/14293.mp3',
		pubdate: '2015-07-21T13:00:00Z',
	},
	{
		title: 'An Irreconcilable Ganglion of Antithetical Factors',
		description:
			"This week Max and Pat talk about dreaming big. DISCLAIMER: The Following Podcast was recorded in the midst of San Diego Comic Con. Statements made under the influence of too much caffeine and too little sleep should probably be taken with a grain of salt. Show Notes: Hollywood Reporter: Fantasy Novel 'Name of the Wind' Sparks Heated Bidding War ...…",
		url: 'https://audio.simplecast.com/14052.mp3',
		pubdate: '2015-07-14T22:00:00Z',
	},
	{
		title: 'The Half Amateur Hour',
		description:
			"This week Pat and Max talk about budgets. Show Notes Pat’s A.V. Club Interview Max's favorite YA author Bruce Coville ZHPUAT 5.3” Morning Clock,Low Light Sensor Technology,Light On Backligt When Detect Low Light,Soft Light That Won’t Disturb The Sleep,Progressively Louder Wakey Alarm Wake You Up Softly.Color Grey White Max’s RescueTime Stats fo ...…",
		url: 'https://audio.simplecast.com/13905.mp3',
		pubdate: '2015-07-07T18:44:00Z',
	},
	{
		title: 'A Farewell to Joy',
		description:
			"This week Pat and Max talk about turning hobbies into work. Show Notes Help name the Podcast on Pat's blog! Name of the Wind Pat's AMA on Reddit Pat Rothfuss' blog Back to Work with Merlin Mann and Dan Benjamin Thanks to Mac Schubert for our podcast artwork and Pete Danilchuck for our theme music!By max.temkin@gmail.com (Patrick Rothfuss and Max Temkin).",
		url: 'https://audio.simplecast.com/13421.mp3',
		pubdate: '2015-06-26T04:04:00Z',
	},
];

function addUnattendedConsequencesRoute(app) {
	app.get('/unattendedConsequences', (req, res) => {
		const xml = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
<channel>
<title>Unattended Consequences (Old)</title>
<link>https://unattendedconsequences.simplecast.fm</link>
<language>en-us</language>
<itunes:author>Patrick Rothfuss and Max Temkin</itunes:author>
<itunes:summary>A weekly conversation between Patrick Rothfuss (Name of the Wind) and Max Temkin (Cards Against Humanity).</itunes:summary>
<description>A weekly conversation between Patrick Rothfuss (Name of the Wind) and Max Temkin (Cards Against Humanity).</description>
<itunes:owner>
	<itunes:name>Unattended Consequences (Old)</itunes:name>
</itunes:owner>
<itunes:explicit>no</itunes:explicit>
<itunes:image href="https://media.simplecast.com/podcast/logo_image/1227/unnamed.jpg" />

${eps
	.map(
		({ url, title, description, pubdate } = {}) => `<item>
	<title>${title}</title>
	<itunes:summary>${title}</itunes:summary>
	<description>${description}</description>
	<link>${url}</link>
	<enclosure url="${url}" type="audio/mpeg" length="1024"></enclosure>
	<pubDate>${pubDate(new Date(pubdate))}</pubDate>
	<itunes:author>Merlin Mann and John Siracusa</itunes:author>
	<itunes:duration>00:32:16</itunes:duration>
	<itunes:explicit>no</itunes:explicit>
	<guid>${url}</guid>
</item>`
	)
	.join('\n')}

</channel>
</rss>
`;
		res.status(200);
		res.type('application/xml');
		res.send(xml);
	});
}

module.exports = addUnattendedConsequencesRoute;
