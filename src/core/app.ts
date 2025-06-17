import { profilesPlugin } from "@/profiles/profiles.plugin";
import { usersPlugin } from "@/users/users.plugin";
import { Elysia } from "elysia";
import { errors, openapi } from "./plugins";

export const app = new Elysia()
	.use(errors)
	.use(openapi)
	.group("/api", (app) => app.use(usersPlugin).use(profilesPlugin));
