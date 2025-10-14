#!/usr/bin/env -S npx tsx

import dotenv from 'dotenv';

dotenv.config();

const endpoint = process.env.HUE_ENDPOINT ?? '';
const username = process.env.HUE_USERNAME ?? '';
const light = process.env.HUE_LIGHT ?? '';
const INCREMENT = 60;

type LightState = {
	on: boolean;
	bri: number;
	resp: any;
};

async function getCurrentLightStatus(): Promise<LightState> {
	const response = await fetch(`http://${endpoint}/api/${username}/lights/${light}`, {
		method: 'GET',
	});

	const body: any = await response.json();
	const { state } = body ?? {};
	const { on, bri } = state ?? {};
	console.log(`on: ${on} bri: ${bri}`);
	return { on, bri, resp: body };
}

async function updateLightState(payload: Record<string, unknown>) {
	const response = await fetch(`http://${endpoint}/api/${username}/lights/${light}/state`, {
		method: 'PUT',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(payload),
	});
	const result = await response.json();
	console.log(result);
	return result;
}

export function changeBri(briInc: number) {
	return updateLightState({ bri_inc: briInc });
}

export async function toggleLight(inputOn?: boolean) {
	let on = inputOn;
	if (typeof on === 'undefined') {
		const { on: currentOn } = await getCurrentLightStatus();
		on = !currentOn;
	}
	return updateLightState({ on });
}

export async function brighten(): Promise<void> {
	const { on, bri } = await getCurrentLightStatus();
	if (!on) {
		await toggleLight(true);
		return;
	}

	if (bri === 254) {
		await updateLightState({ alert: 'select' });
		return;
	}

	await changeBri(INCREMENT);
}

export async function darken(): Promise<void> {
	const { on, bri } = await getCurrentLightStatus();
	if (!on) {
		await toggleLight(true);
		return;
	}

	if (bri === 1) {
		await updateLightState({ alert: 'select' });
		return;
	}

	await changeBri(INCREMENT * -1);
}
