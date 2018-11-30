const approvals = [
	'LGTM',
	'+1',
	':thumbsup:',
	':ship:',
	':shipit:',
]

const flair = [
	':tada:',
	':rocket:',
	':man_shrugging:',
	':woman_shrugging:',
	':heart:',
	':heart_eyes:',
	':heart_eyes_cat:',
	':100:',
	':nail_care:',
	':v:',
	':white_check_mark:',
]

const nits = [
	`Is your dev environment up to date? I'm not seeing these changes.`,
	`Could you add some unit tests in the next PR?`,
	`I think you should run this by Patrick as well.`,
	`Does lbo know about this?`,
	`This might be worth adding an integration test in the future.`,
	`I have no idea what this part of the code does, maybe you should ask one of the xings?`,
	`Will slack kit make this cleaner in the future?`,
	`Have we tried using parcel instead?`,
	`:hear_no_evil:`,
	`:x:`,
	`Did you run prettier? The whitespace seems a little wonky.`,
	`This is pretty hairy but I don't see a better way to do it.`,
	`Is there a jira for this work?`,
	`Does this work have a spec?`,
	`We might want to put this on hold and run this by #dhtml-workshop before we go much further.`,
	`I have no memory of this place.`,
	`Can you run git blame so we can figure out who wrote this garbage in the first place?`,
	`Is there a more "Reacty" way to do this?`,
	`What's the test coverage look like on this file?`,
	`Is there a better way to do this in modern?`,
	`Could you convert this to use a side effect instead?`,
	`Do you think it might be better to use a thunk instead?`,
	`Geez, did Eric write the previous implementation?`,
	`Might want to wait until tomorrow to ship.`,
	`Ping me if you need a rebonk.`
]

const comments = [
	`This is great. Thanks for doing this!`,
	`Perfect!`,
	`Perfect, as usual!`,
	`Low risk with solid test coverage.`,
	`I have verified this change in dev.`,
	`Low risk change.`,
	`Gantry only.`,
	`Sonic only.`,
	`I am approving this as a domain expert because I have verified this change and it has good test coverage.`,
	`Imma be real I didn't even read this one, but I trust you.`,
	`I trust you.`,
	`You might want to post in #dhtml about this once you ship.`,
	`This would be good to follow up on with an FE sync presentation.`,
	`Might be worth a #dhtml-announce once you land this.`,
	`🤞that you can get this out in the next deploy.`,
	`Hope you can get this out before you get merge conflicts.`,
	`This is a little hacky but I think it's the best we can do for now.`,
	`YOLO`,
	`This might be worth porting over to Typescript in the next PR.`,
	`Yikes, this legacy code was horrible. Thanks for modernizing it!`,
	`Thanks for the atomic commits and inline comments, made this much easier to read!`,
	`Bump.`,
	`Bonk!`,
	`Re-approving after new commits to address comments.`,
	`Thanks for making those fixes!`,
	`Thanks for adding tests!`,
	`This looks good to me.`,
	`This feels right.`,
	`Finally!`,
	`We should consider emergency merging this.`,
]

function getRandomFrom(array = []) {
	const index = Math.floor(Math.random() * array.length);
	return array[index];
}

module.exports = {
	nits,
	approvals,
	flair,
	comments,
	getRandomFrom,
}