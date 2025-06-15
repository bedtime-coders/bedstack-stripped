import { db } from "@/db";
import token from "@/plugins/token";
import { users } from "@/schema";
import { swagger } from "@elysiajs/swagger";
import env from "@env";
import { Elysia, t } from "elysia";
import { description, title } from "../package.json";

const app = new Elysia()
	.use(
		swagger({
			documentation: {
				info: { title, version: "", description },
				components: {
					securitySchemes: {
						tokenAuth: {
							type: "apiKey",
							description: 'Prefix the token with "Token", e.g. "Token xxxx"',
							in: "header",
							name: "Authorization",
						},
					},
				},
			},
			exclude: ["/"],
		}),
	)
	.use(token())
	.get("/", ({ redirect }) => redirect("/swagger"))
	.get("/hello", () => "Hello Bedstack")
	.post(
		"/users",
		async ({ body }) => {
			const user = await db.insert(users).values(body).returning();
			return user;
		},
		{
			body: t.Object({
				name: t.String({ minLength: 2, examples: ["John Doe"] }),
			}),
		},
	)
	.get("/token", ({ token }) => token)
	.listen(env.PORT);

console.log(
	`🦊 Bedstack is running at http://${app.server?.hostname}:${app.server?.port}`,
);
