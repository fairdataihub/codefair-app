# Change Log

All notable changes the Codefair App will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## v4.0.0 - TBD

### Added

- Upgrade UI to Nuxt v4.
- Update CITATION.cff generation to align with Citation File Format schema v1.3.0.
- Abstract bot event listeners into dedicated handler files for improved maintainability.
- Detect existing Zenodo archivals when determining FAIR archival release status.
- Feature to provide users with a Zenodo badge that links to the Zenodo archive of their repository.
- Added a new button to retrieve the badge formats of the last Zenodo release.
- Add a new endpoint to retrieve the user's GitHub token for use in the profile dropdown.
- Abstracted FAIR compliance checks into one call to allow plugability of different checks.
- README.md compliance check: bot detects the presence of a README and provides a UI editor to create or update it.
- CONTRIBUTING.md compliance check: bot detects contributing guidelines file and provides a UI editor.
- CODE_OF_CONDUCT.md compliance check: bot detects code of conduct file and provides a UI editor with templates.
- Bot file restructured with a plugin architecture to support modular compliance checks.
- Database migrations for README, CONTRIBUTING, CODE_OF_CONDUCT, and analytics tracking.
- Full dark mode UI with light/dark toggle.
- Markdown editor adapts to dark/light mode.
- Live stats display on the home page (managed repositories and organizations/users).
- Added note to the GitHub FAIR Compliance Dashboard issue when it is closed/deleted.
- Images migrated to jsDelivr CDN for improved load performance.
- Mobile navigation menu improvements.
- GitHub releases sorted by last updated and tags sorted from greatest to least.
- Codemeta keywords are now used when populating Zenodo metadata on release.
- Updated UI of the dashboards to improve user experience.
- Redesigned `/dashboard` page with improved layout.
- Update the profile status to include a dropdown to switch between personal and organization dashboards.
- Show count of Codefair-managed repositories in the dashboard.
- Add external link icon to GitHub link in the navigation bar.

### Changed

