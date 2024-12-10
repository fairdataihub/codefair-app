# Change Log

All notable changes the Codefair App will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

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
