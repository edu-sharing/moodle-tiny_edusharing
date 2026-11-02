# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [11.0.5] - 2026-11-02

### Fixed

- Changing the caption of an existing object in the edit dialog no longer removes it, and clearing
  it no longer keeps the old one. Captions containing & or < are no longer written back as
  entities.
- Embedding iframes of another repository entered in the source code view are removed with a
  notice, as they already were when pasted as text.
- On Moodle 4.5 the edu-sharing button is only shown to users with tiny/edusharing:use in the
  editor's context. Moodle 4.5 enables every editor plugin for everyone, so students got the
  button too.
- The inserting user's repository ticket is no longer stored with the text, where it ended up in
  other teachers' editors, backups and imports. Texts saved before lose it on their next save.
- Editing a text with an object inserted by Atto no longer requests the old Atto preview, which
  answers 404 once atto_edusharing is removed.

### Changed

- Bumped the Moodle version in the CI pipeline to 5.3

## [11.0.4]

### Fixed

- Plugin no longer blocks rendering of tiny editor in Moodle >=5.2

## [11.0.3] - 2026-09-08

### Fixed

- Widgets pasted into the editor are converted again instead of always being reported as an
  unsupported type: the attribute whitelist kept exactly the attributes it was meant to drop,
  so the widget type was never part of the payload.
- Both names repositories use for the content teaser are accepted ("content-teaser" and
  "wlo-content-teaser").
- Text nodes are parsed again when looking for widgets and embedding iframes, so markup that
  tinyMCE keeps as escaped text is found. Parsing is done inertly via DOMParser.
- Brockhaus objects offer a width and a height on insert and on edit. Their mediatype "link"
  would otherwise take the size choice away entirely.
- Serlo, lti tool and geogebra objects inserted before the height choice existed no longer
  offer a width and a height on edit. Their mimetype says nothing about how they are rendered,
  so the stored preview url was not recognised as a height only object and the size entered was
  silently ignored on rendering; they are now recognised by their mediatype.

## [11.0.2] - 2026-09-07

### Fixed

- Objects whose usage cannot be created in the repository are now removed from the text and
  reported to the user with the reason, instead of being saved as a broken placeholder.
- A save is no longer completed after an unexpected failure during conversion: usages created
  during that attempt are removed again and the editor content is left untouched, so a retry
  cannot create duplicates.
- Failed updates of existing objects are reported instead of only being logged to the console.
- Removing an element while walking the content no longer skips its next sibling.

## [11.0.1] - 2026-06-26

### Fixed

- The Submit button is now disabled during ES custom logic to prevent multiple submissions

## [11.0.0] - 2026-06-16

### Changed

- Major security audit and code overhaul

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
