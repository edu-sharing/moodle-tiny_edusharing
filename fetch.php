<?php
// This file is part of Moodle - http://moodle.org/
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle.  If not, see <http://www.gnu.org/licenses/>.

/**
 * Fetches data for js
 *
 * @package    atto_edusharing
 * @copyright  metaVentis GmbH — http://metaventis.com
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

global $CFG;

require_once(__DIR__ . '/../../../../../config.php');
require_once($CFG->dirroot . '/mod/edusharing/lib/EduSharingService.php');
require_once($CFG->dirroot . '/mod/edusharing/lib/cclib.php');
require_once($CFG->dirroot . '/mod/edusharing/locallib.php');

require_login();

$jsonstr = file_get_contents('php://input');
$jsonobj = json_decode($jsonstr, true);

$coursecontext = context_course::instance($jsonobj['courseid']);
if (!has_capability('moodle/course:update', $coursecontext)) {
    trigger_error(get_string('error_fetching_capability', 'editor_edusharing'), E_USER_WARNING);
    header('', true, 500);
    exit();
}



switch ($jsonobj['useCase']) {
    case 'getTicket':
        if (!empty(get_config('edusharing', 'repository_restApi'))) {
            $eduSharingService = new EduSharingService();
            $ticket = $eduSharingService->getTicket();
        }else{
            $ccauth = new mod_edusharing_web_service_factory();
            $ticket = $ccauth->edusharing_authentication_get_ticket();
        }
        echo $ticket;
        break;
    default:
        echo "Error: No useCase";
}

exit();
