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

/**
 * Options helper for Tiny edu-sharing plugin.
 *
 * @module      tiny_edusharing/options
 * @copyright   2022 metaVentis GmbH <http://metaventis.com>
 * @license     http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import {getPluginOptionName} from 'editor_tiny/options';
import {pluginName} from './common';

const repoUrl = getPluginOptionName(pluginName, 'repoUrl');
const repoTarget = getPluginOptionName(pluginName, 'repoTarget');
const courseId = getPluginOptionName(pluginName, 'courseId');

/**
 * Register the options for the Tiny edu-sharing plugin.
 *
 * @param {TinyMCE} editor
 */
export const register = (editor) => {
    const registerOption = editor.options.register;

    registerOption(repoUrl, {
        processor: 'string',
        "default": '',
    });

    registerOption(repoTarget, {
        processor: 'string',
        "default": '',
    });

    registerOption(courseId, {
        processor: 'string',
        "default": '',
    });
};

/**
 * Get the repoUrl configuration for the Tiny edu-sharing plugin.
 *
 * @param {TinyMCE} editor
 * @returns {object}
 */
export const getRepoUrl = (editor) => editor.options.get(repoUrl);

/**
 * Get the repoTarget configuration for the Tiny edu-sharing plugin.
 *
 * @param {TinyMCE} editor
 * @returns {object}
 */
export const getRepoTarget = (editor) => editor.options.get(repoTarget);

/**
 * Get the courseId configuration for the Tiny edu-sharing plugin.
 *
 * @param {TinyMCE} editor
 * @returns {object}
 */
export const getCourseId = (editor) => editor.options.get(courseId);
