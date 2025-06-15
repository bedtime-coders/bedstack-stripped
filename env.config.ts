import ark, { port } from "ark.env";

export default ark.env({
	DATABASE_URL: "string",
	PORT: port.default("3000"),
});
