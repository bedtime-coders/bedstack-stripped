import { errors, openapi } from "@/core/plugins";
import { usersPlugin } from "@/users/users.plugin";
import { Elysia } from "elysia";

export const app = new Elysia()
	.use(errors)
	.use(openapi)
	.group("/api", (app) => app.use(usersPlugin));
