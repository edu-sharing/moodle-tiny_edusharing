<?php
// This file is part of Moodle - https://moodle.org/
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
// along with Moodle.  If not, see <https://www.gnu.org/licenses/>.

/**
 * Fetches object preview from repository
 *
 * @package    tiny_edusharing
 * @copyright  metaVentis GmbH — http://metaventis.com
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

global $CFG, $DB, $USER;

use EduSharingApiClient\EduSharingHelperBase;
use mod_edusharing\UtilityFunctions;

// Create preview link with signature.
require_once(__DIR__ . '/../../../../../config.php');
require_once($CFG->dirroot . '/lib/setup.php');
require_once($CFG->libdir . '/filelib.php');
require_once($CFG->dirroot . '/mod/edusharing/eduSharingAutoloader.php');

try {
    require_login();


    $resourceid = optional_param('resourceId', 0, PARAM_INT);

    if (!$edusharing = $DB->get_record('edusharing', ['id' => $resourceid])) {
        trigger_error(get_string('error_loading_instance', 'editor_edusharing'), E_USER_WARNING);
    }
    $utils      = new UtilityFunctions();
    $basehelper = new EduSharingHelperBase(
        get_config('edusharing', 'application_cc_gui_url'),
        get_config('edusharing', 'application_private_key'),
        get_config('edusharing', 'application_appid')
    );
    $time       = round(microtime(true) * 1000);

    $url = $utils->get_internal_url() . '/preview';;
    $url     .= '?appId=' . get_config('edusharing', 'application_appid');
    $url     .= '&courseId=' . $edusharing->course;
    $url     .= '&repoId=' . $utils->get_repository_id_from_url($edusharing->object_url);
    $url     .= '&proxyRepId=' . get_config('edusharing', 'application_homerepid');
    $url        .= '&nodeId=' . $utils->get_object_id_from_url($edusharing->object_url);
    $url        .= '&resourceId=' . $resourceid;
    $url        .= '&version=' . $edusharing->object_version;
    $sigdata    = get_config('edusharing', 'application_appid') . $time . $utils->get_object_id_from_url($edusharing->object_url);
    $sig        = urlencode($basehelper->sign($sigdata));
    $url        .= '&sig=' . $sig;
    $url     .= '&signed=' . $sigdata;
    $url     .= '&ts=' . $time;

    $curl = new curl();
    $curl->setopt([
        'CURLOPT_SSL_VERIFYPEER' => false,
        'CURLOPT_SSL_VERIFYHOST' => false,
        'CURLOPT_FOLLOWLOCATION' => 1,
        'CURLOPT_HEADER'         => 0,
        'CURLOPT_RETURNTRANSFER' => 1,
        'CURLOPT_USERAGENT'      => $_SERVER['HTTP_USER_AGENT'],
    ]);
} catch (Exception $exception) {
    debugging($exception->getMessage());
    exit();
}


$output = $curl->get($url);

if ($curl->error) {
    debugging('cURL Error: ' . $curl->error);
    echo 'cURL Error: ' . $curl->error;
    exit();
}

header('Content-type: ' . $curl->get_info()['content_type']);
echo $output;
exit();
