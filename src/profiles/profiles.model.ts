import { Elysia, t } from "elysia";

export const profilesModel = new Elysia().model({
	Profile: t.Object({
		profile: t.Object({
			username: t.String(),
			bio: t.Union([t.String(), t.Null()]),
			image: t.Union([t.String(), t.Null()]),
			following: t.Boolean(),
		}),
	}),
	Username: t.Object({
		username: t.String(),
	}),
});