- Major refactor of license compliance workflow: LICENSE file is now only checked at the repository root (matching GitHub's SPDX detection behavior).
- Major refactor of metadata compliance workflow: cleaner function boundaries for checking, updating, and applying metadata templates.
- Rework Zenodo workflow to allow users to create a draft GitHub release before signing into Zenodo.
- Improve SPDX license validation and add a verification step to the workflow.
- Updated GitHub issue text for clarity in the FAIR Compliance Dashboard.
- UI redesign.
- Hide "Okay" button on Zenodo release status popup until it is clickable.
- Abstracted commit details workflow into one call.

### Fixed

- Fix large file uploads to Zenodo that were failing silently.
- Update codemeta.json validation to correctly use the 2.0 schema when the file specifies `@context` version 2.0.
- Add codemeta 2.0 schema to the bot Docker image.
- Prevent concurrent bot workflow conflicts when multiple events fire simultaneously.
- Validate newly added license entries against the SPDX license list.
- Fix citation identifier to be stored as a URL during a Zenodo release.
- Full Codefair run will trigger after action state is set to 0.
- Fixed the re-validate option bug: previously, a single variable was incorrectly used to load both re-validation modals. This change introduces distinct variables for each modal.
- GitHub FAIR Compliance issue is re-rendered after a successful Zenodo release.
- Existing Zenodo drafts are now correctly calling different endpoints compared to new drafts.
- Proper enabling/disabling of tags and releases in the Zenodo workflow.
- Correct field used for verifying GitHub payload action.
- Removed duplicate CSS and corrected CSS variable application in dark mode.
- Preserve existing metadata fields when re-validation is not triggered.
- Remove broken secondary prop from button component.
- Gather releases and tags independently via separate API calls to ensure accurate data for Zenodo workflow.
- Fix sorting of dashboard repositories by last updated timestamp.
- Codemeta validation schemas split into separate schemas for version 2.0 and 3.0.
- Codemeta v3.0 schema updated to include variations of certain fields.

### Removed

- Removed MongoDB libraries and legacy migration scripts (Postgres is the sole database).
- Bread crumb in /dashboard page.

## v3.2.1 - 12-12-2024

### Added

- Convert logging from 'consola' to 'logwatch' for improved log management and consistency across the application.

### Fixed

- Update CI and deployment workflows to include new environment variables 'BOT_LOGWATCH_URL' and 'VALIDATOR_URL'.
- Patch to Zenodo workflow that was causing the user to be notified of a failed Zenodo upload when the upload was successful.
- Fix issue with the metadata validation endpoint that was causing the service to return a 405 error.

## v3.2.0 - 12-10-2024

### Added

- Introduce metadata and license validation capabilities, allows for re-validation of metadata files and licenses through the UI.
- Add support for validation codemeta.json and CITATION.cff files using a new schema and validation endpoints.
- Improve metadata handling by introducing functions to convert and validate metadata from codemeta.json and CITATION.cff files.
- Enhance the dashboard UI to display metadata validation results and provide options for re-validation.
- Add CI workflows for deploying the validator service using Kamal and Docker.
- Set up deployment configurations for the validator service using Kamal, including Docker and Azure Container Registry integrations.
- A new schema for codemeta.json validation and implement validation logic for CITATION.cff files.
- Validator service moved to current repository and integrated with the Codefair app.

## Fixed

- Fixed issues related to filtering what is consider a cwl file in the repository.

## v3.1.1 - 11-12-2024

### Fixed

- Remove outdated URL links in the template renderer to ensure the correct and current links are used for metadata, CWL, and license templates.

## v3.1.0 - 11-05-2024

### Added

- Enhance logging by adding more informative messages and removing redundant logs.
- Added NuxtLinks to external resources in the Codefair description
- Modified the GitHub issue button layout
- Improved error handling when publishing to Zenodo
- Improved handling of 'no-license' and 'NOASSERTION' cases in the SPDX license detection

### Fixed

- Patched issue with PR link not being replaced correctly in the Metadata section of the FAIR Compliance Dashboard Issue
- Stop updating the date for "first released date" in the existing codemeta.json file
- Fixed spacing between the "Open a GitHub issue" and icon in the home page.

## v3.0.0 - 2024-10-17

### Added

- A new workflow has been implemented to streamline the integration of the GitHub release process with Zenodo archiving. This enhancement ensures that metadata is updated prior to each GitHub release, allowing for a more accurate and up-to-date archived version of the repository on Zenodo. This change simplifies the release process and enhances the accessibility of our project's data.

## v2.0.1 - 2024-09-03

### Identifier

https://doi.org/10.5281/zenodo.13651177

### Added

- Added a migration script to update the database for users who may try to access the dashboard before the v2.0.0 bot has ran on all their repositories.
- Added badges to the CWL card on the dashboard to show the overall status of the CWL validations.

### Fixed

- Fixed a bug where the bot would updated the overall status of the CWL validation on the database.
- Link generator for Codefair repository settings was fixed to correctly generate the link for a user or repository.

### Removed

- Removed references to the action key in the database as it was not being used.

## v2.0.0 - 2024-08-29

### Identifier

https://doi.org/10.5281/zenodo.13544387

### Added

- Full CWL Validation to entire repositories and an user interface to view the validation reports.
- UI Dashboard has been added for beta testing. The dashboard will provide a central location of the repositories being managed by Codefair. Users will have the ability to update their FAIR compliance items along with rerunning CWL validations and/or enture FAIR compliance checks.
- Single instance database was created for the bot to remove the need for the database to be passed as a parameter in most of the bot functions.
- An action queue was created for users who install Codefair to a large number of repositories in one installation. This will prevent an organization/user account from being spammed with alerts on issues being opened for each repository. The action queue will require 5 actions on said repository before the bot will begin to open a Fair Compliance Dashboard issue.

### Changed

- Workflow on the bot has been optimzed to reduce the number of database calls and improving the overall performance/readability of the bot.
- File restructuring was done on the bot to improve maintainability and readability.
- Logging has been updated on the bot side to use Consola for better tracking of bot errors and runtime details.

### Removed

- Mention of the FAIR-BioRS Guidelines have been removed to prevent users from thinking Codefair is solely for biomedical research software.

## v1.0.0 - 2024-08-26

### Identifier

https://doi.org/10.5281/zenodo.13376617

### Added

- First release with license file and metadata files generating features
