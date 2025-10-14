#!/usr/bin/env -S npx tsx

// NOTE: this should only run locally on a mac, not in the cloud!
// Also: You must enable the safari developer menu "Allow JavaScript from Apple Events"

import dotenv from 'dotenv';
import { execFile } from 'child_process';

dotenv.config();

const serverUrl = process.env.SERVER_URL ?? '';
const verificationToken = process.env.PTP_SLACK_VERIFICATION_TOKEN ?? '';

const minifiedJavascript = `function unescape(string){return new DOMParser().parseFromString(string,'text/html').querySelector('html').textContent;}var data=coverViewJsonData[1].Movies.map(a=>({id:a.GroupId,title:unescape(a.Title),posterUrl:a.Cover,year:a.Year,imdbId:a.ImdbId}));fetch('${serverUrl}/update-top-movies',{method:'POST',mode:'cors',cache:'no-cache',credentials:'same-origin',headers:{'Content-Type':'application/json'},redirect:'follow',referrerPolicy:'no-referrer',body:JSON.stringify({token:'${verificationToken}',movies:data})});`;

const escapedJavascript = minifiedJavascript.replace(/"/g, '\\"');

const appleScript = `
tell application "Safari"
	activate
	delay 20
	make new document with properties {URL:"https://passthepopcorn.me/top10.php"}
	delay 20
	do JavaScript "${escapedJavascript}" in current tab of front window
	delay 20
	close front window
end tell
`;

execFile('osascript', ['-e', appleScript], (error, stdout, stderr) => {
	if (error) {
		console.error(error);
		return;
	}
	if (stdout) {
		console.log(stdout);
	}
	if (stderr) {
		console.error(stderr);
	}
});
