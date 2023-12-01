<?php

/**
 * Fetches object preview from repository
 *
 * @package    atto_edusharing
 * @copyright  metaVentis GmbH — http://metaventis.com
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

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


    $resourceId = optional_param('resourceId', 0, PARAM_INT);

    if (!$edusharing = $DB->get_record('edusharing', ['id' => $resourceId])) {
        trigger_error(get_string('error_loading_instance', 'editor_edusharing'), E_USER_WARNING);
    }
    $utils      = new UtilityFunctions();
    $baseHelper = new EduSharingHelperBase(get_config('edusharing', 'application_cc_gui_url'), get_config('edusharing', 'application_private_key'), get_config('edusharing', 'application_appid'));
    $time       = round(microtime(true) * 1000);

    $url = $utils->get_internal_url() . '/preview';;
    $url     .= '?appId=' . get_config('edusharing', 'application_appid');
    $url     .= '&courseId=' . $edusharing->course;
    $url     .= '&repoId=' . $utils->get_repository_id_from_url($edusharing->object_url);
    $url     .= '&proxyRepId=' . get_config('edusharing', 'application_homerepid');
    $url     .= '&nodeId=' . $utils->get_object_id_from_url($edusharing->object_url);
    $url     .= '&resourceId=' . $resourceId;
    $url     .= '&version=' . $edusharing->object_version;
    $sigData = get_config('edusharing', 'application_appid') . $time . $utils->get_object_id_from_url($edusharing->object_url);
    $sig     = urlencode($baseHelper->sign($sigData));
    $url     .= '&sig=' . $sig;
    $url     .= '&signed=' . $sigData;
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
    error_log($exception->getMessage());
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
