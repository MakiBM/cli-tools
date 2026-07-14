# Release / remote steps (run by the maintainer)

Everything below is outward-facing and left to you. Local work (code, builds,
commits, tests) is already done on the `main` branch.

## 1. Create the GitHub repo and push

```bash
cd makibm-tools
gh repo create MakiBM/makibm-tools --private --source=. --remote=origin
git push -u origin main
```

## 2. Publish to npm (scope @makibm)

Publishing must happen in dependency order - `@makibm/cli-kit` first, since the
tools depend on it. `pnpm publish -r` handles ordering and rewrites the
`workspace:^` dependency to the real version automatically.

```bash
npm login                       # ensure the @makibm scope exists / you can publish to it
pnpm -r publish --access public
```

## 3. Archive the old repositories

```bash
gh repo archive MakiBM/gites --yes
gh repo archive MakiBM/tw-arbitrary-finder --yes
```

(The old `gitpace` and `tw-arbitrary-finder` npm packages can be deprecated:
`npm deprecate gitpace "moved to @makibm/gites"` and
`npm deprecate tw-arbitrary-finder "moved to @makibm/twixer"`.)
