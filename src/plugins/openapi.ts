import { swagger } from "@elysiajs/swagger";
import { Elysia } from "elysia";
import { description, title } from "../../package.json";

const paths = {
	swaggerUi: "/docs",
	json: "/openapi.json", // TODO: add a route to serve the json
};

export const openapi = new Elysia()
	.use(
		swagger({
			documentation: {
				info: { title, version: "", description },
				components: {
					securitySchemes: {
						tokenAuth: {
							type: "apiKey",
							description:
								'Prefix the token with "Token ", e.g. "Token jwt.token.here"',
							in: "header",
							name: "Authorization",
						},
					},
				},
			},
			exclude: ["/"],
			scalarVersion: "1.31.10",
			path: paths.swaggerUi,
		}),
	)
	.get("/", ({ redirect }) => redirect(paths.swaggerUi));
