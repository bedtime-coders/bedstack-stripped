import { app } from "@/core/app";
import { env } from "@/core/env";
import chalk from "chalk";

console.info(chalk.gray("Starting Bedstack"));

app.listen(env.PORT, ({ hostname, port }) => {
	console.info(
		`Bedstack is up and running on ${chalk.blue(`http://${hostname}:${port}`)}`,
	);
});
