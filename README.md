# edu-sharing Tiny-Editor #

The edu-sharing tiny editor plugin is used to add edu-sharing content when using tiny.

The plugin adds a button to the tiny button bar. After clicking it, the user can open the connected
edu-sharing repository and choose or upload a file of his choice. Having done so, they can choose from some 
display options, such as size and version, and add the content to the editor body.

## Dependencies ##

The edu-sharing tiny editor plugin depends on the edu-sharing activity plugin.

## Installing from moodle plugin directory ##

1. Log in to your Moodle site as admin and go to _Site administration >
   Plugins > Install plugins_.
2. Click the button to _Install plugins from the Moodle plugins directory_
3. Search for the edusharing tiny plugin
4. Finish the installation

## Installing via uploaded ZIP file ##

1. Log in to your Moodle site as an admin and go to _Site administration >
   Plugins > Install plugins_.
2. Upload the ZIP file with the plugin code. You should only be prompted to add
   extra details if your plugin type is not automatically detected.
3. Check the plugin validation report and finish the installation.

## Installing manually ##

The plugin can be also installed by putting the contents of this directory to

    {your/moodle/dirroot}/lib/editor/tiny/plugins/edusharing

Afterward, log in to your Moodle site as an admin and go to _Site administration >
Notifications_ to complete the installation.

Alternatively, you can run

    $ php admin/cli/upgrade.php

to complete the installation from the command line.

## License ##

2023 metaVentis GmbH <http://metaventis.com>

This program is free software: you can redistribute it and/or modify it under
the terms of the GNU General Public License as published by the Free Software
Foundation, either version 3 of the License, or (at your option) any later
version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY
WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
PARTICULAR PURPOSE.  See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with
this program.  If not, see <https://www.gnu.org/licenses/>.
