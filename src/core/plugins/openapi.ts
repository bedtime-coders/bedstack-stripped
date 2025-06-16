import { staticPlugin } from "@elysiajs/static";
import { swagger } from "@elysiajs/swagger";
import { Elysia } from "elysia";
import { description, title } from "../../package.json";

const paths = {
	scalar: "/docs",
	json: "/openapi.json",
};

export const openapi = new Elysia()
	.use(staticPlugin())
	.use(
		swagger({
			documentation: {
				info: { title, version: "", description },
				components: {
					securitySchemes: {
						tokenAuth: {
							type: "apiKey" as const,
							description:
								'Prefix the token with "Token ", e.g. "Token jwt.token.here"',
							in: "header" as const,
							name: "Authorization",
						},
					},
				},
			},
			exclude: ["/"],
			scalarVersion: "1.31.10",
			path: paths.scalar,
			specPath: paths.json,
			scalarConfig: {
				favicon: "/public/icon-dark.svg",
			},
		}),
	)
	.get("/", ({ redirect }) => redirect(paths.scalar));
