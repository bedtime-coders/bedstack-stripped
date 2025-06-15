import { RealWorldError } from "@/errors/realworld";
import env from "@env";
import { Elysia, t } from "elysia";
import { StatusCodes } from "http-status-codes";
import { name } from "../../package.json";
import jwt from "./jwt";
import token from "./token";

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
						token: ["Missing Authorization header"],
					});
				}
				const jwtPayload = await jwt.verify(token);
				if (!jwtPayload) {
					throw new RealWorldError(StatusCodes.UNAUTHORIZED, {
						token: ["Invalid or expired token"],
					});
				}
				return { auth: { ...auth, jwtPayload } };
			},
		},
	});
