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
 * Script filterContent.js
 *
 * This script sets up the logic to be executed on opening the tinyMCE editor.
 *
 * @module      tiny_edusharing/filtercontent
 * @copyright   2024 metaVentis GmbH <http://metaventis.com>
 * @license     http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

export const setup = async(editor) => {
    // Register the edu-sharing Formatter for use in all buttons.
    editor.on('PreInit', () => {
        editor.formatter.register('edusharing', {
            inline: 'div',
            classes: 'edusharing-placeholder',
        });
    });

    editor.on('SetContent', () => {
        // Listen to the SetContent event on the editor and update any edu-sharing-placeholder to not be editable.
        // Doing this means that the inner content of the placeholder cannot be changed without using the dialogue.
        // The SetContent event is called whenever content is changed by actions such as initial load, paste, undo, etc.
        editor.getBody().querySelectorAll('.edusharing-placeholder:not([contenteditable])').forEach((node) => {
            node.contentEditable = false;
        });
        editor.getBody().querySelectorAll('.edusharing-widget-placeholder:not([contenteditable])').forEach((node) => {
            node.contentEditable = false;
        });
        // Old atto preview links need to be redirected in case the atto plugin is not installed.
        editor.getBody().querySelectorAll('img.edusharing_atto').forEach(node => {
            node.src = node.src.replace('/lib/editor/atto/plugins/edusharing/', '/mod/edusharing/');
        });
    });
};
