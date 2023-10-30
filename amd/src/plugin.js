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
 * Tiny edu-sharing plugin for Moodle.
 *
 * @module      tiny_edusharing/plugin
 * @copyright   2022 metaVentis GmbH <http://metaventis.com>
 * @license     https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
import {getTinyMCE} from 'editor_tiny/loader';
import {getPluginMetadata} from 'editor_tiny/utils';

import {component, pluginName} from './common';
import * as FilterContent from './filtercontent';
import * as Commands from './commands';
import * as Configuration from './configuration';
import * as Options from './options';

// Setup the edu-sharing Plugin to add a button and menu option.
export default new Promise(async(resolve) => {
    const [
        tinyMCE,
        setupCommands,
        pluginMetadata,
    ] = await Promise.all([
        getTinyMCE(),
        Commands.getSetup(),
        getPluginMetadata(component, pluginName),
    ]);

    // Note: The PluginManager.add function does not accept a Promise.
    // Any asynchronous code must be run before this point.
    tinyMCE.PluginManager.add(`${component}/plugin`, (editor) => {
        // Register options.
        Options.register(editor);

        // Set up the Formatter.
        FilterContent.setup(editor);

        // Set up the Commands (buttons, menu items, and so on).
        setupCommands(editor);

        return pluginMetadata;
    });

    // Resolve the edu-sharing Plugin and include configuration.
    resolve([`${component}/plugin`, Configuration]);
});
