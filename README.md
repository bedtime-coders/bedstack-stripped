<div align="center">
  <img src="./public/logo-mini.png" alt="bedstack-stripped" width="200"/>
  <h1>
      Bedstack (Stripped)
  </h1>
  <a href="https://github.com/bedtime-coders/bedstack-stripped/actions/workflows/tests.yml?query=branch%3Amain+event%3Apush"><img alt="Tests Status" src="https://github.com/bedtime-coders/bedstack-stripped/actions/workflows/tests.yml/badge.svg?event=push&branch=main&"></a>
  <a href="https://bun.sh/"><img src="https://img.shields.io/badge/Bun-14151a?logo=bun&logoColor=fbf0df" alt="bun" /></a>
  <a href="https://elysiajs.com/"><img src="https://custom-icon-badges.demolab.com/badge/ElysiaJS-0f172b.svg?logo=elysia" alt="elysia" /></a>
  <a href="https://drizzle.team/"><img src="https://img.shields.io/badge/Drizzle-C5F74F?logo=drizzle&logoColor=000" alt="drizzle" /></a>
  <a href="https://biomejs.dev/"><img src="https://img.shields.io/badge/Biome-24272f?logo=biome&logoColor=f6f6f9" alt="biome" /></a>
  <a href="https://scalar.com/"><img src="https://img.shields.io/badge/Scalar-080808?logo=scalar&logoColor=e7e7e7" alt="scalar" /></a>
  <a href="https://github.com/bedtime-coders/bedstack-stripped/blob/main/LICENSE"><img src="https://custom-icon-badges.demolab.com/github/license/bedtime-coders/bedstack-stripped?label=License&color=blue&logo=law" alt="license" /></a>
  <a href="https://github.com/bedtime-coders/bedstack-stripped/stargazers/"><img src="https://custom-icon-badges.demolab.com/github/stars/bedtime-coders/bedstack-stripped?logo=star&logoColor=373737&label=Star" alt="star" /></a>
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
