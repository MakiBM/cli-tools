# Release / remote steps (run by the maintainer)

Everything below is outward-facing and left to you. Local work (code, builds,
commits, tests) is already done on the `main` branch.

## 1. Create the GitHub repo and push

```bash
cd cli-tools
gh repo create MakiBM/cli-tools --private --source=. --remote=origin
git push -u origin main
```

## 2. Publish to npm (scope @makibm)

`@makibm` is an npm **organization** (free tier - unlimited public packages),
not a personal-account scope. A personal account's scope is locked to its
username, so a branded scope like `@makibm/*` must come from an org of that
name. You must be logged in as a member/owner of the `makibm` org to publish.

```bash
npm login                       # log in
npm whoami                      # confirm you are logged in
npm org ls makibm               # confirm you are a member/owner of the org
```

Publishing must happen in dependency order - `@makibm/cli-kit` first, since the
tools depend on it. `pnpm -r publish` handles ordering and rewrites each
`workspace:^` dependency to the real version automatically. `--access public`
is required (scoped packages default to private).

```bash
pnpm -r publish --access public
# add --otp=<code> if 2FA-for-publish is enabled
# preview first with: pnpm -r publish --access public --dry-run
```

## 3. Archive the old repositories

```bash
gh repo archive MakiBM/gites --yes
gh repo archive MakiBM/tw-arbitrary-finder --yes
```

(The old `gitpace` and `tw-arbitrary-finder` npm packages can be deprecated:
`npm deprecate gitpace "moved to @makibm/gites"` and
`npm deprecate tw-arbitrary-finder "moved to @makibm/twixer"`.)
