// Plugin for requiring authentication on routes

import { RealWorldError } from "@/errors/realworld";
import Elysia from "elysia";
import { StatusCodes } from "http-status-codes";
import token from "./token";

export const auth = () =>
	new Elysia({
		name: "ElysiaJS auth plugin",
	})
		.use(token())
		.macro({
			auth() {
				return {
					beforeHandle({ token }) {
						if (!token) {
							throw new RealWorldError(StatusCodes.UNAUTHORIZED, {
								// TODO: separate error messages for missing and invalid token
								token: ["is missing or invalid"],
							});
						}
					},
				};
			},
		});
