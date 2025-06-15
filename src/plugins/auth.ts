// Plugin for requiring authentication on routes

import { RealWorldError } from "@/errors/realworld";
import { jwt } from "@elysiajs/jwt";
import env from "@env";
import Elysia from "elysia";
import { StatusCodes } from "http-status-codes";
import { name } from "../../package.json";
import token from "./token";

export const auth = () =>
	new Elysia({
		name: "ElysiaJS auth plugin",
	})
		.use(
			jwt({
				name: "jwt",
				secret: env.JWT_SECRET,
				exp: "24h",
				issuer: name,
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
			const decoded = token ? await jwt.verify(token) : undefined;
			return {
				auth: {
					async sign(payload: Record<string, string | number>) {
						return await jwt.sign({
							...payload,
							iat: Math.floor(Date.now() / 1000),
						});
					},
					jwtDecodedPayload: decoded ?? undefined,
				},
			};
		});
