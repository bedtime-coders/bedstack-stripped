import { env } from "@/core/env";
import { RealWorldError } from "@/shared/errors/realworld";
import { jwt, token } from "@/shared/plugins";
import { Elysia, t } from "elysia";
import { StatusCodes } from "http-status-codes";
import { name } from "../../../package.json";

const JwtPayload = t.Object({
	uid: t.Number(),
	email: t.String(),
	username: t.String(),
});

type JwtPayload = typeof JwtPayload.static;

export const auth = new Elysia()
	.use(
		jwt({
			secret: env.JWT_SECRET,
			exp: "24h",
			iss: name,
			schema: JwtPayload,
		}),
	)
	.use(token())
	.derive({ as: "global" }, ({ jwt }) => ({
		auth: {
			sign: (jwtPayload: JwtPayload) =>
				jwt.sign({
					...jwtPayload,
					iat: Math.floor(Date.now() / 1000),
				}),
		},
	}))
	.macro({
		auth: {
			async resolve({ jwt, token, auth }) {
				if (!token) {
					throw new RealWorldError(StatusCodes.UNAUTHORIZED, {
						token: [
							"is missing. Authorization header is required in the form: 'Token <token>'",
						],
					});
				}
				const jwtPayload = await jwt.verify(token);
				if (!jwtPayload) {
					throw new RealWorldError(StatusCodes.UNAUTHORIZED, {
						token: ["is invalid, expired, or malformed"],
					});
				}
				return { auth: { ...auth, jwtPayload } };
			},
		},
	});
