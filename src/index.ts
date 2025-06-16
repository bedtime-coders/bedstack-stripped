import { app } from "@/core/app";
import { env } from "@/core/env";
import chalk from "chalk";

app.listen(env.PORT);

console.log(
	`Bedstack is up and running on ${chalk.blue(`http://${app.server?.hostname}:${app.server?.port}`)}`,
);
