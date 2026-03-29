# techhub.cafe

Production-ready monorepo for a SaaS product using Next.js, Expo, and Supabase.

## Structure

```
techhub
├── apps
│   ├── mobile
│   └── web
├── packages
│   ├── supabase
│   └── types
├── .env.example
├── .eslintrc.cjs
├── .prettierignore
├── .prettierrc.json
├── package.json
├── tsconfig.base.json
└── tsconfig.json
```

## Getting started

1. Install dependencies

```
npm install
```

2. Configure environment variables

- Copy `.env.example` to `.env`
- For app-specific overrides, copy `apps/web/.env.example` and `apps/mobile/.env.example`

3. Run apps

```
npm run dev:web
npm run dev:mobile
```

## Packages

- `@techhub/types`: shared domain types
- `@techhub/supabase`: shared Supabase client factory

## Linting & formatting

```
npm run lint
npm run format
```
# techhub
