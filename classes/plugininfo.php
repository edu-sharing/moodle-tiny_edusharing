<?php
// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle.  If not, see <http://www.gnu.org/licenses/>.

namespace tiny_edusharing;

use context;
use editor_tiny\editor;
use editor_tiny\plugin;
use editor_tiny\plugin_with_buttons;
use editor_tiny\plugin_with_menuitems;
use editor_tiny\plugin_with_configuration;

/**
 * Tiny edu-sharing plugin for Moodle.
 *
 * @package     tiny_edusharing
 * @copyright   2024 metaVentis GmbH <http://metaventis.com>
 * @license     https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class plugininfo extends plugin implements
    plugin_with_buttons,
    plugin_with_menuitems,
    plugin_with_configuration {

    /**
     * Function get_available_buttons
     *
     * @return string[]
     */
    public static function get_available_buttons(): array {
        return [
            'tiny_edusharing/edusharing',
        ];
    }

    /**
     * Function get_available_menuitems
     *
     * @return string[]
     */
    public static function get_available_menuitems(): array {
        return [
            'tiny_edusharing/edusharing',
        ];
    }

    /**
     * Function get_plugin_configuration_for_context
     *
     * @param context $context
     * @param array $options
     * @param array $fpoptions
     * @param editor|null $editor
     * @return array
     * @throws \dml_exception
     */
    public static function get_plugin_configuration_for_context(
        context $context,
        array $options,
        array $fpoptions,
        ?\editor_tiny\editor $editor = null
    ): array {

        global $COURSE;

        return [
            'repoUrl' => trim(get_config('edusharing', 'application_cc_gui_url')),
            'repoTarget' => get_config('edusharing', 'repo_target'),
            'courseId' => $COURSE->id,
            'enableRepoTargetChooser' => (bool)get_config('edusharing', 'enable_repo_target_chooser'),
            'repoId' => get_config('edusharing', 'application_homerepid'),
        ];
    }
}
