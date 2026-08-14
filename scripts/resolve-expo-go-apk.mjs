#!/usr/bin/env node
/**
 * Prints the Expo Go APK download URL for this project's SDK version to
 * stdout. Used by .github/workflows/nightly.yml's mobile-e2e job to
 * sideload a matching Expo Go build into a fresh CI emulator, resolved at
 * run time against Expo's own versions API rather than a hardcoded URL
 * that would go stale on the next SDK bump.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../apps/mobile/package.json'), 'utf8'),
);
const expoRange = pkg.dependencies.expo; // e.g. "~54.0.36"
const majorMatch = /(\d+)\./.exec(expoRange);
if (!majorMatch) {
  console.error(`Could not parse a major SDK version from expo dependency "${expoRange}"`);
  process.exit(1);
}
const major = majorMatch[1];

const res = await fetch('https://api.expo.dev/v2/versions/latest');
if (!res.ok) {
  console.error(`Expo versions API failed: ${res.status}`);
  process.exit(1);
}
const { data } = await res.json(); // response is { data: { sdkVersions: {...}, ... } }, not flat
const sdkKey = Object.keys(data.sdkVersions).find((k) => k.startsWith(`${major}.`));
if (!sdkKey) {
  console.error(`No SDK ${major}.x entry in Expo's versions API response`);
  process.exit(1);
}
const url = data.sdkVersions[sdkKey].androidClientUrl;
if (!url) {
  console.error(`SDK ${sdkKey} has no androidClientUrl`);
  process.exit(1);
}
console.log(url);
