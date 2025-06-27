import { $, type BuildConfig } from "bun";

const options = {
	compile: true,
	minify: {
		whitespace: true,
		syntax: true,
	},
	target: "bun",
	outfile: "server",
} satisfies Partial<BuildConfig> & { compile: boolean; outfile: string };

const entrypoint = "./src/index.ts";

try {
	await $`bun build ${Object.entries(options)
		.map(([key, value]) => `--${key} ${value}`)
		.join(" ")} ${entrypoint}`;
} catch (error) {
	if (error instanceof $.ShellError) {
		console.error(error.stderr.toString());
	}
	process.exit(1);
}
