# Publishing

Everything releases from this repository. `release.yml` generates the four clients from the live
OpenAPI document, tests them, and publishes each to its registry, plus the agent toolkit.

That works because `/openapi/store.json` and `/openapi/admin.json` are served without authentication,
so generation needs the spec and nothing private. Storefront-8 has no part in it.

## Cutting a release

Tag it, or use **Actions → Release SDKs and toolkit → Run workflow** with the version typed in. The
manual route is worth preferring for anything uncertain: a failure costs nothing, where a bad tag has
to be deleted and re-pushed.

```bash
git tag v1.1.0 && git push origin v1.1.0
```

One version covers all five packages. The version is validated as semver before anything runs -
Storefront's own release numbers (`V8.017.016`) are not valid semver, and npm rejects them outright
while PyPI and NuGet silently renormalise, leaving the tag and the published version disagreeing.

Re-running a release is safe. npm refuses a duplicate version, PyPI skips existing files, NuGet uses
`--skip-duplicate`, and the PHP push no-ops on an existing tag.

## What gets published

| Registry | Package | Source |
|---|---|---|
| npm | `@ordereazi/commerce-sdk` | `typescript/` |
| npm | `@ordereazi/commerce-agent-toolkit` | `agent-toolkit/` |
| PyPI | `ordereazi-commerce-sdk` | `python/generated` |
| NuGet | `OrderEazi.Commerce.Sdk` | `dotnet/generated` |
| Packagist | `ordereazi/commerce-sdk` | pushed to `OrderEazi/commerce-sdk-php`, which Packagist watches |

## Which API the SDKs describe

`OPENAPI_BASE_URL` decides, and it is the real input to a release - more than the version is. Unset,
it falls back to alpha:

```yaml
OPENAPI_BASE_URL: ${{ vars.OPENAPI_BASE_URL || 'https://commerce-api-alpha.ordereazi.com' }}
```

Set it as a repository **variable** (Settings → Secrets and variables → Actions → Variables) to
release against production. No trailing slash, no `/openapi` path - the workflow appends that.

The workflow refuses a spec with zero paths, because a generator handed a 404 body produces an empty
but perfectly valid client that publishes and looks fine. It cannot tell you the environment is
merely *behind*, so comparing path counts before a first production release is worth the minute:

```bash
for u in commerce-api-alpha commerce-api; do
  echo -n "$u: "
  curl -s "https://$u.ordereazi.com/openapi/store.json" \
    | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(Object.keys(JSON.parse(s).paths||{}).length+' paths'))"
done
```

## Credentials

No registry credential is stored. Every publish authenticates by OIDC.

| Name | Kind | What it is |
|---|---|---|
| `NUGET_USER` | secret | nuget.org **profile name**, not an email. Not a credential - secret only to keep the account name out of public logs. |
| `SDK_PHP_PUSH_TOKEN` | secret | Fine-grained PAT, Contents: read/write on `commerce-sdk-php`. Needed because `GITHUB_TOKEN` is scoped to its own repository. Unset it and the PHP push skips cleanly. |
| `OPENAPI_BASE_URL` | variable | See above. |

Both tokens must be owned by the **OrderEazi** organization and expire within **366 days** - the org
rejects fine-grained PATs outside those bounds, and the failure reads as a plain permission error.

## Trusted publishing policies

Four of them, and every one binds to the workflow **filename**. Renaming `release.yml` breaks all
four at once, and each fails as an ordinary auth error that says nothing about the cause.

| Registry | Where | Values |
|---|---|---|
| npm ×2 | Package → Settings → Trusted Publisher | `OrderEazi` / `commerce-sdk` / `release.yml`, environment blank. Configure once for each package - npm allows one publisher per package. |
| PyPI | Project → Publishing | `OrderEazi` / `commerce-sdk` / `release.yml` / environment `pypi` |
| NuGet | Username → Trusted Publishing | Repository Owner `OrderEazi`, Repository `commerce-sdk`, Workflow File `release.yml` |
| Packagist | none | Reads tags off `commerce-sdk-php` via its GitHub hook |

npm additionally requires that `package.json`'s repository URL match this repository, and trusted
publishing needs npm 11.5.1+ / Node 22.14+ - an older runner fails with a 401 that looks nothing like
a version problem, so the workflow checks the version up front.

A new package cannot have a trusted publisher until it exists, so its very first release needs a
token. `publish-npm` uses `NPM_TOKEN` when present and OIDC when not, which also serves as the
recovery path if a policy is ever broken or rotated away.

## Package metadata

All five packages are MIT, copyright Warp Development - the legal entity. OrderEazi is the product
and is the package author, so NuGet carries Warp Development as `Company` and OrderEazi as `Authors`.

`scripts/apply-package-metadata.js` writes licence, author and repository fields into each generated
manifest. It exists because openapi-generator does not expose the same properties for every language
and does not fail on one it does not recognise - a flag that quietly did nothing would publish an
unlicensed package. Patching the manifest afterwards is uniform and testable without a JRE:

```bash
node scripts/apply-package-metadata.test.js
```

Its fixtures are the shapes the generator actually emits, including the two that broke the first
release: a `pyproject.toml` carrying both `[project]` and `[tool.poetry]`, and a distribution name
that did not match the PyPI trusted publisher.

## Gotchas worth knowing before they bite

- **The PHP repo is generated.** `commerce-sdk-php` is replaced wholesale on every release. A PR
  opened there is lost. Its `.git` and `.github` survive; nothing else does.
- **`generated/` is never committed here.** It is build output, produced per release.
- **Releases are manual.** Nothing in Storefront-8 triggers this. An API change ships, and the SDKs
  follow only when someone cuts a release.
