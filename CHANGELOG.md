# Changelog

## Unreleased

### Added

- **Admin SDKs.** Separate packages for the Admin API, in all four languages: `@ordereazi/commerce-admin-sdk`
  (npm), `ordereazi-commerce-admin-sdk` (PyPI), `ordereazi/commerce-admin-sdk` (Packagist) and
  `OrderEazi.Commerce.Admin.Sdk` (NuGet). They are server-side only and use an admin key, so they are not
  merged into the Store packages. See PUBLISHING.md for switching on publishing.
- **Data transfer import results** (Admin API, from the OC-4241 change):
  - `GET /api/v1/admin/datatransfer/imports/{id}/results` returns the counts for an import plus every
    issue it found, each with its row, column, value, rule and message. In the clients this is
    `getImportResults(id)`.
  - `ImportGetModel` has two new fields: `errorsFilePath` (a CSV of the rejected rows) and
    `skipInvalidRows`.
  - An import can now finish in the status `CommitWarning`: it committed, and the rows that had errors
    were skipped.
  - `POST /api/v1/admin/datatransfer/imports` accepts an optional form field `SkipInvalidRows`. The endpoint
    reads the raw multipart form, so the field is not in the OpenAPI document and the generated
    `createImport` cannot send it. Send that request yourself until the API models the form.

### Changed

- The agent toolkit's bundled OpenAPI snapshots and SDK method manifest are refreshed from the live API.
  The toolkit now describes the endpoints added since its first release, including the above.
