# Change Log

All notable changes the Codefair App will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [v3.4.0] - TBD

### Added

- Feature to provide users with a Zenodo badge that links to the Zenodo archive of their repository.
- Added a new button to retrieve the badge formats of the last Zenodo release.
- Add a new endpoint to retrieve the user's GitHub token for use in the profile dropdown.
- Abstracted FAIR compliance checks into one call to allow plugability of different checks.
- Abstracted commit details workflow into one call.
- UI redesign

### Removed

- Bread crumb in /dashboard page.

### Fixed

- Configure redirect URL for Zenodo OAuth to try and prevent blank page after successful login. Better error handling for Zenodo OAuth when redirect URL is not successful.
- Full Codefair run will trigger after action state is set to 0.
- Fixed the re-validate option bug: previously, a single variable was incorrectly used to load both re-validation modals. This change introduces distinct variables for each modal.
- Existing Zenodo drafts are now correctly calling different endpoints compared to new drafts.

## v3.3.0 - TBD

### Added

- Updated UI of the dashboards to improve user experience.
- Rework Zenodo workflow to allow users to create a draft release on GitHub before signing into Zenodo.
- Update the profile status to include a dropdown of organizations to switch between dashboards.
- Add a new endpoint to retrieve the user's GitHub token for use in the profile dropdown.
- Hide "Okay" button on popup that shows Zenodo release status until it is clickable.

### Fixed

- Gather releases and tags independently to ensure accurate data collection for Zenodo workflow.
- Update placeholder for Contributor and Author URI fields in the metadata template to mention ORCID are valid inputs.
- Codemeta validation schemas were split in two for version 2.0 and 3.0
- Codemeta validation schema for version 3.0 was updated to include variations of certain fields.


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
