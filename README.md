<div align="center">
<h1>
    Bedstack (Stripped)
</h1>

<a href="https://github.com/bedtime-coders/bedstack-stripped/actions/workflows/tests.yml?query=branch%3Amain+event%3Apush"><img alt="Tests Status" src="https://github.com/bedtime-coders/bedstack-stripped/actions/workflows/tests.yml/badge.svg?event=push&branch=main"></a>
   <a href="https://bun.sh/"><img src="https://img.shields.io/badge/%F0%9F%A6%8A-f6f8fa?label=bun&color=purple" alt="bun" /></a>
   <a href="https://elysiajs.com/"><img src="https://img.shields.io/badge/%F0%9F%A6%8A-f6f8fa?label=elysia&color=purple" alt="elysia" /></a>
   <a href="https://drizzle.team/"><img src="https://img.shields.io/badge/%F0%9F%A6%8A-f6f8fa?label=drizzle&color=purple" alt="drizzle" /></a>
   <a href="https://biomejs.dev/"><img src="https://img.shields.io/badge/%F0%9F%A6%8A-f6f8fa?label=biome&color=purple" alt="biome" /></a>
   <a href="https://github.com/bedtime-coders/bedstack-stripped/blob/main/LICENSE"><img src="https://img.shields.io/github/license/bedtime-coders/bedstack-stripped?label=license&color=purple" alt="license" /></a>
   <a href="https://github.com/bedtime-coders/bedstack-stripped/stargazers/"><img src="https://img.shields.io/github/stars/bedtime-coders/bedstack-stripped" alt="star" /></a>
   <p>⚡ Stripped version of <a href="https://github.com/bedtime-coders/bedstack">Bedstack</a> for rapid prototyping.</p>
</div>

## Bedstack

Bedstack is a collection of bleeding-edge technologies to build modern web applications.

Including:

- [Bun](https://bun.sh) - Runtime, package manager
- [ElysiaJS](https://elysiajs.com) - HTTP Framework
- [Drizzle](https://orm.drizzle.team) - ORM, Migrations, Seeding
- [Biome](https://biomejs.dev) - Linter, Formatter

## Development

1. Install dependencies

   ```bash
   bun install
   ```

2. Copy `.env.example` to `.env` and fill in the values

   ```bash
   cp .env.example .env
   ```

3. Start the database server

   ```bash
   bun db:start
   ```

4. Push the database schema to the database

   ```bash
   bun db:push
   ```

5. Start the development server

   ```bash
   bun dev
   ```

## Testing

Run all tests:
```bash
bun run test # Not `bun test`!
```

Or run different test suites individually:
```bash
bun test:api # Run the API tests
bun test:unit # Run the unit tests
```

> [!TIP]
> To create test-specific environment configuration, create a `.env.test` file. You may use `.env.test.example` as a template:
> ```bash
> cp .env.test.example .env.test
> ```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for more information, including how to set up your development environment.
