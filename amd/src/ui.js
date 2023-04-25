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
 * Tiny edu-sharing Content configuration.
 *
 * @module      tiny_edusharing/commands
 * @copyright   2022 metaVentis GmbH <http://metaventis.com>
 * @license     http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import {component} from './common';
import {getRepoUrl, getRepoTarget, getCourseId} from './options';

import {getList} from 'core/normalise';
import {renderForPromise} from 'core/templates';
import Modal from 'tiny_edusharing/modal';
import ModalEvents from 'core/modal_events';
import ModalFactory from 'core/modal_factory';
import Config from 'core/config';

let openingSelection = null;

export const handleAction = (editor) => {
    openingSelection = editor.selection.getBookmark();
    displayDialogue(editor);
};

const handleDialogueSubmission = async(editor, modal, data) => {
    const form = getList(modal.getRoot())[0].querySelector('form');
    if (!form) {
        // The form couldn't be found, which is weird.
        // This should not happen.
        // Display the dialogue again
        displayDialogue(editor, Object.assign({}, data));
        return;
    }

    // Get the URL from the submitted form.
    const node = JSON.parse(form.querySelector('input[name="edusharing_node"]').value);

    console.log('node:');
    console.log(node);

    if (!node) {
        // The node is invalid.
        // Fill it in and represent the dialogue with an error.
        displayDialogue(editor, Object.assign({}, data, {
            edusharing_node: node,
            invalidUrl: true,
        }));
        return;
    }


    let style = '';
    if (node.alignment != 'none') {
        style = 'float:' + node.alignment + ';';
    }
    if (node.mediatype == 'folder') {
        style = 'display:block;';
    }
    let version = '0';
    if (false == node.showlatest && node.version != 'undefined') {
        version = node.version;
    }
    let insert = 'class="edusharing_atto" ' +
        'style="' + style + '" ' +
        'title="' + node.title + '" ';

    let title = node.title || node.name;
    let caption = node.caption || '';

    let url = new URL(node.preview.url);
    url.searchParams.set('caption', caption);
    url.searchParams.set('object_url', node.objecturl);
    url.searchParams.set('mediatype', node.mediatype);
    url.searchParams.set('mimetype', node.mimetype);
    url.searchParams.set('window_version', version);
    url.searchParams.set('title', title);

    let width = Math.round(node.properties['ccm:width']) || 600; // Current image width
    let height = Math.round(node.properties['ccm:height']) || 400; // Current image height

    let img, ref = false;

    if (node.mediatype == 'ref') {
        ref = true;
    } else {
        img = true;
        url.searchParams.set('width', width.toString());
        url.searchParams.set('height', height.toString());
    }

    const content = await renderForPromise(`${component}/content`, {
        edusharing_img: img,
        edusharing_ref: ref,
        edusharing_preview_src: url.toString(),
        edusharing_title: title.toString(),
        edusharing_caption: caption.toString(),
        edusharing_width: width.toString(),
        edusharing_height: height.toString(),
    });

    editor.selection.moveToBookmark(openingSelection);
    editor.execCommand('mceInsertContent', false, content.html);
    editor.selection.moveToBookmark(openingSelection);
};

const getCurrentEdusharingData = (currentEdusharing) => {
    const data = {};
    let node;
    try {
        node = currentEdusharing.textContent;
    } catch (error) {
        return data;
    }


    data.node = node.toString();

    return data;
};

const displayDialogue = async(editor, data = {}) => {
    const selection = editor.selection.getNode();
    const currentEdusharing = selection.closest('.edusharing-placeholder');
    if (currentEdusharing) {
        Object.assign(data, getCurrentEdusharingData(currentEdusharing));
    }

    const modal = await ModalFactory.create({
        type: Modal.TYPE,
        large: true,
    });
    modal.show();

    const $root = modal.getRoot();
    const root = $root[0];
    $root.on(ModalEvents.save, (event, modal) => {
        handleDialogueSubmission(editor, modal, data);
    });

    root.addEventListener('click', (e) => {
        const openRepoButton = e.target.closest('[data-target="edusharing"]');
        if (openRepoButton) {
            const repoUrl = getRepoUrl(editor);
            open_repo(repoUrl, getRepoTarget(editor), getCourseId(editor));

            window.addEventListener("message", function(event) {
                if (event.data.event == "APPLY_NODE") {
                    const node = event.data.data;
                    window.win.close();
                    console.log(node);
                    document.getElementById('edusharing-content').innerHTML = node.title;
                    document.getElementById('edusharing_node').value = JSON.stringify(node);

                }
            }, false);
        }
    });
};

const open_repo = function(repoUrl, repoTarget, courseId) {

    window.win = window.open();
    window.win.document.write('Loading edu-sharing ticket...');

    var fetchUrl = `${Config.wwwroot}/lib/editor/tiny/plugins/edusharing/fetch.php`;

    switch (repoTarget) {
        case 'search':
            repoTarget = '/components/search';
            break;
        case 'collections':
            repoTarget = '/components/collections';
            break;
        case 'workspace':
            repoTarget = '/components/workspace/files';
            break;
        default:
            repoTarget = '/components/search';
    }

    // Fetch ticket
    fetch(fetchUrl, {
        method: 'post',
        mode:    'cors',
        headers: {
            'Content-Type': 'application/json', // Sent request
            'Accept':       'application/json' // Expected data sent back
        },
        body: JSON.stringify({
            useCase: 'getTicket',
            courseid: courseId
        })
    })
        .then(function(response) {
            if (response.status >= 200 && response.status < 300) {
                return response.text();
            }
            throw new Error(response.statusText);
        })
        .then(function(response) {
            var ticket = response;
            repoUrl += repoTarget + '?reurl=WINDOW&applyDirectories=true&ticket=' + ticket;
            // Window.win = window.open(repoUrl);
            window.win.location.href = repoUrl;
        });
};