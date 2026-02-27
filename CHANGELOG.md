# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [10.2.1] - 2026-02-27

## Changed

- Bumped the MYSQL version in the CI pipeline to 9.6.0
- Bumped the Moodle version in the CI pipeline to 5.1
- Ensured compatibility with Moodle 5.1

## [10.2.0] - 2026-01-20

### Added

- Capability to embed Edu-Sharing widgets

## [10.1.3] - 2025-12-08

### Fixed

- Minor fixes in language strings

## [10.1.2] - 2025-10-08

### Fixed

- Race condition appeared when several editor instances are in the DOM
- Redirect to the edited section now works after submit
- Translation strings are now properly loaded
- The instructions GIF is now initialized after the DOM is completely loaded 

## [10.1.1] - 2025-07-23

### Fixed

- Incorrect button labeling

## [10.1.0] - 2025-07-23

### Added

- Button group for repository targets (landing pages)

## [10.0.0] - 2025-07-14

### Changed

- Bumped the PHP version in the CI pipeline to 8.4
- Bumped the MYSQL version in the CI pipeline to 9.3.0
- Bumped the Moodle version in the CI pipeline to 5.0
- Ensured compatibility with Moodle 5.0

## [9.0.0] - 2025-02-28

### Added

- French translation file

### Fixed

- Added ticket to the preview url in editor content

## [8.1.4] - 2024-11-15

### Changed

- Preview URL query parameters now include a ticket

## [8.1.3] - 2024-11-07

### Fixed

- Updated Moodle CI and updated code to match changed criteria
- Ensured compatibility with Moodle 4.5

## [8.1.2] - 2024-09-23

### Fixed

- Grading quizzes or overriding marks now works

## [8.1.1] - 2024-07-26

### Removed

- Capability to embed folders

### Fixed

- Submit now properly triggers in course intro forms

## [8.1.0] - 2024-05-02

### Changed

- Major refactoring to update plugin to current Moodle CI requirements

### Added

- GitLab CI pipeline including Moodle CI checks

## [8.0.0] - 2023-24-12

Initial version
