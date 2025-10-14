#!/usr/bin/env -S npx tsx

import { Client } from 'tplink-smarthome-api';
import wifiName from 'wifi-name';
import dotenv from 'dotenv';

dotenv.config();

const { HOME_WIFI_NAME } = process.env;

const client = new Client();

async function main(): Promise<void> {
	const network = HOME_WIFI_NAME ? await wifiName() : null;
	if (network && network !== HOME_WIFI_NAME) {
		process.exit(0);
	}

	// Look for devices, find the one we care about, and turn it on.
	client.startDiscovery().on('device-new', async (device: any) => {
		const sysInfo = await device.getSysInfo();
		if (sysInfo.alias === 'Fan') {
			await device.setPowerState(true);
			client.stopDiscovery();
			process.exit(0);
		}
	});
}

void main();
