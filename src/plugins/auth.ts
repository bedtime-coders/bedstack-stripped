// Plugin for requiring authentication on routes

import { RealWorldError } from "@/errors/realworld";
import env from "@env";
import Elysia, { t } from "elysia";
import { StatusCodes } from "http-status-codes";
import { name } from "../../package.json";
import jwt from "./jwt";
import token from "./token";

const JWTPayload = t.Object({
	uid: t.Number(),
	email: t.String(),
	username: t.String(),
});

type JWTPayload = typeof JWTPayload.static;

export const auth = () =>
	new Elysia({
		name: "ElysiaJS auth plugin",
	})
		.use(
			jwt({
				name: "jwt",
				secret: env.JWT_SECRET,
				exp: "24h",
				iss: name,
				// schema: JWTPayload,
			}),
		)
		.use(token())
		.macro({
			auth() {
				return {
					async beforeHandle({ token, jwt }) {
						if (!token) {
							throw new RealWorldError(StatusCodes.UNAUTHORIZED, {
								token: [
									"is missing or malformed - must be provided in Authorization header with 'Token ' prefix, e.g. 'Token jwt.token.here'",
								],
							});
						}
						const verifyResult = await jwt.verify(token);
						if (!verifyResult) {
							throw new RealWorldError(StatusCodes.UNAUTHORIZED, {
								token: ["is expired, malformed, or invalid"],
							});
						}
					},
				};
			},
			// sign: {
			// 	async resolve({ jwt, body }) {
			// 		const signed = await jwt.sign({
			// 			body,
			// 			iat: Math.floor(Date.now() / 1000),
			// 		});
			// 		console.log(signed);
			// 		return {
			// 			token: signed,
			// 		};
			// 	},
			// },
		})
		.derive({ as: "global" }, async ({ jwt, token }) => {
			console.log(token);
			const decoded = token ? await jwt.verify(token) : undefined;
			console.log(decoded);
			return {
				auth: {
					async sign(payload: Omit<JWTPayload, "iat" | "iss">) {
						return await jwt.sign({
							...payload,
							iat: Math.floor(Date.now() / 1000),
						});
					},
					jwtDecodedPayload: decoded || undefined,
				},
			};
		});
